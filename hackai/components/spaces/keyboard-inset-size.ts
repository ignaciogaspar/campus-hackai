/* Cuánto tapa el teclado del teléfono el pie de la pantalla. Safari en el
   iPhone y Chrome en Android no achican la página al abrir el teclado: lo
   ponen encima y achican solo la parte visible (`visualViewport`). Lo fijo
   abajo, como el campo para escribir, queda detrás del teclado si no se
   sube a mano. Lo usa KeyboardInset. */

/** Menos que esto no es un teclado: es la barra del navegador que se esconde o aparece. */
const MIN_KEYBOARD = 100

export type ViewportSize = {
  /** `window.innerHeight`: el alto de la página, que no cambia con el teclado. */
  layoutHeight: number
  /** `visualViewport.height`: lo que se ve. */
  viewportHeight: number
  /** `visualViewport.offsetTop`: cuánto corrió el navegador la parte visible para mostrar el campo. */
  viewportTop: number
  /** Si hay un campo de texto con el foco: sin eso no hay teclado, aunque se haga zoom. */
  typing: boolean
}

/** Los píxeles entre el borde de abajo de lo que se ve y el de la página; 0 sin teclado. */
export function keyboardInset({ layoutHeight, viewportHeight, viewportTop, typing }: ViewportSize): number {
  if (!typing || layoutHeight - viewportHeight < MIN_KEYBOARD) return 0
  return Math.max(0, Math.round(layoutHeight - viewportHeight - viewportTop))
}
