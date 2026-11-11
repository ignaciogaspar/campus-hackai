'use server'
/* Inscribirse y darse de baja de una comisión, desde la oferta. Solo traduce
   lo que devuelve Cursada a un estado que la pantalla sabe mostrar: las reglas
   (todo o nada, cupo, período, autogestión) son de Cursada. */
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { DropError, EnrollError } from '@/lib/core/studies'

export type EnrollmentState =
  | { kind: 'inicial' }
  | { kind: 'inscripto'; transactionNumber: string }
  | { kind: 'baja'; transactionNumber: string }
  | { kind: 'requiere-autogestion'; url: string; action: 'inscribirte' | 'darte de baja' }
  | { kind: 'error'; message: string }

type Failure = EnrollError | DropError | 'persona-desconocida' | 'no-implementado'

const ENROLL_ERRORS: Record<Exclude<Failure, 'no-inscripto'>, string> = {
  'sin-cupo': 'La comisión se quedó sin cupo. Probá con otra comisión.',
  'fuera-de-periodo': 'La inscripción a esta comisión no está abierta.',
  'ya-inscripto': 'Ya estás inscripto en esta materia. Para cambiarte de comisión, primero date de baja de la otra.',
  'objetivo-desconocido': 'No encontramos esta comisión en el SIU.',
  'falla-externa': 'El SIU o el Campus Virtual no respondieron, así que no te inscribimos en nada. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU.',
  'no-implementado': 'Todavía no podemos inscribirte desde HackAI.',
}

const DROP_ERRORS: Record<Failure, string> = {
  ...ENROLL_ERRORS,
  'no-inscripto': 'No estás inscripto en esta comisión.',
  'fuera-de-periodo': 'Ya no te podés dar de baja: el período de inscripción cerró.',
  'falla-externa': 'El SIU o el Campus Virtual no respondieron, así que seguís inscripto como antes. Probá de nuevo en un rato.',
  'no-implementado': 'Todavía no podemos darte de baja desde HackAI.',
}

function sectionFrom(formData: FormData): string | null {
  const sectionId = formData.get('sectionId')
  return typeof sectionId === 'string' && sectionId ? sectionId : null
}

function refresh() {
  revalidatePath('/inscripciones', 'layout')
  revalidatePath('/materias')
}

export async function enrollAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  const session = await requireSession('alumno')
  const sectionId = sectionFrom(formData)
  if (!sectionId) return { kind: 'error', message: ENROLL_ERRORS['objetivo-desconocido'] }

  const result = await system().studies.enroll(session.personId, { kind: 'comision', sectionId })
  if (!result.ok) return { kind: 'error', message: ENROLL_ERRORS[result.error] }
  if (result.value.kind === 'requiere-autogestion') return { kind: 'requiere-autogestion', url: result.value.url, action: 'inscribirte' }
  refresh()
  return { kind: 'inscripto', transactionNumber: result.value.receipt.transactionNumber }
}

export async function dropAction(_prev: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  const session = await requireSession('alumno')
  const sectionId = sectionFrom(formData)
  if (!sectionId) return { kind: 'error', message: DROP_ERRORS['objetivo-desconocido'] }

  const result = await system().studies.drop(session.personId, { kind: 'comision', sectionId })
  if (!result.ok) return { kind: 'error', message: DROP_ERRORS[result.error] }
  if (result.value.kind === 'requiere-autogestion') return { kind: 'requiere-autogestion', url: result.value.url, action: 'darte de baja' }
  refresh()
  return { kind: 'baja', transactionNumber: result.value.receipt.transactionNumber }
}
