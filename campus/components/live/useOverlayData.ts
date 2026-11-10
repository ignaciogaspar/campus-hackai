'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Overlay } from '@/lib/db-types'
import type { OverlayData, PollSnapshot } from '@/lib/live/types'

/* Datos de un overlay (o de una slide interactiva) desde
   GET /api/live/<id>/overlay-data. Llamá `onLiveEvent(event, payload)` con
   los eventos del canal para mantener los conteos al día. */

const NEEDS_DATA = new Set(['poll', 'postures', 'confusion', 'sim', 'student'])
const POLL_EVERY: Record<string, number> = { poll: 8000, postures: 6000, confusion: 5000, sim: 5000 }

export function overlayKey(overlay: Overlay | null | undefined): string | null {
  if (!overlay || !NEEDS_DATA.has(overlay.type)) return null
  switch (overlay.type) {
    case 'poll': return `poll:${overlay.pollId}`
    case 'postures': return `postures:${overlay.caseId}`
    case 'confusion': return `confusion:${overlay.position}`
    case 'sim': return `sim:${overlay.simId}`
    case 'student': return `student:${overlay.personId}`
    default: return null
  }
}

export function useOverlayData(liveSessionId: string, overlay: Overlay | null | undefined) {
  const [data, setData] = useState<OverlayData | null>(null)
  const key = overlayKey(overlay)
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay

  const refresh = useCallback(async () => {
    const o = overlayRef.current
    if (!o || !overlayKey(o)) return
    try {
      const res = await fetch(`/api/live/${liveSessionId}/overlay-data?overlay=${encodeURIComponent(JSON.stringify(o))}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as OverlayData
      if (overlayKey(overlayRef.current) === overlayKey(o)) setData(json)
    } catch {
      // red caída: se reintenta en el próximo intervalo
    }
  }, [liveSessionId])

  useEffect(() => {
    setData(null)
    if (!key) return
    void refresh()
    const every = POLL_EVERY[key.split(':')[0]]
    if (!every) return
    const t = setInterval(() => void refresh(), every)
    return () => clearInterval(t)
  }, [key, refresh])

  /** Aplica `poll.updated` sin ir al servidor. */
  const onLiveEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    if (event !== 'poll.updated') return
    setData((prev) => {
      if (!prev || prev.type !== 'poll' || prev.poll.pollId !== payload.pollId) return prev
      const poll: PollSnapshot = {
        ...prev.poll,
        total: typeof payload.total === 'number' ? payload.total : prev.poll.total,
        counts: (payload.counts as Record<string, number> | undefined) ?? prev.poll.counts,
        texts: (payload.texts as string[] | undefined) ?? prev.poll.texts,
        status: payload.status === 'closed' ? 'closed' : prev.poll.status,
      }
      return { type: 'poll', poll }
    })
  }, [])

  return { data: key ? data : null, refresh, onLiveEvent }
}
