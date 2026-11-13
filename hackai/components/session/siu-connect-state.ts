/* Cómo quedó un intento de entrar con la cuenta del SIU: todavía nada, o un error para mostrar. Si sale bien, la
   acción lleva al inicio. */
export type ConnectState = { kind: 'inicial' } | { kind: 'error'; message: string }

export const INITIAL_CONNECT_STATE: ConnectState = { kind: 'inicial' }
