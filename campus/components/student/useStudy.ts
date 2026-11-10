'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  markTotals, type MarkKind, type MarkTotals, type MyMark, type NoteVisibility, type StudentNote, type ToggleMarkResult,
} from '@/lib/student/types'

/* Estado de marcas y notas propias de un deck, compartido por /s/[code] y
   /campus/decks/[id]. Marcas optimistas; notas con autoguardado debounced. */

export interface NoteDraft {
  body: string
  quote: string | null
  visibility: NoteVisibility
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface StudyState {
  marks: MyMark[]
  totals: MarkTotals
  notes: Map<number, StudentNote>
  marksAt: (position: number) => MarkKind[]
  /** `slideId`: la slide que se está viendo (si el deck cambia en el medio, la marca va a esa slide). */
  toggleMark: (position: number, kind: MarkKind, slideId?: string) => Promise<void>
  /** Programa el guardado de la nota de esa slide (debounce). `slideId` viaja con la nota pendiente. */
  editNote: (position: number, draft: NoteDraft, slideId?: string) => void
  /** Vuelve a pedir marcas y notas (después de que el deck cambió de orden). */
  reload: () => Promise<void>
  /** Guarda ya lo pendiente (al cambiar de slide o salir). */
  flush: () => void
  /** Borrador vigente de una slide: lo pendiente de guardar o la nota guardada. */
  draftAt: (position: number) => NoteDraft
  saveStatus: SaveStatus
  error: string | null
}

const DEBOUNCE_MS = 900

export function useStudy(deckId: string, initialMarks: MyMark[], initialNotes: StudentNote[], liveSessionId?: string | null): StudyState {
  const [marks, setMarks] = useState<MyMark[]>(initialMarks)
  const [notes, setNotes] = useState<Map<number, StudentNote>>(() => new Map(initialNotes.map((n) => [n.position, n])))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const liveRef = useRef(liveSessionId ?? null)
  liveRef.current = liveSessionId ?? null

  const marksAt = useCallback((position: number) => marks.filter((m) => m.position === position).map((m) => m.kind), [marks])

  const toggleMark = useCallback(async (position: number, kind: MarkKind, slideId?: string) => {
    const was = marks.some((m) => m.position === position && m.kind === kind)
    const apply = (on: boolean) => setMarks((prev) => {
      const rest = prev.filter((m) => !(m.position === position && m.kind === kind))
      return on ? [...rest, { position, kind }] : rest
    })
    apply(!was)
    try {
      const res = await fetch('/api/student/marks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deckId, position, slideId, kind, active: !was, liveSessionId: liveRef.current }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
      const out = (await res.json()) as ToggleMarkResult
      apply(out.active)
      setError(null)
    } catch (e) {
      apply(was)
      setError(`No se pudo guardar la marca: ${(e as Error).message}`)
    }
  }, [deckId, marks])

  // Notas: un pendiente por posición; se manda de a uno, con la slide que se estaba viendo.
  const pending = useRef(new Map<number, NoteDraft>())
  const pendingSlide = useRef(new Map<number, string | undefined>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)

  const send = useCallback(async (keepalive = false) => {
    if (inFlight.current && !keepalive) return
    const entries = [...pending.current.entries()].map(([p, d]) => [p, d, pendingSlide.current.get(p)] as const)
    if (entries.length === 0) return
    pending.current.clear()
    pendingSlide.current.clear()
    inFlight.current = true
    setSaveStatus('saving')
    try {
      for (const [position, draft, slideId] of entries) {
        const res = await fetch('/api/student/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          keepalive,
          body: JSON.stringify({ deckId, position, slideId, ...draft, liveSessionId: liveRef.current }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
        const { note } = (await res.json()) as { note: StudentNote | null }
        setNotes((prev) => {
          const next = new Map(prev)
          // la posición vigente la dice el servidor (si el deck cambió, ya no es la del pendiente)
          if (note) {
            if (note.position !== position && prev.get(position)?.slideId === note.slideId) next.delete(position)
            next.set(note.position, note)
          } else next.delete(position)
          return next
        })
      }
      setSaveStatus(pending.current.size ? 'pending' : 'saved')
      setError(null)
    } catch (e) {
      // Se reintenta con la próxima edición: devolvemos lo no guardado.
      for (const [p, d, sid] of entries) if (!pending.current.has(p)) { pending.current.set(p, d); pendingSlide.current.set(p, sid) }
      setSaveStatus('error')
      setError(`No se pudo guardar la nota: ${(e as Error).message}`)
    } finally {
      inFlight.current = false
      if (pending.current.size && !timer.current) timer.current = setTimeout(() => { timer.current = null; void send() }, DEBOUNCE_MS)
    }
  }, [deckId])

  const editNote = useCallback((position: number, draft: NoteDraft, slideId?: string) => {
    pending.current.set(position, draft)
    pendingSlide.current.set(position, slideId)
    setSaveStatus('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void send() }, DEBOUNCE_MS)
  }, [send])

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    void send()
  }, [send])

  useEffect(() => {
    const onHide = () => {
      if (pending.current.size) {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        void send(true)
      }
    }
    window.addEventListener('pagehide', onHide)
    const onVis = () => { if (document.visibilityState === 'hidden') onHide() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [send])

  const totals = useMemo(() => markTotals(marks), [marks])

  const reload = useCallback(async () => {
    try {
      const [m, n] = await Promise.all([
        fetch(`/api/student/marks?deckId=${encodeURIComponent(deckId)}`, { cache: 'no-store' }),
        fetch(`/api/student/notes?deckId=${encodeURIComponent(deckId)}`, { cache: 'no-store' }),
      ])
      if (m.ok) setMarks(((await m.json()) as { marks: MyMark[] }).marks)
      if (n.ok) {
        const list = ((await n.json()) as { notes: StudentNote[] }).notes
        setNotes(new Map(list.map((x) => [x.position, x])))
      }
    } catch { /* se reintenta con el próximo cambio */ }
  }, [deckId])

  const draftAt = useCallback((position: number): NoteDraft => {
    const p = pending.current.get(position)
    if (p) return p
    const n = notes.get(position)
    return { body: n?.body ?? '', quote: n?.quote ?? null, visibility: n?.visibility ?? 'privada' }
  }, [notes])

  return { marks, totals, notes, marksAt, toggleMark, editNote, flush, reload, draftAt, saveStatus, error }
}
