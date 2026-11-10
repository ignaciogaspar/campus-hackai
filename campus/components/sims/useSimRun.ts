'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SimEventInput, SimRun, SimRunStartResponse } from '@/lib/sims/types'

/* Corrida de un simulador desde el navegador: crea o retoma la corrida,
   junta eventos y los manda en lotes, guarda el estado con debounce y cierra.
   Lo usan SimFrame (sims HTML en iframe) y los sims React. */

export interface UseSimRunOptions {
  simId: string
  liveSessionId?: string | null
  /** Corrida en curso que ya trajo la página server (evita un round-trip). */
  initialRun?: SimRun | null
}

export interface SimRunApi {
  run: SimRun | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  /** Crea o retoma la corrida. Con fresh=true abandona la en curso y arranca otra. */
  start: (opts?: { fresh?: boolean; meta?: Record<string, unknown> }) => Promise<SimRun>
  emit: (type: string, payload?: Record<string, unknown>) => void
  decision: (key: string, value: string, extra?: { label?: string; valueLabel?: string; [k: string]: unknown }) => void
  saveState: (state: Record<string, unknown>, opts?: { immediate?: boolean }) => void
  complete: (result: { score?: number | null; summary?: Record<string, unknown>; state?: Record<string, unknown> }) => Promise<SimRun>
  flush: () => Promise<void>
}

async function postJson<T>(url: string, body: unknown, keepalive = false): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
  return data as T
}

export function useSimRun({ simId, liveSessionId = null, initialRun = null }: UseSimRunOptions): SimRunApi {
  const [run, setRun] = useState<SimRun | null>(initialRun)
  const [status, setStatus] = useState<SimRunApi['status']>(initialRun ? 'ready' : 'idle')
  const [error, setError] = useState<string | null>(null)

  const runRef = useRef<SimRun | null>(initialRun)
  const startingRef = useRef<Promise<SimRun> | null>(null)
  const queueRef = useRef<SimEventInput[]>([])
  const stateRef = useRef<Record<string, unknown> | null>(null)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushing = useRef(false)

  const setCurrent = useCallback((r: SimRun) => {
    runRef.current = r
    setRun(r)
    setStatus('ready')
    setError(null)
  }, [])

  const start = useCallback<SimRunApi['start']>(async (opts = {}) => {
    if (!opts.fresh && runRef.current && runRef.current.status === 'en-curso') return runRef.current
    if (!opts.fresh && startingRef.current) return startingRef.current
    setStatus('loading')
    const p = postJson<SimRunStartResponse>('/api/sims/runs', { simId, liveSessionId, fresh: Boolean(opts.fresh), meta: opts.meta })
      .then((res) => { setCurrent(res.run); return res.run })
      .catch((err: Error) => { setStatus('error'); setError(err.message); throw err })
      .finally(() => { startingRef.current = null })
    startingRef.current = p
    return p
  }, [simId, liveSessionId, setCurrent])

  const flushEvents = useCallback(async (keepalive = false) => {
    const r = runRef.current
    if (!r || queueRef.current.length === 0 || flushing.current) return
    flushing.current = true
    const batch = queueRef.current.splice(0, 50)
    try {
      await postJson(`/api/sims/${r.id}/events`, { events: batch }, keepalive)
    } catch {
      // se reintenta en el próximo flush (sin duplicar: volvemos a encolar adelante)
      queueRef.current.unshift(...batch)
    } finally {
      flushing.current = false
    }
  }, [])

  const flushState = useCallback(async (keepalive = false) => {
    if (stateTimer.current) { clearTimeout(stateTimer.current); stateTimer.current = null }
    const r = runRef.current
    const s = stateRef.current
    if (!r || !s || r.status !== 'en-curso') return
    stateRef.current = null
    try {
      await postJson(`/api/sims/${r.id}/state`, { state: s }, keepalive)
    } catch {
      stateRef.current = stateRef.current ?? s
    }
  }, [])

  const flush = useCallback(async () => {
    await flushEvents()
    await flushState()
  }, [flushEvents, flushState])

  const emit = useCallback<SimRunApi['emit']>((type, payload = {}) => {
    queueRef.current.push({ type, payload, at: Date.now() })
    if (queueRef.current.length >= 20) void flushEvents()
  }, [flushEvents])

  const decision = useCallback<SimRunApi['decision']>((key, value, extra = {}) => {
    emit('decision', { ...extra, key, value })
  }, [emit])

  const saveState = useCallback<SimRunApi['saveState']>((state, opts = {}) => {
    stateRef.current = state
    if (stateTimer.current) clearTimeout(stateTimer.current)
    if (opts.immediate) void flushState()
    else stateTimer.current = setTimeout(() => void flushState(), 900)
  }, [flushState])

  const complete = useCallback<SimRunApi['complete']>(async (result) => {
    const r = runRef.current ?? await start()
    await flushEvents()
    stateRef.current = null
    const res = await postJson<{ run: SimRun }>(`/api/sims/${r.id}/complete`, result)
    setCurrent(res.run)
    return res.run
  }, [start, flushEvents, setCurrent])

  // Envío periódico y al salir de la página
  useEffect(() => {
    const t = setInterval(() => void flushEvents(), 2000)
    const onHide = () => { void flushEvents(true); void flushState(true) }
    const onVis = () => { if (document.visibilityState === 'hidden') onHide() }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
      onHide()
    }
  }, [flushEvents, flushState])

  return { run, status, error, start, emit, decision, saveState, complete, flush }
}
