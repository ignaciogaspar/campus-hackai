'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SlideView } from '@/components/deck'
import { HtmlDeckStage } from '@/components/htmldeck'
import { OverlayView } from '@/components/live/OverlayView'
import { useOverlayData } from '@/components/live/useOverlayData'
import { deckSkin, parseSlide, slideContext } from '@/lib/decks/parse'
import type { SlideContext } from '@/lib/decks/types'
import { useLiveChannel } from '@/lib/realtime-client'
import { routes } from '@/lib/routes'
import type { MyMark, PollResults, StudentLiveSnapshot, StudentNote, StudentSlide } from '@/lib/student/types'
import { MarksBar } from './MarksBar'
import { NoteEditor } from './NoteEditor'
import { PollCard } from './PollCard'
import { TutorButton } from './TutorButton'
import { useSelectionIn } from './useSelection'
import { renderStudentInteractive } from './StudentInteractive'
import { useStudy } from './useStudy'
import './student.css'

/* Vista del alumno en vivo (/s/[code]), celular primero. Sigue la slide del
   profesor por Realtime; si navega para atrás, aparece «Volver al vivo». */

export interface LiveStudentProps {
  initial: StudentLiveSnapshot & { slides: StudentSlide[] }
  deckTitle: string
  contexto?: SlideContext
  /** null = invitado (solo sigue la clase y responde encuestas). */
  me: { personId: string; name: string } | null
  initialMarks: MyMark[]
  initialNotes: StudentNote[]
  /** Deck HTML estático (kind='html'): se muestra en iframe en vez de SlideView. */
  htmlUrl?: string | null
}

export function LiveStudent({ initial, deckTitle, contexto, me, initialMarks, initialNotes, htmlUrl }: LiveStudentProps) {
  const guest = me === null
  const [snap, setSnap] = useState<StudentLiveSnapshot>(initial)
  const [slides, setSlides] = useState<StudentSlide[]>(initial.slides)
  const [following, setFollowing] = useState(true)
  const [localIndex, setLocalIndex] = useState(initial.position)
  const [results, setResults] = useState<PollResults | null>(null)
  const versionRef = useRef(initial.deckVersion)
  /** Último live_sessions.seq aplicado: un estado más viejo (broadcast o fetch atrasado) se ignora. */
  const lastSeq = useRef(initial.seq ?? 0)
  const study = useStudy(snap.deckId, initialMarks, initialNotes, snap.status === 'live' ? snap.liveSessionId : null)
  const reloadStudy = study.reload
  const interactive = useMemo(() => renderStudentInteractive({ liveSessionId: snap.status === 'live' ? snap.liveSessionId : null, guest }), [snap.liveSessionId, snap.status, guest])

  const parsed = useMemo(() => slides.map((s) => parseSlide(s.markdown)), [slides])
  const ctx = useMemo(() => contexto ?? slideContext(parsed), [contexto, parsed])
  const skin = useMemo(() => deckSkin(parsed), [parsed])
  const total = slides.length
  const clamp = useCallback((i: number) => Math.min(Math.max(0, i), Math.max(0, total - 1)), [total])
  const livePos = clamp(snap.position)
  const index = following ? livePos : clamp(localIndex)
  const slide = slides[index]

  /* ---------- sincronización ---------- */

  const refresh = useCallback(async (withSlides = false) => {
    try {
      const res = await fetch(`/api/student/live/${snap.code}${withSlides ? '?slides=1' : ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const next = (await res.json()) as StudentLiveSnapshot
      if (typeof next.seq === 'number') {
        if (next.seq < lastSeq.current) return
        lastSeq.current = next.seq
      }
      if (!withSlides && next.deckVersion !== versionRef.current) return void refresh(true)
      if (next.slides) {
        setSlides(next.slides)
        versionRef.current = next.deckVersion
        // cambió el orden del deck: marcas y notas vuelven con sus posiciones nuevas
        if (!guest) void reloadStudy()
      }
      setSnap(next)
    } catch { /* sin red: se reintenta con el próximo evento o el sondeo */ }
  }, [snap.code, guest, reloadStudy])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback((withSlides = false) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void refresh(withSlides) }, withSlides ? 50 : 250)
  }, [refresh])

  const overlayData = useOverlayData(snap.liveSessionId, snap.overlay?.type === 'poll' ? null : snap.overlay)

  const { status } = useLiveChannel(snap.liveSessionId, (event, payload) => {
    if (event === 'postures.updated' || event === 'sim.updated' || event === 'marks.updated') {
      void overlayData.refresh()
      return
    }
    if (event === 'state') {
      const p = payload as { position?: number; overlay?: StudentLiveSnapshot['overlay']; deckVersion?: number; seq?: number }
      if (typeof p.seq === 'number') {
        if (p.seq < lastSeq.current) return
        lastSeq.current = p.seq
      }
      setSnap((s) => ({
        ...s,
        position: typeof p.position === 'number' ? p.position : s.position,
        overlay: p.overlay === undefined ? s.overlay : p.overlay,
      }))
      scheduleRefresh(typeof p.deckVersion === 'number' && p.deckVersion !== versionRef.current)
    } else if (event === 'deck.changed') {
      scheduleRefresh(true)
    } else if (event === 'poll.updated') {
      // el canal público trae solo {pollId, total}: si estoy viendo los
      // resultados de esa encuesta, los pido (el servidor decide si se ven)
      if (showingRef.current && showingRef.current === payload.pollId) setResultsTick((t) => t + 1)
    } else if (event !== 'marks.updated' && event !== 'transcript') {
      scheduleRefresh(false)
    }
  })

  useEffect(() => {
    if (status === 'subscribed') void refresh(false)
  }, [status, refresh])

  // Red de seguridad: sondeo por si se pierde un broadcast.
  useEffect(() => {
    if (snap.status !== 'live') return
    const t = setInterval(() => void refresh(false), status === 'subscribed' ? 15000 : 6000)
    return () => clearInterval(t)
  }, [refresh, status, snap.status])

  // Al volver de segundo plano (pantalla bloqueada) o recuperar la red, el
  // socket puede seguir «subscribed» sin recibir nada: resincronizá ya.
  useEffect(() => {
    const resync = () => { if (document.visibilityState === 'visible') void refresh(false) }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('pageshow', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('pageshow', resync)
    }
  }, [refresh])

  // Resultados de la encuesta cuando el profesor los proyecta.
  const overlay = snap.overlay
  const showingResultsOf = overlay?.type === 'poll' && overlay.showResults ? overlay.pollId : null
  const showingRef = useRef<string | null>(showingResultsOf)
  showingRef.current = showingResultsOf
  const [resultsTick, setResultsTick] = useState(0)
  useEffect(() => {
    if (!showingResultsOf) { setResults(null); return }
    let cancel = false
    fetch(`/api/student/poll/${showingResultsOf}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { results: PollResults | null } | null) => { if (!cancel) setResults(d?.results ?? null) })
      .catch(() => {})
    return () => { cancel = true }
  }, [showingResultsOf, resultsTick])

  // Al cambiar de slide, guardar la nota pendiente.
  const { flush } = study
  useEffect(() => { flush() }, [index, flush])

  /* ---------- navegación ---------- */

  function go(i: number) {
    const next = clamp(i)
    if (next === livePos && !following) setFollowing(true)
    else {
      setFollowing(next === livePos)
      setLocalIndex(next)
    }
  }

  const stageRef = useRef<HTMLDivElement>(null)
  const [selection, clearSelection] = useSelectionIn(stageRef)
  const ended = snap.status === 'ended'
  const poll = snap.activePoll

  return (
    <div className="st-vivo">
      <header className="st-cabecera">
        <div className="st-cabecera-titulo">
          <span className="kicker">Clase en vivo · {snap.code}</span>
          <strong>{deckTitle}</strong>
        </div>
        <span className={`badge ${ended ? '' : status === 'subscribed' ? 'badge-vivo' : 'badge-ficticio'}`}>
          {ended ? 'Terminó' : status === 'subscribed' ? 'En vivo' : 'Conectando…'}
        </span>
      </header>

      {ended ? (
        <div className="alerta alerta-aviso st-bloque">
          La clase terminó. {guest ? 'Gracias por participar.' : <>Tus marcas y notas quedaron guardadas: <Link href={routes.campusDeck(snap.deckId)}>repasá el deck</Link>.</>}
        </div>
      ) : null}

      <div ref={stageRef} className="st-escenario">
        {htmlUrl ? (
          <div className="st-html">
            <HtmlDeckStage
              htmlUrl={htmlUrl}
              position={index}
              locked={following}
              title={deckTitle}
              onPosition={(n, _total, from) => {
                if (from === 'deck') go(n)
              }}
            />
          </div>
        ) : slide ? (
          <SlideView slide={parsed[index]} index={index} total={total} contexto={ctx} fit="width" skin={skin} renderInteractive={interactive} />
        ) : <div className="vacio">Esperando la primera slide…</div>}
      </div>

      <nav className="st-nav" aria-label="Navegación de slides">
        <button type="button" className="btn btn-sm" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Slide anterior">←</button>
        <span className="st-nav-pos">
          {index + 1} / {total}
          {following && !ended ? <span className="st-nav-sigo"> · siguiendo al profe</span> : null}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => go(index + 1)} disabled={index >= total - 1} aria-label="Slide siguiente">→</button>
      </nav>
      {!following && !ended ? (
        <button type="button" className="btn btn-accion btn-block st-volver" onClick={() => setFollowing(true)}>
          Volver al vivo · slide {livePos + 1}
        </button>
      ) : null}

      {!ended && overlay && overlay.type !== 'poll' ? (
        <div className="st-bloque st-overlay-vivo" role="status" aria-live="polite">
          <OverlayView overlay={overlay} data={overlayData.data} variant="celular" />
          {overlay.type === 'postures' && !guest ? (
            <Link className="btn btn-sm" href={routes.campusCaso(overlay.caseId)}>Ver el caso y mi postura</Link>
          ) : null}
        </div>
      ) : null}

      {poll && !ended ? (
        <div className="st-bloque">
          <PollCard key={poll.id} poll={poll} guest={guest} results={showingResultsOf === poll.id ? results : null} compact />
        </div>
      ) : null}

      {guest ? (
        <div className="st-bloque alerta">
          Estás como invitado: podés seguir la clase y responder encuestas.{' '}
          <Link href={routes.liveStudent(snap.code)}>Ingresá con tu nombre</Link> para marcar slides y tomar notas.
        </div>
      ) : slide ? (
        <div className="st-bloque stack">
          <MarksBar active={study.marksAt(slide.position)} totals={study.totals} onToggle={(k) => void study.toggleMark(slide.position, k, slide.id)} />
          <NoteEditor
            key={`${snap.deckId}:${slide.position}`}
            deckId={snap.deckId}
            position={slide.position}
            initial={study.draftAt(slide.position)}
            onChange={(d) => study.editNote(slide.position, d, slide.id)}
            status={study.saveStatus}
            selection={selection}
            onSelectionUsed={clearSelection}
            compact
          />
          {study.error ? <p className="alerta alerta-error chico" role="alert">{study.error}</p> : null}
          <TutorButton deckId={snap.deckId} position={slide.position} slideId={slide.id} />
        </div>
      ) : null}
    </div>
  )
}
