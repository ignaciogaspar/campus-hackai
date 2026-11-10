'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivityView } from '@/lib/actividades/service'

export type OpStatus = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string }

/**
 * Vista de una actividad con refresco periódico (parejas, cronómetro y
 * votación los cambia el profesor). `op` manda una operación y actualiza.
 */
export function useActivity(activityId: string, initial: ActivityView, pollMs = 6000) {
  const [view, setView] = useState<ActivityView>(initial)
  const [status, setStatus] = useState<OpStatus>({ kind: 'idle' })
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    try {
      const res = await fetch(`/api/actividades/${activityId}`, { cache: 'no-store' })
      if (res.ok) setView(await res.json())
    } catch {
      // sin red: se reintenta en el próximo ciclo
    }
  }, [activityId])

  useEffect(() => {
    if (!pollMs) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  const op = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    busy.current = true
    setStatus({ kind: 'busy' })
    try {
      const res = await fetch(`/api/actividades/${activityId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ kind: 'error', text: data.error ?? 'No se pudo guardar.' })
        return false
      }
      if (data.view) setView(data.view)
      setStatus({ kind: 'ok', text: data.message ?? 'Listo.' })
      return true
    } catch {
      setStatus({ kind: 'error', text: 'Sin conexión. Probá de nuevo.' })
      return false
    } finally {
      busy.current = false
    }
  }, [activityId])

  return { view, status, op, refresh }
}

export function StatusText({ status }: { status: OpStatus }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'busy') return <span className="ac-estado">Guardando…</span>
  return <span className={`ac-estado ac-estado-${status.kind === 'ok' ? 'ok' : 'error'}`} role="status">{status.text}</span>
}
