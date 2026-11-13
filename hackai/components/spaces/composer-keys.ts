/* Qué teclas mandan el mensaje desde el campo para escribir. En la compu,
   Enter envía y Shift+Enter salta de línea, como en cualquier chat. En el
   celular Enter sigue saltando de línea: el teclado de la pantalla no tiene
   Shift+Enter a mano y el botón de enviar queda al lado. Ctrl o ⌘ + Enter
   envía siempre. En Avisos, Enter salta de línea también en la compu: un aviso
   le llega a toda la comisión y no se publica a medio escribir. Mientras se compone una letra (una tilde con tecla muerta,
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
  /** Es un aviso para toda la comisión: se publica con el botón o con Ctrl o ⌘ + Enter. */
  announcement?: boolean
}

export function sendsOnKey(event: ComposerKey, { finePointer, canSend, announcement }: ComposerContext): boolean {
  if (event.key !== 'Enter' || event.isComposing || !canSend) return false
  if (event.ctrlKey || event.metaKey) return true
  return finePointer && !event.shiftKey && !announcement
}
