/* Qué teclas mandan el mensaje desde el campo para escribir. En la compu,
   Enter envía y Shift+Enter salta de línea, como en cualquier chat. En el
   celular Enter sigue saltando de línea: el teclado de la pantalla no tiene
   Shift+Enter a mano y el botón de enviar queda al lado. Ctrl o ⌘ + Enter
   envía siempre. Mientras se compone una letra (una tilde con tecla muerta,
   un teclado japonés), Enter confirma la letra y no envía. */

export type ComposerKey = {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  isComposing: boolean
}

export type ComposerContext = {
  /** Mouse o trackpad: `(hover: hover) and (pointer: fine)`. Así se distingue la compu, no por el ancho. */
  finePointer: boolean
  /** Hay algo para mandar y no se está mandando. */
  canSend: boolean
}

export function sendsOnKey(event: ComposerKey, { finePointer, canSend }: ComposerContext): boolean {
  if (event.key !== 'Enter' || event.isComposing || !canSend) return false
  if (event.ctrlKey || event.metaKey) return true
  return finePointer && !event.shiftKey
}
