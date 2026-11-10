import 'server-only'
import { randomInt } from 'node:crypto'
import { db, COURSE_ID } from '@/lib/db'
import { classSessionOfLive, setLiveOverlay } from './live'
import {
  isDrawOutcome, isParticipationKind,
  type DrawOutcome, type ParticipationKind, type ParticipationSource,
} from './types'

/* Randomizador con rondas y registro de participación (server).
   Una ronda saca alumnos sin repetir hasta que el profesor la reinicia.
   Los que quedaron 'ausente' vuelven a ser sorteables dentro de la ronda. */

export interface RoundInfo {
  id: string
  courseId: string
  startedAt: string
  startedBy: string | null
  reason: string | null
}

export interface DrawnStudent {
  drawId: string
  roundId: string
  personId: string
  name: string
  company: string | null
  position: string | null
  photoUrl: string | null
  outcome: DrawOutcome
  caseId: string | null
  liveSessionId: string | null
  drawnBy: string
  createdAt: string
}

export interface CurrentRound {
  round: RoundInfo
  /** Sorteados en esta ronda, del más reciente al más viejo. */
  drawn: DrawnStudent[]
  /** Alumnos que todavía pueden salir (no sorteados o marcados ausentes). */
  pending: Array<{ personId: string; name: string; company: string | null }>
  /** Total de alumnos del curso. */
  total: number
}

interface PersonLite { id: string; full_name: string; company: string | null; position: string | null; photo_url: string | null }

function toRound(r: { id: string; course_id: string; started_at: string; started_by: string | null; reason: string | null }): RoundInfo {
  return { id: r.id, courseId: r.course_id, startedAt: r.started_at, startedBy: r.started_by, reason: r.reason }
}

async function alumnos(courseId: string): Promise<PersonLite[]> {
  const { data } = await db().from('people').select('id, full_name, company, position, photo_url').eq('course_id', courseId).eq('role', 'alumno').order('full_name')
  return (data ?? []) as PersonLite[]
}

/** Ronda vigente del curso (la más reciente). La crea si no hay ninguna. */
export async function ensureRound(courseId = COURSE_ID): Promise<RoundInfo> {
  const { data } = await db().from('cold_call_rounds').select('*').eq('course_id', courseId).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (data) return toRound(data)
  const { data: created, error } = await db().from('cold_call_rounds').insert({ course_id: courseId, reason: 'Primera ronda' }).select('*').single()
  if (error && String(error.code) === '23505') {
    // otro request la creó en paralelo (índice único de 0142): usamos esa
    const { data: again } = await db().from('cold_call_rounds').select('*').eq('course_id', courseId).order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (again) return toRound(again)
  }
  if (error || !created) throw new Error(`No se pudo crear la ronda: ${error?.message}`)
  return toRound(created)
}

/** Ronda vigente con quién ya salió y quién no. */
export async function currentRound(courseId = COURSE_ID): Promise<CurrentRound> {
  const round = await ensureRound(courseId)
  const [people, { data }] = await Promise.all([
    alumnos(courseId),
    db().from('cold_call_draws').select('*').eq('round_id', round.id).order('created_at', { ascending: false }),
  ])
  const byId = new Map(people.map((p) => [p.id, p]))
  const drawn: DrawnStudent[] = ((data ?? []) as Array<Record<string, string | null>>).map((d) => {
    const p = byId.get(d.person_id as string)
    return {
      drawId: d.id as string,
      roundId: d.round_id as string,
      personId: d.person_id as string,
      name: p?.full_name ?? 'Alumno',
      company: p?.company ?? null,
      position: p?.position ?? null,
      photoUrl: p?.photo_url ?? null,
      outcome: (isDrawOutcome(d.outcome) ? d.outcome : 'pendiente'),
      caseId: d.case_id,
      liveSessionId: d.live_session_id,
      drawnBy: (d.drawn_by as string) ?? 'profesor',
      createdAt: d.created_at as string,
    }
  })
  const blocked = blockedIn(drawn)
  const pending = people.filter((p) => !blocked.has(p.id)).map((p) => ({ personId: p.id, name: p.full_name, company: p.company }))
  return { round, drawn, pending, total: people.length }
}

/** Personas que ya salieron en la ronda (salvo las que solo figuran ausentes). */
function blockedIn(drawn: DrawnStudent[]): Set<string> {
  const blocked = new Set<string>()
  for (const d of drawn) if (d.outcome !== 'ausente') blocked.add(d.personId)
  return blocked
}

/** Cierra la ronda vigente y abre una nueva con motivo. */
export async function resetRound(input: { courseId?: string; startedBy?: string | null; reason?: string | null } = {}): Promise<RoundInfo> {
  const { data, error } = await db().from('cold_call_rounds').insert({
    course_id: input.courseId ?? COURSE_ID,
    started_by: input.startedBy ?? null,
    reason: input.reason?.trim() || null,
  }).select('*').single()
  if (error || !data) throw new Error(`No se pudo reiniciar la ronda: ${error?.message}`)
  return toRound(data)
}

export interface DrawStudentInput {
  courseId?: string
  liveSessionId?: string | null
  /** Con postureId: sortea solo entre quienes tomaron esa postura en el caso. */
  caseId?: string | null
  postureId?: string | null
  /** Solo alumnos sin ningún registro de participación (en la jornada si se pasa classSessionId, si no en el curso). */
  onlyWithoutParticipation?: boolean
  classSessionId?: string | null
  /** 'profesor' | 'agent' */
  drawnBy?: string
  /** Si hay liveSessionId, muestra la tarjeta del alumno (overlay `student`) en el proyector. */
  showOnLive?: boolean
  /** Personas a excluir de este sorteo puntual (no cambia la ronda). */
  excludePersonIds?: string[]
  /** Reintentos internos por choque con otro sorteo simultáneo. */
  retries?: number
}

export type DrawStudentResult =
  | { ok: true; draw: DrawnStudent; remaining: number; eligible: number; round: RoundInfo }
  | { ok: false; reason: 'sin-candidatos' | 'ronda-agotada'; message: string; round: RoundInfo }

/**
 * Sortea un alumno sin repetir dentro de la ronda vigente, con filtros
 * opcionales (postura de un caso, "no participó todavía"). Registra el
 * sorteo en cold_call_draws con outcome 'pendiente'.
 * - 'sin-candidatos': ningún alumno cumple el filtro.
 * - 'ronda-agotada': cumplen el filtro pero ya salieron todos en esta ronda.
 */
export async function drawStudent(input: DrawStudentInput = {}): Promise<DrawStudentResult> {
  const courseId = input.courseId ?? COURSE_ID
  const current = await currentRound(courseId)
  const round = current.round
  let candidates = await alumnos(courseId)

  if (input.caseId && input.postureId) {
    const { data } = await db().from('case_postures').select('person_id').eq('case_id', input.caseId).eq('posture_id', input.postureId)
    const ids = new Set(((data ?? []) as Array<{ person_id: string }>).map((r) => r.person_id))
    candidates = candidates.filter((p) => ids.has(p.id))
  }
  if (input.onlyWithoutParticipation) {
    const classSessionId = input.classSessionId ?? (await classSessionOfLive(input.liveSessionId))
    let q = db().from('participation').select('person_id').eq('course_id', courseId)
    if (classSessionId) q = q.eq('class_session_id', classSessionId)
    const { data } = await q
    const done = new Set(((data ?? []) as Array<{ person_id: string }>).map((r) => r.person_id))
    candidates = candidates.filter((p) => !done.has(p.id))
  }
  if (input.excludePersonIds?.length) {
    const ex = new Set(input.excludePersonIds)
    candidates = candidates.filter((p) => !ex.has(p.id))
  }
  if (!candidates.length) {
    return { ok: false, reason: 'sin-candidatos', message: 'Nadie cumple ese filtro.', round }
  }
  const blocked = blockedIn(current.drawn)
  const eligible = candidates.filter((p) => !blocked.has(p.id))
  if (!eligible.length) {
    return { ok: false, reason: 'ronda-agotada', message: 'Ya salieron todos los que cumplen el filtro en esta ronda. Reiniciá la ronda o cambiá el filtro.', round }
  }
  const person = eligible[randomInt(eligible.length)]
  const drawnBy = input.drawnBy ?? 'profesor'
  const { data: row, error } = await db().from('cold_call_draws').insert({
    round_id: round.id,
    live_session_id: input.liveSessionId ?? null,
    case_id: input.caseId ?? null,
    person_id: person.id,
    drawn_by: drawnBy,
  }).select('*').single()
  if (error && String(error.code) === '23505' && (input.retries ?? 0) < 3) {
    // otro sorteo simultáneo (botón y agente) eligió a la misma persona: de nuevo, sin ella
    return drawStudent({ ...input, excludePersonIds: [...(input.excludePersonIds ?? []), person.id], retries: (input.retries ?? 0) + 1 })
  }
  if (error || !row) throw new Error(`No se pudo registrar el sorteo: ${error?.message}`)
  const draw: DrawnStudent = {
    drawId: row.id,
    roundId: round.id,
    personId: person.id,
    name: person.full_name,
    company: person.company,
    position: person.position,
    photoUrl: person.photo_url,
    outcome: 'pendiente',
    caseId: row.case_id,
    liveSessionId: row.live_session_id,
    drawnBy,
    createdAt: row.created_at,
  }
  if (input.showOnLive && input.liveSessionId) {
    await showStudentOnLive(input.liveSessionId, draw, drawnBy === 'agent' ? 'agent' : 'profesor')
  }
  return { ok: true, draw, remaining: eligible.length - 1, eligible: eligible.length, round }
}

/** Muestra la tarjeta del alumno en el proyector (overlay `student`). */
export async function showStudentOnLive(liveSessionId: string, p: { personId: string; name: string; company: string | null; position: string | null; photoUrl: string | null }, actor = 'profesor'): Promise<void> {
  await setLiveOverlay(liveSessionId, { type: 'student', personId: p.personId, name: p.name, company: p.company, position: p.position, photoUrl: p.photoUrl }, actor)
}

export interface LogParticipationInput {
  courseId?: string
  personId: string
  kind: ParticipationKind
  /** 1 básica, 2 buena, 3 excelente */
  quality?: number | null
  note?: string | null
  classSessionId?: string | null
  /** Si viene sin classSessionId, se toma la jornada de la clase en vivo. */
  liveSessionId?: string | null
  transcriptSegmentId?: number | null
  source?: ParticipationSource
}

export interface ParticipationRow {
  id: string
  course_id: string
  class_session_id: string | null
  live_session_id: string | null
  person_id: string
  kind: ParticipationKind
  quality: number | null
  note: string | null
  transcript_segment_id: number | null
  source: ParticipationSource
  created_at: string
}

/** Registra una participación. Valida tipo y calidad. */
export async function logParticipation(input: LogParticipationInput): Promise<ParticipationRow> {
  if (!isParticipationKind(input.kind)) throw new Error(`Tipo de participación inválido: ${String(input.kind)}`)
  const quality = input.quality == null ? null : Math.round(input.quality)
  if (quality !== null && !(quality >= 1 && quality <= 3)) throw new Error('La calidad va de 1 a 3')
  const classSessionId = input.classSessionId ?? (await classSessionOfLive(input.liveSessionId))
  const { data, error } = await db().from('participation').insert({
    course_id: input.courseId ?? COURSE_ID,
    class_session_id: classSessionId,
    live_session_id: input.liveSessionId ?? null,
    person_id: input.personId,
    kind: input.kind,
    quality,
    note: input.note?.trim() || null,
    transcript_segment_id: input.transcriptSegmentId ?? null,
    source: input.source ?? 'manual',
  }).select('*').single()
  if (error || !data) throw new Error(`No se pudo registrar la participación: ${error?.message}`)
  return data as ParticipationRow
}

/**
 * Cierra el resultado de un sorteo. Con 'participo' también registra una
 * participación cold-call (source 'randomizer') con la calidad y nota dadas.
 * Volver a marcar el mismo sorteo no duplica la participación.
 */
export async function setDrawOutcome(input: { drawId: string; outcome: DrawOutcome; quality?: number | null; note?: string | null; kind?: ParticipationKind }): Promise<void> {
  if (!isDrawOutcome(input.outcome)) throw new Error('Resultado inválido')
  const { data: draw } = await db().from('cold_call_draws').select('*, cold_call_rounds(course_id)').eq('id', input.drawId).maybeSingle()
  if (!draw) throw new Error('No existe ese sorteo')
  const { error } = await db().from('cold_call_draws').update({ outcome: input.outcome }).eq('id', input.drawId)
  if (error) throw new Error(`No se pudo guardar el resultado: ${error.message}`)
  if (input.outcome !== 'participo') return
  const marker = `[sorteo:${input.drawId}]`
  const { data: existing } = await db().from('participation').select('id').eq('person_id', draw.person_id).like('note', `%${marker}%`).limit(1)
  if (existing && existing.length) return
  const note = [input.note?.trim(), marker].filter(Boolean).join(' ')
  await logParticipation({
    courseId: (draw.cold_call_rounds as { course_id: string } | null)?.course_id ?? COURSE_ID,
    personId: draw.person_id,
    kind: input.kind ?? 'cold-call',
    quality: input.quality ?? null,
    note,
    liveSessionId: draw.live_session_id,
    source: 'randomizer',
  })
}

export async function deleteParticipation(id: string): Promise<void> {
  const { error } = await db().from('participation').delete().eq('id', id)
  if (error) throw new Error(`No se pudo borrar: ${error.message}`)
}

/** Quita la marca interna `[sorteo:<id>]` de una nota para mostrarla. */
export function cleanNote(note: string | null): string {
  return (note ?? '').replace(/\s*\[sorteo:[0-9a-f-]+\]/g, '').trim()
}

export interface CohortParticipation {
  personId: string
  name: string
  company: string | null
  total: number
  byKind: Record<ParticipationKind, number>
  /** Conteo por class_session_id ('sin-jornada' si no tiene). */
  bySession: Record<string, number>
  avgQuality: number | null
  /** Suma de calidades (las sin calidad cuentan 1). Base para la nota de participación. */
  points: number
  draws: Record<DrawOutcome, number>
  lastAt: string | null
}

/** Tabla de cohorte: conteos por alumno para la nota de participación. */
export async function cohortParticipation(courseId = COURSE_ID): Promise<CohortParticipation[]> {
  const [people, { data: parts }, { data: rounds }] = await Promise.all([
    alumnos(courseId),
    db().from('participation').select('person_id, kind, quality, class_session_id, created_at').eq('course_id', courseId),
    db().from('cold_call_rounds').select('id').eq('course_id', courseId),
  ])
  const roundIds = ((rounds ?? []) as Array<{ id: string }>).map((r) => r.id)
  const { data: draws } = roundIds.length
    ? await db().from('cold_call_draws').select('person_id, outcome').in('round_id', roundIds)
    : { data: [] as Array<{ person_id: string; outcome: string }> }
  const rows = new Map<string, CohortParticipation>()
  for (const p of people) {
    rows.set(p.id, {
      personId: p.id, name: p.full_name, company: p.company, total: 0,
      byKind: { intervencion: 0, 'cold-call': 0, pregunta: 0, aporte: 0, debate: 0 },
      bySession: {}, avgQuality: null, points: 0,
      draws: { pendiente: 0, participo: 0, paso: 0, ausente: 0 }, lastAt: null,
    })
  }
  const qualities = new Map<string, number[]>()
  for (const r of (parts ?? []) as Array<{ person_id: string; kind: string; quality: number | null; class_session_id: string | null; created_at: string }>) {
    const row = rows.get(r.person_id)
    if (!row) continue
    row.total++
    if (isParticipationKind(r.kind)) row.byKind[r.kind]++
    const s = r.class_session_id ?? 'sin-jornada'
    row.bySession[s] = (row.bySession[s] ?? 0) + 1
    row.points += r.quality ?? 1
    if (r.quality) qualities.set(r.person_id, [...(qualities.get(r.person_id) ?? []), r.quality])
    if (!row.lastAt || r.created_at > row.lastAt) row.lastAt = r.created_at
  }
  for (const [id, qs] of qualities) {
    const row = rows.get(id)
    if (row) row.avgQuality = Math.round((qs.reduce((a, b) => a + b, 0) / qs.length) * 10) / 10
  }
  for (const d of (draws ?? []) as Array<{ person_id: string; outcome: string }>) {
    const row = rows.get(d.person_id)
    if (row && isDrawOutcome(d.outcome)) row.draws[d.outcome]++
  }
  return [...rows.values()]
}

export interface ParticipationLogEntry extends ParticipationRow { name: string }

/** Últimos registros de participación (con nombre). */
export async function recentParticipation(courseId = COURSE_ID, limit = 40, filter: { personId?: string; classSessionId?: string } = {}): Promise<ParticipationLogEntry[]> {
  let q = db().from('participation').select('*, people(full_name)').eq('course_id', courseId).order('created_at', { ascending: false }).limit(limit)
  if (filter.personId) q = q.eq('person_id', filter.personId)
  if (filter.classSessionId) q = q.eq('class_session_id', filter.classSessionId)
  const { data } = await q
  return ((data ?? []) as Array<ParticipationRow & { people: { full_name: string } | null }>).map((r) => ({ ...r, name: r.people?.full_name ?? 'Alumno' }))
}
