'use server'
/* Inscribirse y darse de baja de una comisión o de una mesa de examen, desde la
   oferta. Las dos van por el mismo flujo y vuelven los mismos errores: solo
   cambian las palabras. Acá se traduce lo que devuelve Cursada a un estado que
   la pantalla sabe mostrar; las reglas (todo o nada, cupo, período,
   autogestión) son de Cursada. */
import { revalidatePath } from 'next/cache'
import { UNKNOWN_PERSON_TEXT } from '@/components/enrollment/read-error'
import type { EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'
import { targetFromForm } from '@/components/enrollment/target'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { DropError, DropOutcome, EnrollError, EnrollOutcome, Target } from '@/lib/core/studies'
import type { Result } from '@/lib/result'

type CommonError = 'objetivo-desconocido' | 'persona-desconocida'
type EnrollErrorText = Record<EnrollError | CommonError | 'no-implementado', string>
type DropErrorText = Record<DropError | CommonError | 'no-implementado', string>

/** Un formulario que no dice qué comisión o mesa es: no se sabe cuál nombrar. */
const UNKNOWN_TARGET_TEXT = 'No encontramos lo que elegiste en el SIU. Volvé a cargar la página y probá de nuevo.'

const SECTION_ENROLL_ERRORS: EnrollErrorText = {
  'objetivo-desconocido': 'No encontramos esta comisión en el SIU.',
  'persona-desconocida': UNKNOWN_PERSON_TEXT,
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

/** Una mesa no toca el aula, así que `sin-cuenta-del-aula` y `a-medias` no
    pasan: quedan los textos de la comisión para que el `Record` esté completo. */
const BOARD_ENROLL_ERRORS: EnrollErrorText = {
  ...SECTION_ENROLL_ERRORS,
  'objetivo-desconocido': 'No encontramos esta mesa en el SIU.',
  'sin-cupo': 'La mesa se quedó sin cupo. Si hay otra fecha, probá con esa.',
  'fuera-de-periodo': 'La inscripción a esta mesa no está abierta.',
  'ya-inscripto': 'Ya estás inscripto en esta mesa.',
  'falla-externa': 'El SIU no respondió, así que no te inscribimos. Probá de nuevo en un rato.'
}

const SECTION_DROP_ERRORS: DropErrorText = {
  'objetivo-desconocido': 'No encontramos esta comisión en el SIU.',
  'persona-desconocida': UNKNOWN_PERSON_TEXT,
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

const BOARD_DROP_ERRORS: DropErrorText = {
  ...SECTION_DROP_ERRORS,
  'objetivo-desconocido': 'No encontramos esta mesa en el SIU.',
  'no-inscripto': 'No estás inscripto en esta mesa.',
  'fuera-de-periodo': 'Ya no te podés dar de baja: la inscripción a esta mesa cerró.',
  'falla-externa': 'El SIU no respondió, así que seguís inscripto como antes. Probá de nuevo en un rato.'
}

const ENROLL_ERRORS: Record<Target['kind'], EnrollErrorText> = {
  comision: SECTION_ENROLL_ERRORS,
  mesa: BOARD_ENROLL_ERRORS
}

const DROP_ERRORS: Record<Target['kind'], DropErrorText> = { comision: SECTION_DROP_ERRORS, mesa: BOARD_DROP_ERRORS }

type Outcome = EnrollOutcome | DropOutcome

/** El paso común de las dos acciones: sesión, comisión o mesa del formulario,
    llamada a Cursada y traducción del resultado. `done` arma el estado si salió bien. */
async function runTargetAction<E extends string, O extends Outcome>(
  formData: FormData,
  step: EnrollmentStep,
  errors: Record<Target['kind'], Record<E, string>>,
  call: (personId: string, target: Target) => Promise<Result<O, E>>,
  done: (outcome: Exclude<O, { kind: 'requiere-autogestion' }>) => EnrollmentState
): Promise<EnrollmentState> {
  const session = await requireSession('alumno')
  const target = targetFromForm(formData)
  if (!target) return { kind: 'error', message: UNKNOWN_TARGET_TEXT }

  const result = await call(session.personId, target)
  // Algo cambió en el SIU también si quedó a medias: la pantalla tiene que verlo.
  // Hoy muestra los finales a los que está inscripto y las inscripciones abiertas.
  if (result.ok || result.error === 'a-medias') {
    revalidatePath('/inscripciones', 'layout')
    revalidatePath('/materias')
    revalidatePath('/hoy')
  }
  if (!result.ok) return { kind: 'error', message: errors[target.kind][result.error] }
  if (result.value.kind === 'requiere-autogestion') return { kind: 'requiere-autogestion', url: result.value.url, step }
  return done(result.value as Exclude<O, { kind: 'requiere-autogestion' }>)
}

export async function enrollAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runTargetAction(
    formData,
    'inscripcion',
    ENROLL_ERRORS,
    (personId, target) => system().studies.enroll(personId, target),
    (outcome) => ({
      kind: 'inscripto',
      transactionNumber: outcome.receipt.transactionNumber,
      inClassroom: outcome.classroomCourseIds.length > 0
    })
  )
}

export async function dropAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runTargetAction(
    formData,
    'baja',
    DROP_ERRORS,
    (personId, target) => system().studies.drop(personId, target),
    (outcome) => ({ kind: 'baja', transactionNumber: outcome.receipt.transactionNumber })
  )
}
