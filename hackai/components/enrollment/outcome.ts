/* Qué resultado muestran las acciones de una comisión o una mesa. Cada acción
   (inscribirse, darse de baja) guarda su último resultado hasta que llega el
   siguiente, así que al repetir una el estado sigue siendo el de la vez
   anterior mientras la nueva está en camino: ese no se muestra. */
import type { EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'

export const INITIAL_ENROLLMENT_STATE: EnrollmentState = { kind: 'inicial' }

type Outcomes = {
  /** La última acción que mandó el alumno, o `null` si todavía no mandó ninguna. */
  lastAction: EnrollmentStep | null
  enrollState: EnrollmentState
  dropState: EnrollmentState
  /** El estado que tenía esa acción cuando el alumno la mandó: es de la vez anterior. */
  superseded: EnrollmentState | null
  /** Hay una acción en camino. */
  pending: boolean
}

export function visibleOutcome({ lastAction, enrollState, dropState, superseded, pending }: Outcomes): EnrollmentState {
  if (pending || lastAction === null) return INITIAL_ENROLLMENT_STATE
  const state = lastAction === 'baja' ? dropState : enrollState
  return state === superseded ? INITIAL_ENROLLMENT_STATE : state
}
