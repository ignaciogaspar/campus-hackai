/** Estado que devuelven las server actions de entregas a useActionState. */
export interface ActionState {
  ok?: string
  error?: string
  /** Cambia en cada envío para que el cliente pueda reaccionar. */
  at?: number
}

export const INITIAL_ACTION_STATE: ActionState = {}
