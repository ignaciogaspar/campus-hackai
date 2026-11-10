import 'server-only'
import { db } from '@/lib/db'
import { broadcast } from '@/lib/realtime'
import type { Session } from '@/lib/session-token'
import { SIM_LIMITS, type SimEventInput, type SimRun, type SimRunStatus } from './types'

/* Persistencia de corridas de simuladores (sim_runs / sim_events).
   Todo pasa por acá: las rutas /api/sims/* y las páginas server. */

interface RunRow {
  id: string
  sim_id: string
  person_id: string | null
  live_session_id: string | null
  status: SimRunStatus
  score: number | string | null
  summary: Record<string, unknown> | null
  state: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
}

const RUN_COLUMNS = 'id, sim_id, person_id, live_session_id, status, score, summary, state, started_at, completed_at'

export function toRun(r: RunRow): SimRun {
  return {
    id: r.id,
    simId: r.sim_id,
    personId: r.person_id,
    liveSessionId: r.live_session_id,
    status: r.status,
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    summary: r.summary ?? {},
    state: r.state ?? {},
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }
}

export class SimError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

function bytes(v: unknown): number {
  return Buffer.byteLength(JSON.stringify(v ?? null), 'utf8')
}

export async function simExists(simId: string): Promise<boolean> {
  const { data } = await db().from('sim_definitions').select('id').eq('id', simId).maybeSingle()
  return Boolean(data)
}

/** Clase en vivo válida (o null si el id no existe). */
export async function resolveLiveSession(liveSessionId: unknown): Promise<string | null> {
  if (!isUuid(liveSessionId)) return null
  const { data } = await db().from('live_sessions').select('id').eq('id', liveSessionId).maybeSingle()
  return data ? (data.id as string) : null
}

/**
 * Crea una corrida o retoma la última en curso de esa persona para ese sim
 * (y esa clase en vivo, si vino). Con `fresh` marca la en curso como
 * abandonada y arranca otra.
 */
export async function startRun(opts: {
  simId: string
  personId: string
  liveSessionId?: string | null
  fresh?: boolean
  meta?: Record<string, unknown>
}): Promise<{ run: SimRun; resumed: boolean }> {
  if (!(await simExists(opts.simId))) throw new SimError(`No existe el simulador ${opts.simId}`, 404)
  const live = await resolveLiveSession(opts.liveSessionId)

  let q = db().from('sim_runs').select(RUN_COLUMNS)
    .eq('sim_id', opts.simId).eq('person_id', opts.personId).eq('status', 'en-curso')
    .order('started_at', { ascending: false }).limit(1)
  q = live ? q.eq('live_session_id', live) : q.is('live_session_id', null)
  const { data: open } = await q
  const current = (open?.[0] as RunRow | undefined) ?? null

  if (current && !opts.fresh) return { run: toRun(current), resumed: true }
  if (current && opts.fresh) {
    await db().from('sim_runs').update({ status: 'abandonada' }).eq('id', current.id)
  }

  const { data, error } = await db().from('sim_runs').insert({
    sim_id: opts.simId,
    person_id: opts.personId,
    live_session_id: live,
    status: 'en-curso',
    summary: {},
    state: {},
  }).select(RUN_COLUMNS).single()
  if (error || !data) throw new SimError(`No se pudo crear la corrida: ${error?.message ?? 'sin datos'}`, 500)
  const run = toRun(data as RunRow)
  await db().from('sim_events').insert({ run_id: run.id, type: 'started', payload: { meta: opts.meta ?? {}, fresh: Boolean(opts.fresh) } })
  if (run.liveSessionId) void notifyLive(run, 'started')
  return { run, resumed: false }
}

export async function getRun(runId: string): Promise<SimRun | null> {
  if (!isUuid(runId)) return null
  const { data } = await db().from('sim_runs').select(RUN_COLUMNS).eq('id', runId).maybeSingle()
  return data ? toRun(data as RunRow) : null
}

/** La corrida, si la sesión puede escribirla (dueño) o leerla (dueño o profesor). */
export async function runForSession(runId: string, session: Session, mode: 'read' | 'write'): Promise<SimRun> {
  const run = await getRun(runId)
  if (!run) throw new SimError('Corrida inexistente', 404)
  const owner = run.personId === session.personId
  if (mode === 'write' && !owner) throw new SimError('Esta corrida no es tuya', 403)
  if (mode === 'read' && !owner && session.role !== 'profesor') throw new SimError('Esta corrida no es tuya', 403)
  return run
}

function cleanType(t: unknown): string | null {
  if (typeof t !== 'string') return null
  const s = t.trim().slice(0, 64)
  return /^[a-zA-Z0-9_.:-]+$/.test(s) ? s : null
}

/** Guarda un lote de eventos. Devuelve cuántos entraron. */
export async function appendEvents(run: SimRun, events: SimEventInput[]): Promise<number> {
  if (!Array.isArray(events)) throw new SimError('events tiene que ser una lista')
  if (events.length > SIM_LIMITS.eventsPerRequest) throw new SimError(`Máximo ${SIM_LIMITS.eventsPerRequest} eventos por envío`)
  const rows = []
  for (const e of events) {
    const type = cleanType(e?.type)
    if (!type) continue
    const payload = e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload) ? { ...e.payload } : {}
    if (typeof e.at === 'number' && Number.isFinite(e.at)) payload._at = e.at
    if (bytes(payload) > SIM_LIMITS.payloadBytes) continue
    rows.push({ run_id: run.id, type, payload })
  }
  if (rows.length === 0) return 0
  const { error } = await db().from('sim_events').insert(rows)
  if (error) throw new SimError(`No se pudieron guardar los eventos: ${error.message}`, 500)
  if (run.liveSessionId && rows.some((r) => r.type === 'decision')) void notifyLive(run, 'decision')
  return rows.length
}

export async function saveRunState(run: SimRun, state: unknown): Promise<void> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new SimError('state tiene que ser un objeto')
  if (bytes(state) > SIM_LIMITS.stateBytes) throw new SimError('state demasiado grande')
  if (run.status !== 'en-curso') return
  const { error } = await db().from('sim_runs').update({ state }).eq('id', run.id)
  if (error) throw new SimError(`No se pudo guardar el estado: ${error.message}`, 500)
}

export async function completeRun(run: SimRun, input: { score?: unknown; summary?: unknown; state?: unknown }): Promise<SimRun> {
  const score = typeof input.score === 'number' && Number.isFinite(input.score) ? Math.max(-1e9, Math.min(1e9, input.score)) : null
  const summary = input.summary && typeof input.summary === 'object' && !Array.isArray(input.summary) ? input.summary as Record<string, unknown> : {}
  if (bytes(summary) > SIM_LIMITS.summaryBytes) throw new SimError('summary demasiado grande')
  const patch: Record<string, unknown> = { status: 'completada', score, summary, completed_at: new Date().toISOString() }
  if (input.state && typeof input.state === 'object' && !Array.isArray(input.state) && bytes(input.state) <= SIM_LIMITS.stateBytes) patch.state = input.state
  const { data, error } = await db().from('sim_runs').update(patch).eq('id', run.id).select(RUN_COLUMNS).single()
  if (error || !data) throw new SimError(`No se pudo cerrar la corrida: ${error?.message ?? 'sin datos'}`, 500)
  await db().from('sim_events').insert({ run_id: run.id, type: 'completed', payload: { score, summary } })
  const done = toRun(data as RunRow)
  if (done.liveSessionId) void notifyLive(done, 'completed')
  return done
}

/** Corrida en curso de la persona (para retomar al abrir la página). */
export async function findOpenRun(simId: string, personId: string, liveSessionId: string | null): Promise<SimRun | null> {
  let q = db().from('sim_runs').select(RUN_COLUMNS)
    .eq('sim_id', simId).eq('person_id', personId).eq('status', 'en-curso')
    .order('started_at', { ascending: false }).limit(1)
  q = liveSessionId ? q.eq('live_session_id', liveSessionId) : q.is('live_session_id', null)
  const { data } = await q
  const row = (data?.[0] as RunRow | undefined) ?? null
  return row ? toRun(row) : null
}

/** Corridas de la persona para un sim (más nuevas primero). */
export async function listMyRuns(simId: string, personId: string, limit = 20): Promise<SimRun[]> {
  const { data } = await db().from('sim_runs').select(RUN_COLUMNS)
    .eq('sim_id', simId).eq('person_id', personId).neq('status', 'abandonada')
    .order('started_at', { ascending: false }).limit(limit)
  return ((data ?? []) as RunRow[]).map(toRun)
}

export interface CohortRun extends SimRun {
  personName: string | null
  company: string | null
  isFictional: boolean
  events: number
}

/** Corridas de la cohorte (vista del profesor), opcionalmente de una clase en vivo. */
export async function listCohortRuns(simId: string, liveSessionId?: string | null): Promise<CohortRun[]> {
  let q = db().from('sim_runs').select(`${RUN_COLUMNS}, people(full_name, company, is_fictional), sim_events(count)`)
    .eq('sim_id', simId).neq('status', 'abandonada').order('started_at', { ascending: false }).limit(500)
  if (liveSessionId) q = q.eq('live_session_id', liveSessionId)
  const { data, error } = await q
  if (error) throw new SimError(`No se pudieron leer las corridas: ${error.message}`, 500)
  type Joined = RunRow & { people: { full_name: string; company: string | null; is_fictional: boolean } | null; sim_events: Array<{ count: number }> }
  return ((data ?? []) as unknown as Joined[]).map((r) => ({
    ...toRun(r),
    personName: r.people?.full_name ?? null,
    company: r.people?.company ?? null,
    isFictional: r.people?.is_fictional ?? false,
    events: r.sim_events?.[0]?.count ?? 0,
  }))
}

/** Avisa al canal de la clase que cambió algo del sim (el proyector refresca el resumen). */
async function notifyLive(run: SimRun, what: 'started' | 'decision' | 'completed'): Promise<void> {
  if (!run.liveSessionId) return
  try {
    await broadcast(run.liveSessionId, 'sim.updated', { simId: run.simId, runId: run.id, what })
  } catch {
    // el estado ya quedó en la DB; el overlay puede refrescar por polling
  }
}
