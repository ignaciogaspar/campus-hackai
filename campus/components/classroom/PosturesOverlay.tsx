'use client'

import { useEffect, useState } from 'react'
import type { PostureDistribution } from '@/lib/classroom/types'
import { PostureBars } from './PostureBars'
import './classroom.css'

/**
 * Overlay `postures` para el proyector o el celular: trae la distribución
 * anónima de GET /api/classroom/cases/<caseId>/postures y la refresca cada
 * `pollMs` o cuando cambia `refreshKey` (subilo al recibir el broadcast
 * `postures.updated`). Si ya tenés los counts del broadcast, pasalos en `initial`.
 */
export function PosturesOverlay({ caseId, title, refreshKey = 0, pollMs = 10000, initial, size = 'grande' }: {
  caseId: string
  title?: string
  refreshKey?: number
  pollMs?: number
  initial?: PostureDistribution | null
  size?: 'normal' | 'grande'
}) {
  const [dist, setDist] = useState<PostureDistribution | null>(initial ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/classroom/cases/${encodeURIComponent(caseId)}/postures`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as PostureDistribution
        if (alive) { setDist(data); setError(false) }
      } catch {
        if (alive) setError(true)
      }
    }
    void load()
    const t = pollMs > 0 ? setInterval(load, pollMs) : null
    return () => { alive = false; if (t) clearInterval(t) }
  }, [caseId, refreshKey, pollMs])

  return (
    <div className="cl-overlay" aria-live="polite">
      <div>
        <div className="kicker">Posturas de la cohorte</div>
        <h2>{title ?? dist?.question ?? 'Cargando…'}</h2>
      </div>
      {dist ? (
        <>
          <PostureBars counts={dist.counts} total={dist.total} size={size} showConfidence />
          <p className="muted chico" style={{ margin: 0 }}>{dist.total} de {dist.roster} alumnos tomaron postura</p>
        </>
      ) : error ? <p className="muted">No se pudo cargar la distribución.</p> : null}
    </div>
  )
}
