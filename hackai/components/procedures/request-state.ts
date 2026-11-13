/* Cómo quedó un pedido de constancia: todavía nada, pedida (con el mensaje del
   SIU), con un error para mostrar, o que hay que pedirla en la Autogestión. */
export type RequestState =
  | { kind: 'inicial' }
  | { kind: 'pedida'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'autogestion' }

export const INITIAL_REQUEST_STATE: RequestState = { kind: 'inicial' }
