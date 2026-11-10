import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import { broadcast } from '@/lib/realtime'
import { activeLiveSession, setLiveOverlay } from './live'
import {
  caseStatus, JUSTIFICATION_MAX, JUSTIFICATION_MIN,
  type CasePosture, type CaseRow, type PostureDistribution,
} from './types'

/* Casos y posturas (server). */

const CASE_COLUMNS = 'id, course_id, class_session_id, title, protagonist, summary, body_md, question, postures, teacher_notes, is_fictional, opens_at, closes_at'

function normalizeCase(row: Record<string, unknown>): CaseRow {
  const postures = Array.isArray(row.postures) ? (row.postures as CasePosture[]).filter((p) => p && typeof p.id === 'string') : []
  return { ...(row as unknown as CaseRow), postures }
}

export async function getCase(caseId: string): Promise<CaseRow | null> {
  const { data } = await db().from('cases').select(CASE_COLUMNS).eq('id', caseId).maybeSingle()
  return data ? normalizeCase(data) : null
}

export async function listCases(courseId = COURSE_ID): Promise<CaseRow[]> {
  const { data } = await db().from('cases').select(CASE_COLUMNS).eq('course_id', courseId).order('class_session_id', { ascending: true, nullsFirst: false }).order('id')
  return (data ?? []).map(normalizeCase)
}

export interface PostureRow {
  id: string
  case_id: string
  person_id: string
  posture_id: string
  justification: string
  confidence: number | null
  created_at: string
  updated_at: string
}

export async function getMyPosture(caseId: string, personId: string): Promise<PostureRow | null> {
  const { data } = await db().from('case_postures').select('*').eq('case_id', caseId).eq('person_id', personId).maybeSingle()
  return (data as PostureRow | null) ?? null
}

async function rosterCount(courseId: string): Promise<number> {
  const { count } = await db().from('people').select('id', { count: 'exact', head: true }).eq('course_id', courseId).eq('role', 'alumno')
  return count ?? 0
}

/** Distribución anónima: cuántos por postura, % y confianza promedio. */
export async function getPostureDistribution(caseId: string): Promise<PostureDistribution | null> {
  const caso = await getCase(caseId)
  if (!caso) return null
  const [{ data }, roster] = await Promise.all([
    db().from('case_postures').select('posture_id, confidence').eq('case_id', caseId),
    rosterCount(caso.course_id),
  ])
  const rows = (data ?? []) as Array<{ posture_id: string; confidence: number | null }>
  return distributionFrom(caso, rows, roster)
}

export function distributionFrom(caso: CaseRow, rows: Array<{ posture_id: string; confidence: number | null }>, roster: number): PostureDistribution {
  const total = rows.length
  const known = new Set(caso.postures.map((p) => p.id))
  const postures = [...caso.postures]
  // Posturas que ya no están en el caso (si el profesor las editó) igual se cuentan.
  for (const r of rows) if (!known.has(r.posture_id)) { known.add(r.posture_id); postures.push({ id: r.posture_id, label: r.posture_id }) }
  const counts = postures.map((p) => {
    const mine = rows.filter((r) => r.posture_id === p.id)
    const conf = mine.map((r) => r.confidence).filter((c): c is number => typeof c === 'number')
    return {
      postureId: p.id,
      label: p.label,
      count: mine.length,
      pct: total ? Math.round((mine.length / total) * 100) : 0,
      avgConfidence: conf.length ? Math.round((conf.reduce((a, b) => a + b, 0) / conf.length) * 10) / 10 : null,
    }
  })
  return { caseId: caso.id, question: caso.question, total, roster, counts }
}

export interface CaseTeacherView {
  caso: CaseRow
  distribution: PostureDistribution
  byPosture: Array<{
    posture: CasePosture
    entries: Array<{ personId: string; name: string; company: string | null; justification: string; confidence: number | null; updatedAt: string }>
  }>
  missing: Array<{ personId: string; name: string; company: string | null }>
}

/** Todo lo que ve el profesor de un caso: distribución, justificaciones por postura y quién falta. */
export async function getCaseTeacherView(caseId: string): Promise<CaseTeacherView | null> {
  const caso = await getCase(caseId)
  if (!caso) return null
  const [{ data: posts }, { data: people }] = await Promise.all([
    db().from('case_postures').select('person_id, posture_id, justification, confidence, updated_at').eq('case_id', caseId).order('updated_at', { ascending: false }),
    db().from('people').select('id, full_name, company').eq('course_id', caso.course_id).eq('role', 'alumno').order('full_name'),
  ])
  const rows = (posts ?? []) as Array<{ person_id: string; posture_id: string; justification: string; confidence: number | null; updated_at: string }>
  const alumnos = (people ?? []) as Array<{ id: string; full_name: string; company: string | null }>
  const byId = new Map(alumnos.map((p) => [p.id, p]))
  const distribution = distributionFrom(caso, rows, alumnos.length)
  const postures: CasePosture[] = distribution.counts.map((c) => caso.postures.find((p) => p.id === c.postureId) ?? { id: c.postureId, label: c.label })
  const byPosture = postures.map((posture) => ({
    posture,
    entries: rows.filter((r) => r.posture_id === posture.id).map((r) => ({
      personId: r.person_id,
      name: byId.get(r.person_id)?.full_name ?? 'Alguien que ya no está en el padrón',
      company: byId.get(r.person_id)?.company ?? null,
      justification: r.justification,
      confidence: r.confidence,
      updatedAt: r.updated_at,
    })),
  }))
  const took = new Set(rows.map((r) => r.person_id))
  const missing = alumnos.filter((p) => !took.has(p.id)).map((p) => ({ personId: p.id, name: p.full_name, company: p.company }))
  return { caso, distribution, byPosture, missing }
}

/** Conteos por caso para la lista del profesor. */
export async function postureCountsByCase(caseIds: string[]): Promise<Map<string, Array<{ posture_id: string; confidence: number | null }>>> {
  const map = new Map<string, Array<{ posture_id: string; confidence: number | null }>>()
  if (!caseIds.length) return map
  const { data } = await db().from('case_postures').select('case_id, posture_id, confidence').in('case_id', caseIds)
  for (const r of (data ?? []) as Array<{ case_id: string; posture_id: string; confidence: number | null }>) {
    const list = map.get(r.case_id) ?? []
    list.push({ posture_id: r.posture_id, confidence: r.confidence })
    map.set(r.case_id, list)
  }
  return map
}

export type SavePostureResult = { ok: true; changed: boolean } | { ok: false; error: string }

/**
 * Guarda (o cambia) la postura de un alumno. Valida que el caso esté abierto,
 * que la postura exista, la justificación (mínimo JUSTIFICATION_MIN caracteres)
 * y la confianza 1-5. Si hay una clase en vivo mostrando las posturas de este
 * caso, emite `postures.updated {caseId, counts, total}` en su canal.
 */
export async function savePosture(input: { caseId: string; personId: string; postureId: string; justification: string; confidence: number }): Promise<SavePostureResult> {
  const caso = await getCase(input.caseId)
  if (!caso) return { ok: false, error: 'No encontramos el caso.' }
  const status = caseStatus(caso)
  if (status === 'proximo') return { ok: false, error: 'El caso todavía no está abierto.' }
  if (status === 'cerrado') return { ok: false, error: 'El caso ya cerró: no se pueden cambiar posturas.' }
  if (!caso.postures.some((p) => p.id === input.postureId)) return { ok: false, error: 'Elegí una de las posturas del caso.' }
  const justification = input.justification.trim()
  if (justification.length < JUSTIFICATION_MIN) return { ok: false, error: `La justificación tiene que tener al menos ${JUSTIFICATION_MIN} caracteres (llevás ${justification.length}).` }
  if (justification.length > JUSTIFICATION_MAX) return { ok: false, error: `La justificación puede tener hasta ${JUSTIFICATION_MAX} caracteres.` }
  const confidence = Math.round(input.confidence)
  if (!(confidence >= 1 && confidence <= 5)) return { ok: false, error: 'Indicá tu confianza del 1 al 5.' }

  const previous = await getMyPosture(caso.id, input.personId)
  const now = new Date().toISOString()
  const { error } = await db().from('case_postures').upsert(
    { case_id: caso.id, person_id: input.personId, posture_id: input.postureId, justification, confidence, updated_at: now },
    { onConflict: 'case_id,person_id' },
  )
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` }
  await notifyLivePostures(caso.id).catch(() => undefined)
  return { ok: true, changed: !!previous && previous.posture_id !== input.postureId }
}

/** Avisa a las clases en vivo que están mostrando las posturas de este caso. */
async function notifyLivePostures(caseId: string): Promise<void> {
  const { data } = await db().from('live_sessions').select('id, overlay').eq('status', 'live')
  const targets = ((data ?? []) as Array<{ id: string; overlay: { type?: string; caseId?: string } | null }>).filter((l) => l.overlay?.type === 'postures' && l.overlay.caseId === caseId)
  if (!targets.length) return
  const dist = await getPostureDistribution(caseId)
  if (!dist) return
  await Promise.all(targets.map((t) => broadcast(t.id, 'postures.updated', { caseId, counts: dist.counts, total: dist.total })))
}

/**
 * Proyecta la distribución de un caso en la clase en vivo activa (overlay
 * `postures`). Prefiere la clase de la jornada del caso. Devuelve el id de
 * la clase o null si no hay ninguna en vivo.
 */
export async function projectCasePostures(caseId: string, actor = 'profesor'): Promise<string | null> {
  const caso = await getCase(caseId)
  if (!caso) throw new Error('No existe el caso')
  const live = await activeLiveSession(caso.class_session_id)
  if (!live) return null
  await setLiveOverlay(live.id, { type: 'postures', caseId }, actor)
  return live.id
}
