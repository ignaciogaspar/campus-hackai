'use server'
/* Inscribirse y darse de baja de una comisión o de una mesa de examen, desde
   Inscripciones. Solo traduce lo que devuelve Cursada a un estado que la
   pantalla sabe mostrar: las reglas (todo o nada, cupo, período, carrera,
   autogestión) son de Cursada. */
import { revalidatePath } from 'next/cache'
import { UNKNOWN_PERSON_TEXT } from '@/components/enrollment/read-error'
import type { EnrollmentState, EnrollmentStep, EnrollmentTargetKind } from '@/components/enrollment/state'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { DropError, DropOutcome, EnrollError, EnrollOutcome, Target } from '@/lib/core/studies'
import type { Result } from '@/lib/result'

type CommonError = 'objetivo-desconocido' | 'persona-desconocida'

/** Cómo se nombra lo que se eligió en cada mensaje. */
const WHAT: Record<EnrollmentTargetKind, { the: string; other: string }> = {
  comision: { the: 'esta comisión', other: 'otra comisión' },
  mesa: { the: 'esta mesa', other: 'otra mesa' }
}

function enrollErrors(kind: EnrollmentTargetKind): Record<EnrollError | CommonError | 'no-implementado', string> {
  const { the, other } = WHAT[kind]
  return {
    'objetivo-desconocido': `No encontramos ${the} en el SIU, o no es para tu carrera.`,
    'persona-desconocida': UNKNOWN_PERSON_TEXT,
    'sin-cupo': `Se llenó el cupo de ${the}. Probá con ${other}.`,
    'fuera-de-periodo': `La inscripción a ${the} no está abierta.`,
    'ya-inscripto':
      kind === 'comision'
        ? 'Ya estás inscripto en esta materia. Para cambiarte de comisión, primero date de baja de la otra.'
        : 'Ya estás inscripto a esta mesa.',
    'falla-externa':
      'El SIU o el Campus Virtual no respondieron, así que no te inscribimos en nada. Probá de nuevo en un rato.',
    'sin-cuenta-del-aula':
      'No encontramos tu usuario del Campus Virtual, así que no te inscribimos en nada. Escribile a la secretaría de tu facultad para que lo revisen.',
    'a-medias':
      'Quedaste inscripto en el SIU, pero no pudimos sumarte al aula del Campus Virtual. Escribile a la secretaría de tu facultad para que lo completen.',
    'no-implementado': 'Todavía no podemos inscribirte desde HackAI.'
  }
}

function dropErrors(kind: EnrollmentTargetKind): Record<DropError | CommonError | 'no-implementado', string> {
  const { the } = WHAT[kind]
  return {
    'objetivo-desconocido': `No encontramos ${the} en el SIU.`,
    'persona-desconocida': UNKNOWN_PERSON_TEXT,
    'no-inscripto': `No estás inscripto a ${the}.`,
    'fuera-de-periodo': 'Ya no te podés dar de baja: el período de inscripción cerró.',
    'falla-externa':
      'El SIU o el Campus Virtual no respondieron, así que seguís inscripto como antes. Probá de nuevo en un rato.',
    'sin-cuenta-del-aula':
      'No encontramos tu usuario del Campus Virtual, así que seguís inscripto como antes. Escribile a la secretaría de tu facultad para que lo revisen.',
    'a-medias':
      'Seguís inscripto en el SIU, pero quedaste afuera del aula del Campus Virtual. Escribile a la secretaría de tu facultad para que lo completen.',
    'no-implementado': 'Todavía no podemos darte de baja desde HackAI.'
  }
}

type Outcome = EnrollOutcome | DropOutcome

/** La comisión o la mesa del formulario: `kind` e `id`. */
function targetFrom(formData: FormData): Target | null {
  const kind = formData.get('kind')
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return null
  if (kind === 'comision') return { kind: 'comision', sectionId: id }
  if (kind === 'mesa') return { kind: 'mesa', examBoardId: id }
  return null
}

/** El paso común de las dos acciones: sesión, objetivo del formulario, llamada
    a Cursada y traducción del resultado. `done` arma el estado si salió bien. */
async function runAction<E extends string, O extends Outcome>(
  formData: FormData,
  step: EnrollmentStep,
  errors: (kind: EnrollmentTargetKind) => Record<E, string> & Record<'objetivo-desconocido', string>,
  call: (personId: string, target: Target) => Promise<Result<O, E>>,
  done: (outcome: Exclude<O, { kind: 'requiere-autogestion' }>, kind: EnrollmentTargetKind) => EnrollmentState
): Promise<EnrollmentState> {
  const session = await requireSession('alumno')
  const target = targetFrom(formData)
  if (!target) return { kind: 'error', message: errors('comision')['objetivo-desconocido'] }

  const result = await call(session.personId, target)
  // Algo cambió en el SIU también si quedó a medias: la barra lateral, Materias,
  // Calendario, Notas y Hoy lo tienen que ver.
  if (result.ok || result.error === 'a-medias') revalidatePath('/', 'layout')
  if (!result.ok) return { kind: 'error', message: errors(target.kind)[result.error] }
  if (result.value.kind === 'requiere-autogestion') return { kind: 'requiere-autogestion', url: result.value.url, step }
  return done(result.value as Exclude<O, { kind: 'requiere-autogestion' }>, target.kind)
}

export async function enrollAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runAction(
    formData,
    'inscripcion',
    enrollErrors,
    (personId, target) => system().studies.enroll(personId, target),
    (outcome, target) => ({
      kind: 'inscripto',
      transactionNumber: outcome.receipt.transactionNumber,
      inClassroom: outcome.classroomCourseIds.length > 0,
      target
    })
  )
}

export async function dropAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  return runAction(
    formData,
    'baja',
    dropErrors,
    (personId, target) => system().studies.drop(personId, target),
    (outcome, target) => ({ kind: 'baja', transactionNumber: outcome.receipt.transactionNumber, target })
  )
}
