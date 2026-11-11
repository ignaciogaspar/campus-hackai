'use server'
/* Inscribirse y darse de baja de una comisión, desde la oferta. Solo traduce
   lo que devuelve Cursada a un estado que la pantalla sabe mostrar: las reglas
   (todo o nada, cupo, período, autogestión) son de Cursada. */
import { revalidatePath } from 'next/cache'
import type { EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { DropError, DropOutcome, EnrollError, EnrollOutcome } from '@/lib/core/studies'
import type { Result } from '@/lib/result'

type Common = 'objetivo-desconocido' | 'persona-desconocida'

const COMMON_ERRORS: Record<Common, string> = {
  'objetivo-desconocido': 'No encontramos esta comisión en el SIU.',
  'persona-desconocida': 'No encontramos tus datos en el SIU.'
}

const ENROLL_ERRORS: Record<EnrollError | Common | 'no-implementado', string> = {
  ...COMMON_ERRORS,
  'sin-cupo': 'La comisión se quedó sin cupo. Probá con otra comisión.',
  'fuera-de-periodo': 'La inscripción a esta comisión no está abierta.',
  'ya-inscripto': 'Ya estás inscripto en esta materia. Para cambiarte de comisión, primero date de baja de la otra.',
  'falla-externa':
    'El SIU o el Campus Virtual no respondieron, así que no te inscribimos en nada. Probá de nuevo en un rato.',
  'sin-cuenta-del-aula':
    'No encontramos tu usuario del Campus Virtual, así que no te inscribimos en nada. Escribile a la secretaría de tu facultad para que lo revisen.',
  'a-medias':
    'Quedaste inscripto en el SIU, pero no pudimos sumarte al aula del Campus Virtual. Escribile a la secretaría de tu facultad para que lo completen.',
  'no-implementado': 'Todavía no podemos inscribirte desde HackAI.'
}

const DROP_ERRORS: Record<DropError | Common | 'no-implementado', string> = {
  ...COMMON_ERRORS,
  'no-inscripto': 'No estás inscripto en esta comisión.',
  'fuera-de-periodo': 'Ya no te podés dar de baja: el período de inscripción cerró.',
  'falla-externa':
    'El SIU o el Campus Virtual no respondieron, así que seguís inscripto como antes. Probá de nuevo en un rato.',
  'sin-cuenta-del-aula':
    'No encontramos tu usuario del Campus Virtual, así que seguís inscripto como antes. Escribile a la secretaría de tu facultad para que lo revisen.',
  'a-medias':
    'Seguís inscripto en el SIU, pero quedaste afuera del aula del Campus Virtual. Escribile a la secretaría de tu facultad para que lo completen.',
  'no-implementado': 'Todavía no podemos darte de baja desde HackAI.'
}

type Outcome = EnrollOutcome | DropOutcome

/** El paso común de las dos acciones: sesión, comisión del formulario, llamada
    a Cursada y traducción del resultado. `done` arma el estado si salió bien. */
async function runSectionAction<E extends string, O extends Outcome>(
  formData: FormData,
  step: EnrollmentStep,
  errors: Record<E, string> & Record<'objetivo-desconocido', string>,
  call: (personId: string, sectionId: string) => Promise<Result<O, E>>,
  done: (outcome: Exclude<O, { kind: 'requiere-autogestion' }>) => EnrollmentState
): Promise<EnrollmentState> {
  const session = await requireSession('alumno')
  const sectionId = formData.get('sectionId')
  if (typeof sectionId !== 'string' || !sectionId) return { kind: 'error', message: errors['objetivo-desconocido'] }

  const result = await call(session.personId, sectionId)
  if (!result.ok) return { kind: 'error', message: errors[result.error] }
  if (result.value.kind === 'requiere-autogestion') return { kind: 'requiere-autogestion', url: result.value.url, step }
  revalidatePath('/inscripciones', 'layout')
  revalidatePath('/materias')
  return done(result.value as Exclude<O, { kind: 'requiere-autogestion' }>)
}

export async function enrollAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runSectionAction(
    formData,
    'inscripcion',
    ENROLL_ERRORS,
    (personId, sectionId) => system().studies.enroll(personId, { kind: 'comision', sectionId }),
    (outcome) => ({
      kind: 'inscripto',
      transactionNumber: outcome.receipt.transactionNumber,
      inClassroom: outcome.classroomCourseIds.length > 0
    })
  )
}

export async function dropAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runSectionAction(
    formData,
    'baja',
    DROP_ERRORS,
    (personId, sectionId) => system().studies.drop(personId, { kind: 'comision', sectionId }),
    (outcome) => ({ kind: 'baja', transactionNumber: outcome.receipt.transactionNumber })
  )
}
