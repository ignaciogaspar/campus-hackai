import 'server-only'
import { db } from '@/lib/db'
import { getSimDef } from './registry'
import { listCohortRuns, type CohortRun } from './server'
import type { SimDecisionPayload, SimSummary } from './types'

/* Resumen agregado de un simulador para el overlay del proyector y la vista
   del profesor. Si viene liveSessionId, solo cuenta las corridas abiertas
   desde esa clase en vivo. */

const BUCKETS = [
  { label: '0–19', min: 0, max: 19.999 },
  { label: '20–39', min: 20, max: 39.999 },
  { label: '40–59', min: 40, max: 59.999 },
  { label: '60–79', min: 60, max: 79.999 },
  { label: '80–100', min: 80, max: 100 },
]

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function simSummary(simId: string, liveSessionId?: string | null): Promise<SimSummary> {
  const def = getSimDef(simId)
  const runs = await listCohortRuns(simId, liveSessionId ?? null)
  return summarize(simId, def?.title ?? simId, def?.scoreLabel ?? null, liveSessionId ?? null, runs, await decisionEvents(runs))
}

interface DecisionRow { run_id: string; payload: SimDecisionPayload & Record<string, unknown> }

async function decisionEvents(runs: CohortRun[]): Promise<DecisionRow[]> {
  const ids = runs.map((r) => r.id)
  const out: DecisionRow[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await db().from('sim_events').select('run_id, payload')
      .eq('type', 'decision').in('run_id', ids.slice(i, i + 150)).order('id', { ascending: true }).limit(20000)
    out.push(...((data ?? []) as DecisionRow[]))
  }
  return out
}

/** Pura: separada para testear. */
export function summarize(
  simId: string,
  title: string,
  scoreLabel: string | null,
  liveSessionId: string | null,
  runs: Array<Pick<CohortRun, 'id' | 'personId' | 'status' | 'score' | 'summary'>>,
  decisions: DecisionRow[],
): SimSummary {
  const completed = runs.filter((r) => r.status === 'completada')
  const scores = completed.map((r) => r.score).filter((s): s is number => typeof s === 'number')
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null

  // Última decisión por corrida y clave
  const last = new Map<string, SimDecisionPayload>()
  const keyLabel = new Map<string, string>()
  const valueLabel = new Map<string, string>()
  for (const d of decisions) {
    const p = d.payload
    if (!p || typeof p.key !== 'string' || p.value === undefined || p.value === null) continue
    const value = String(p.value)
    last.set(`${d.run_id}\u0000${p.key}`, { key: p.key, value })
    if (typeof p.label === 'string') keyLabel.set(p.key, p.label)
    if (typeof p.valueLabel === 'string') valueLabel.set(`${p.key}\u0000${value}`, p.valueLabel)
  }
  const byKey = new Map<string, Map<string, number>>()
  for (const d of last.values()) {
    const m = byKey.get(d.key) ?? new Map<string, number>()
    m.set(d.value, (m.get(d.value) ?? 0) + 1)
    byKey.set(d.key, m)
  }
  const decisionsOut = [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([key, m]) => {
      const options = [...m.entries()]
        .map(([value, count]) => ({ value, label: valueLabel.get(`${key}\u0000${value}`) ?? value, count }))
        .sort((a, b) => b.count - a.count)
      return { key, label: keyLabel.get(key) ?? key, total: options.reduce((a, o) => a + o.count, 0), options }
    })

  const headlines = new Map<string, number>()
  for (const r of completed) {
    const h = r.summary?.headline
    if (typeof h === 'string' && h.trim()) headlines.set(h.trim(), (headlines.get(h.trim()) ?? 0) + 1)
  }

  return {
    simId,
    title,
    liveSessionId,
    scoreLabel,
    runs: runs.length,
    participants: new Set(runs.map((r) => r.personId).filter(Boolean)).size,
    completed: completed.length,
    inProgress: runs.filter((r) => r.status === 'en-curso').length,
    avgScore: avg,
    medianScore: median(scores),
    scoreBuckets: BUCKETS.map((b) => ({ ...b, count: scores.filter((s) => s >= b.min && s <= b.max).length })),
    decisions: decisionsOut,
    headlines: [...headlines.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    updatedAt: new Date().toISOString(),
  }
}
