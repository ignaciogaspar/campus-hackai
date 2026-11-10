'use client'

/* DeckPlayer: navega un deck slide por slide con teclado (← → espacio,
   PageUp/PageDown, Inicio/Fin, F pantalla completa). Puede ser controlado
   (index + onIndexChange) o no controlado (initialIndex). */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SlideView } from './SlideView'
import { deckSkin, parseSlide, slideContext, slideTitle } from '@/lib/decks/parse'
import type { DeckChapter, ParsedSlide, SlideContext } from '@/lib/decks/types'

export interface DeckPlayerSlide {
  /** slides.id, si viene de la DB. */
  id?: string
  /** Posición 0-based en el deck. */
  position?: number
  markdown: string
  title?: string | null
  /** Solo se muestran con showNotes. Nunca las mandes al alumno. */
  teacherNotes?: string | null
}

export interface DeckPlayerProps {
  slides: DeckPlayerSlide[]
  /** Materia de la banda de marca (default «AI-Centric Management»). */
  materia?: string
  /** Fuerza el contexto del chrome; si no, se deduce de la portada. */
  contexto?: SlideContext
  /** Índice controlado (0-based). */
  index?: number
  initialIndex?: number
  onIndexChange?: (index: number) => void
  renderInteractive?: (slide: ParsedSlide, index: number) => ReactNode
  /** Muestra las notas del docente debajo de la slide. */
  showNotes?: boolean
  /** Capítulos del deck (1-based sobre el deck base). */
  chapters?: DeckChapter[]
  /** Escucha el teclado a nivel ventana (default true). */
  keyboard?: boolean
  /** true: los <audio> de las slides 'iae' suenan (con su botón de arranque). */
  audio?: boolean
  /** Contenido extra debajo de la slide (marcas, notas del alumno, tutor…). */
  children?: ReactNode
}

export function DeckPlayer({
  slides, materia, contexto, index: controlled, initialIndex = 0, onIndexChange, renderInteractive,
  showNotes = false, chapters = [], keyboard = true, audio = false, children,
}: DeckPlayerProps) {
  const parsed = useMemo(() => slides.map((s) => parseSlide(s.markdown)), [slides])
  const ctx = useMemo(() => contexto ?? slideContext(parsed, materia), [contexto, parsed, materia])
  const skin = useMemo(() => deckSkin(parsed), [parsed])
  const [inner, setInner] = useState(initialIndex)
  const total = slides.length
  const index = Math.min(Math.max(0, controlled ?? inner), Math.max(0, total - 1))
  const box = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)

  const go = useCallback((i: number) => {
    const next = Math.min(Math.max(0, i), Math.max(0, total - 1))
    if (controlled === undefined) setInner(next)
    onIndexChange?.(next)
  }, [controlled, onIndexChange, total])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.()
  }, [])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!keyboard) return
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1) }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !target?.closest('button, a'))) { e.preventDefault(); go(index + 1) }
      else if (e.key === 'Home') { e.preventDefault(); go(0) }
      else if (e.key === 'End') { e.preventDefault(); go(total - 1) }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFull() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, go, index, total, toggleFull])

  if (total === 0) return <div className="dk-player dk-player--vacio">Este deck todavía no tiene slides.</div>

  const current = slides[index]
  const chapter = chapters.find((c) => c.firstSlide <= index + 1 && c.lastSlide >= index + 1)

  return (
    <div className="dk-player">
      <div className="dk-player-barra">
        <label className="dk-player-picker">
          <span>Diapositiva</span>
          <select value={index} onChange={(e) => go(Number(e.target.value))} aria-label="Ir a diapositiva">
            {parsed.map((p, i) => (
              <option key={slides[i].id ?? i} value={i}>{i + 1} · {slides[i].title ?? slideTitle(p)}</option>
            ))}
          </select>
        </label>
        {chapter ? <span className="dk-player-capitulo">{chapter.title} · {chapter.minutes} min</span> : null}
      </div>
      <div ref={box} className={`dk-player-escenario${full ? ' is-full' : ''}`}>
        <SlideView
          slide={parsed[index]}
          index={index}
          total={total}
          contexto={ctx}
          fit={full ? 'contain' : 'width'}
          skin={skin}
          audio={audio}
          renderInteractive={renderInteractive ? (s) => renderInteractive(s, index) : undefined}
        />
      </div>
      <div className="dk-player-controles">
        <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>← Anterior</button>
        <span className="dk-player-contador">{index + 1} / {total}</span>
        <button type="button" className="btn btn-ghost" onClick={toggleFull} title="Pantalla completa (F)">Pantalla completa</button>
        <button type="button" className="btn btn-primario" onClick={() => go(index + 1)} disabled={index === total - 1}>Siguiente →</button>
      </div>
      {showNotes && current.teacherNotes ? (
        <aside className="dk-player-notas">
          <h3>Notas del docente</h3>
          <p>{current.teacherNotes}</p>
        </aside>
      ) : null}
      {children}
    </div>
  )
}

export default DeckPlayer
