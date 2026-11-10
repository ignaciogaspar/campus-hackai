'use client'

/* HtmlDeckStage: muestra un deck HTML estático (decks.kind = 'html') en un iframe
   same-origin y lo controla por postMessage con public/decks/<id>/campus-bridge.js.

   - `position` (0-based) es controlada: cuando cambia, el deck navega.
   - `onPosition(n, total, from)` avisa cuando el deck cambió de slide. `from` vale
     'deck' si navegaron adentro del iframe (teclado/clic del profesor) y 'campus'
     si fue el eco de un `position` que puso el padre.
   - `onOutline(slides)` recibe el texto de cada slide (kicker, título, texto, notas)
     cuando el deck carga. Las notas solo llegan con `withNotes` (para el profesor).
   - `locked` bloquea la navegación propia del deck (vista del alumno que sigue al profesor).
   - El iframe ocupa el 100% de su contenedor; el deck se escala solo a 16:9 adentro.
   Ver components/htmldeck/README.md para cablearlo en /live/[id] y /s/[code]. */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { htmlDeckSrc, isBridgeEvent } from '@/lib/htmldeck/types'
import type { BridgeCommand, HtmlDeckOutlineSlide } from '@/lib/htmldeck/types'

export interface HtmlDeckStageProps {
  /** decks.html_url, p. ej. '/decks/empresas-familiares/index.html'. */
  htmlUrl: string
  /** Slide visible (0-based). */
  position: number
  onPosition?: (n: number, total: number, from: 'deck' | 'campus') => void
  onReady?: (total: number) => void
  onOutline?: (slides: HtmlDeckOutlineSlide[]) => void
  /** Incluye las notas del presentador en el outline (solo profesor). */
  withNotes?: boolean
  /** Bloquea teclado/clic de navegación dentro del deck. */
  locked?: boolean
  /** Muestra la botonera y el contador propios del deck (default false). */
  chrome?: boolean
  title?: string
  className?: string
  style?: CSSProperties
}

export interface HtmlDeckStageHandle {
  /** Vuelve a pedir el outline (llega por onOutline). */
  requestOutline: () => void
  /** Pone el foco en el iframe (para que el teclado navegue el deck). */
  focus: () => void
}

export const HtmlDeckStage = forwardRef<HtmlDeckStageHandle, HtmlDeckStageProps>(function HtmlDeckStage(
  { htmlUrl, position, onPosition, onReady, onOutline, withNotes = false, locked = false, chrome = false, title, className, style },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null)
  // src fijo: la posición inicial va en el hash; después se navega por postMessage (sin recargar).
  const [src] = useState(() => htmlDeckSrc(htmlUrl, position, !chrome))
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  const shown = useRef<number | null>(null)
  const requested = useRef<number | null>(null)
  const cbs = useRef({ onPosition, onReady, onOutline, withNotes })
  cbs.current = { onPosition, onReady, onOutline, withNotes }

  const post = useCallback((cmd: BridgeCommand) => {
    const win = frame.current?.contentWindow
    if (win) win.postMessage(cmd, window.location.origin)
  }, [])

  useImperativeHandle(ref, () => ({
    requestOutline: () => post({ type: 'outline' }),
    focus: () => frame.current?.focus(),
  }), [post])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data
      if (!isBridgeEvent(d)) return
      if (d.type === 'outline') {
        const slides = cbs.current.withNotes ? d.slides : d.slides.map((s) => ({ ...s, notes: '' }))
        cbs.current.onOutline?.(slides)
        return
      }
      shown.current = d.n
      // El primer mensaje (ready o la respuesta a 'state') marca el deck como listo:
      // si el iframe cargó antes de hidratar, el 'ready' del bridge se perdió.
      const first = !readyRef.current
      if (first) {
        readyRef.current = true
        setReady(true)
        cbs.current.onReady?.(d.total)
        if (cbs.current.onOutline) post({ type: 'outline' })
      }
      // El primer aviso es el eco de la posición inicial que puso el campus.
      const from = first || requested.current === d.n ? 'campus' : 'deck'
      if (from === 'campus') requested.current = null
      cbs.current.onPosition?.(d.n, d.total, from)
    }
    window.addEventListener('message', onMessage)
    post({ type: 'state' })
    return () => window.removeEventListener('message', onMessage)
  }, [post])

  // Navegación controlada.
  useEffect(() => {
    if (!ready || shown.current === position) return
    requested.current = position
    post({ type: 'goto', n: position })
  }, [position, ready, post])

  useEffect(() => {
    if (ready) post({ type: 'lock', locked })
  }, [locked, ready, post])

  useEffect(() => {
    if (ready) post({ type: 'chrome', visible: chrome })
  }, [chrome, ready, post])

  return (
    <iframe
      ref={frame}
      src={src}
      title={title ?? 'Presentación'}
      className={className}
      allow="fullscreen; autoplay"
      allowFullScreen
      onLoad={() => post({ type: 'state' })}
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#fff', ...style }}
    />
  )
})
