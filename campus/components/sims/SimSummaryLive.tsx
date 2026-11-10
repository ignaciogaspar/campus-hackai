'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLiveChannel } from '@/lib/realtime-client'
import type { SimSummary } from '@/lib/sims/types'
import { SimSummaryView } from './SimSummaryView'
import './sims.css'

/* Resumen de un sim que se actualiza solo: para el overlay `sim` del proyector
   (/live/[id]) o la vista del profesor. Escucha `sim.updated` en el canal de
   la clase y además refresca cada `pollMs`. */

interface Props {
  simId: string
  liveSessionId?: string | null
  initial?: SimSummary | null
  pollMs?: number
  big?: boolean
  maxDecisions?: number
}

export function SimSummaryLive({ simId, liveSessionId = null, initial = null, pollMs = 8000, big = false, maxDecisions }: Props) {
  const [summary, setSummary] = useState<SimSummary | null>(initial)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ simId })
      if (liveSessionId) qs.set('live', liveSessionId)
      const res = await fetch(`/api/sims/summary?${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setSummary(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar')
    }
  }, [simId, liveSessionId])

  useEffect(() => {
    if (!initial) void load()
    const t = setInterval(() => void load(), pollMs)
    return () => clearInterval(t)
  }, [load, pollMs, initial])

  useLiveChannel(liveSessionId, (event, payload) => {
    if (event === 'sim.updated' && payload.simId === simId) void load()
  })

  if (!summary) return <p className="chico muted">{error ?? 'Cargando resultados…'}</p>
  return <SimSummaryView summary={summary} big={big} maxDecisions={maxDecisions} />
}
