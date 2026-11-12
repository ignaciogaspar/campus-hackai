/* Cuándo se vuelve a leer el espacio abierto: cada tanto mientras la pestaña
   está a la vista, nada mientras está oculta (otra pestaña, el celular
   bloqueado) y enseguida al volver a ella; solo en el espacio de una materia.
   Lo usa LiveRefresh. */

/** El espacio de una materia, `/materias/<id>`: ni la lista de materias ni otras pantallas. */
export function isSpacePath(pathname: string): boolean {
  return /^\/materias\/[^/]+$/.test(pathname)
}

/** La marca que deja la página del espacio (`data-just-read` en su `<main>`) cuando el canal que
    abrió tenía no leídos: la barra lateral, que no se vuelve a dibujar al navegar, quedó vieja. */
export const JUST_READ_SELECTOR = '[data-just-read]'

/** Lo que hace falta de `document`: si la pestaña está a la vista y el aviso de cuando cambia. */
export type VisiblePage = {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/** Llama a `refresh` cada `everyMs` con la pestaña a la vista, y al volver a ella. Devuelve cómo pararlo. */
export function refreshWhileVisible(page: VisiblePage, refresh: () => void, everyMs: number): () => void {
  let timer: ReturnType<typeof setInterval> | undefined

  const start = () => {
    timer = setInterval(refresh, everyMs)
  }
  const pause = () => {
    clearInterval(timer)
    timer = undefined
  }
  const onChange = () => {
    pause()
    if (page.visibilityState !== 'visible') return
    refresh()
    start()
  }

  page.addEventListener('visibilitychange', onChange)
  if (page.visibilityState === 'visible') start()
  return () => {
    page.removeEventListener('visibilitychange', onChange)
    pause()
  }
}
