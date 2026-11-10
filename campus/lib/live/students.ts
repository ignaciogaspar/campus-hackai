import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { broadcast } from '@/lib/realtime'
import {
  currentRound as classroomRound,
  drawStudent,
  logParticipation as classroomLogParticipation,
  resetRound,
  setDrawOutcome as classroomSetDrawOutcome,
} from '@/lib/classroom/participation'
import { classSessionOfLive, courseOfLive, LiveError, logEvent } from './session'
import { normName, type DrawLine, type StudentSnapshot } from './types'

/* Padrón, sorteo con rondas sin repetir y registro de participación en la
   clase en vivo. La lógica de rondas, sorteo y participación es una sola:
   lib/classroom/participation (la usan también /profesor/participacion y los
   casos). Acá se suma lo propio del vivo: nombres aproximados, ronda que se
   reinicia sola, eventos en live_events y broadcast `draw`. */

export interface RosterPerson {
  id: string
  full_name: string
  company: string | null
  position: string | null
  industry: string | null
  photo_url: string | null
}

export async function roster(courseId: string): Promise<RosterPerson[]> {
  const { data, error } = await db()
    .from('people')
    .select('id, full_name, company, position, industry, photo_url')
    .eq('course_id', courseId)
    .eq('role', 'alumno')
    .order('full_name')
  if (error) throw new Error(`padrón: ${error.message}`)
  return (data ?? []) as RosterPerson[]
}

export function toStudent(p: RosterPerson): StudentSnapshot {
  return { personId: p.id, name: p.full_name, company: p.company, position: p.position, photoUrl: p.photo_url, industry: p.industry }
}

/**
 * Busca un alumno por nombre aproximado («Mariana», «Etcheverry», «la de
 * Conexa» no: solo nombre). Devuelve el mejor o los candidatos si hay empate.
 */
export function matchStudent(people: RosterPerson[], query: string): { person: RosterPerson } | { candidates: RosterPerson[] } {
  const q = normName(query)
  if (!q) return { candidates: [] }
  const qTokens = q.split(' ')
  const scored = people.map((p) => {
    const n = normName(p.full_name)
    const tokens = n.split(' ')
    let score = 0
    if (n === q) score += 100
    for (const t of qTokens) {
      if (tokens.includes(t)) score += 10
      else if (tokens.some((x) => x.startsWith(t) && t.length >= 3)) score += 6
      else if (t.length >= 4 && tokens.some((x) => lev(x, t) <= (t.length > 6 ? 2 : 1))) score += 4
    }
    if (n.includes(q)) score += 5
    return { p, score }
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  if (!scored.length) return { candidates: [] }
  if (scored.length === 1 || scored[0].score > scored[1].score) return { person: scored[0].p }
  return { candidates: scored.filter((s) => s.score === scored[0].score).map((s) => s.p) }
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

export interface DrawResult {
  draw: DrawLine
  student: StudentSnapshot
  roundId: string
  newRound: boolean
  remaining: number
}

/**
 * Sortea un alumno de la ronda vigente sin repetir (lib/classroom drawStudent)
 * y lo muestra en el proyector. Con caseId + postureId sortea solo entre
 * quienes tomaron esa postura. Si la ronda se agotó sin filtro de postura,
 * arranca otra sola.
 */
export async function pickRandomStudent(live: LiveSession, opts: { caseId?: string | null; postureId?: string | null; excludeNames?: string[]; onlyWithoutParticipation?: boolean; drawnBy: 'profesor' | 'agent' }): Promise<DrawResult> {
  const courseId = await courseOfLive(live)
  const people = await roster(courseId)
  if (!people.length) throw new LiveError('No hay alumnos en el padrón.')
  const excludePersonIds: string[] = []
  for (const name of opts.excludeNames ?? []) {
    const m = matchStudent(people, name)
    if ('person' in m) excludePersonIds.push(m.person.id)
  }
  const input = {
    courseId,
    liveSessionId: live.id,
    caseId: opts.caseId ?? null,
    postureId: opts.caseId ? (opts.postureId ?? null) : null,
    onlyWithoutParticipation: opts.onlyWithoutParticipation,
    excludePersonIds,
    drawnBy: opts.drawnBy,
    showOnLive: true,
  }
  let res = await drawStudent(input)
  let newRound = false
  if (!res.ok && res.reason === 'ronda-agotada' && !input.postureId && !input.onlyWithoutParticipation) {
    await resetRound({ courseId, startedBy: live.started_by, reason: 'ronda completa: se reinició sola' })
    newRound = true
    res = await drawStudent(input)
  }
  if (!res.ok) throw new LiveError(res.message)
  const d = res.draw
  const person = people.find((p) => p.id === d.personId)
  const draw: DrawLine = { id: d.drawId, personId: d.personId, name: d.name, outcome: d.outcome, drawnBy: d.drawnBy, createdAt: d.createdAt }
  await Promise.all([
    logEvent(live.id, 'cold_call.draw', { drawId: d.drawId, personId: d.personId, roundId: d.roundId, caseId: d.caseId, postureId: input.postureId }, opts.drawnBy),
    broadcast(live.id, 'draw', { draw }),
  ])
  return {
    draw,
    student: person ? toStudent(person) : { personId: d.personId, name: d.name, company: d.company, position: d.position, photoUrl: d.photoUrl },
    roundId: d.roundId,
    newRound,
    remaining: res.remaining,
  }
}

/** Cambia el resultado de un sorteo de esta clase; 'participo' registra participación (sin duplicar). */
export async function setDrawOutcome(live: LiveSession, drawId: string, outcome: DrawLine['outcome'], actor = 'profesor'): Promise<void> {
  const { data: own } = await db().from('cold_call_draws').select('id').eq('id', drawId).eq('live_session_id', live.id).maybeSingle()
  if (!own) throw new LiveError('Sorteo inexistente.', 404)
  await classroomSetDrawOutcome({ drawId, outcome })
  const { data } = await db().from('cold_call_draws').select('id, person_id, outcome, drawn_by, created_at, people(full_name)').eq('id', drawId).single()
  const row = data as unknown as { id: string; person_id: string; outcome: DrawLine['outcome']; drawn_by: string; created_at: string; people: { full_name: string } | null }
  const draw: DrawLine = { id: row.id, personId: row.person_id, name: row.people?.full_name ?? '', outcome: row.outcome, drawnBy: row.drawn_by, createdAt: row.created_at }
  await Promise.all([
    logEvent(live.id, 'cold_call.outcome', { drawId, outcome }, actor),
    broadcast(live.id, 'draw', { draw }),
  ])
}

export const PARTICIPATION_KINDS = ['intervencion', 'cold-call', 'pregunta', 'aporte', 'debate'] as const
export type ParticipationKind = (typeof PARTICIPATION_KINDS)[number]

/** Registra participación de un alumno por nombre aproximado (lib/classroom logParticipation). */
export async function logParticipation(live: LiveSession, input: { name: string; kind?: string; quality?: number | null; note?: string | null }, source: 'agent' | 'manual' = 'agent'): Promise<{ person: RosterPerson; id: string }> {
  const courseId = await courseOfLive(live)
  const people = await roster(courseId)
  const m = matchStudent(people, input.name)
  if (!('person' in m)) {
    if (m.candidates.length) throw new LiveError(`Hay más de un alumno que coincide con «${input.name}»: ${m.candidates.map((c) => c.full_name).join(', ')}.`)
    throw new LiveError(`No encontré a «${input.name}» en el padrón.`)
  }
  const kind = ((PARTICIPATION_KINDS as readonly string[]).includes(input.kind ?? '') ? input.kind : 'intervencion') as ParticipationKind
  const quality = input.quality && input.quality >= 1 && input.quality <= 3 ? Math.round(input.quality) : null
  const { data: seg } = await db().from('transcript_segments').select('id').eq('live_session_id', live.id)
    .eq('is_command', false).order('id', { ascending: false }).limit(1).maybeSingle()
  const row = await classroomLogParticipation({
    courseId,
    personId: m.person.id,
    kind,
    quality,
    note: input.note ?? null,
    classSessionId: await classSessionOfLive(live),
    liveSessionId: live.id,
    transcriptSegmentId: (seg?.id as number | undefined) ?? null,
    source,
  })
  await logEvent(live.id, 'participation.logged', { personId: m.person.id, kind, quality }, source === 'agent' ? 'agent' : 'profesor')
  return { person: m.person, id: row.id }
}

/** Últimos sorteos de la clase y estado de la ronda vigente del curso. */
export async function recentDraws(live: LiveSession): Promise<{ draws: DrawLine[]; round: { id: string; drawn: number; remaining: number } | null }> {
  const { data } = await db().from('cold_call_draws')
    .select('id, person_id, outcome, drawn_by, created_at, people(full_name)')
    .eq('live_session_id', live.id).order('created_at', { ascending: false }).limit(12)
  const draws: DrawLine[] = ((data ?? []) as unknown as Array<{ id: string; person_id: string; outcome: DrawLine['outcome']; drawn_by: string; created_at: string; people: { full_name: string } | null }>)
    .map((d) => ({ id: d.id, personId: d.person_id, name: d.people?.full_name ?? '', outcome: d.outcome, drawnBy: d.drawn_by, createdAt: d.created_at }))
  const courseId = await courseOfLive(live)
  const r = await classroomRound(courseId)
  return { draws, round: { id: r.round.id, drawn: r.total - r.pending.length, remaining: r.pending.length } }
}
