import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import type { ClassSession } from '@/lib/db-types'
import type { CasePosture, CaseRow } from '@/lib/classroom/types'
import type { DeckChapter } from '@/lib/decks/types'
import { getClassSessions, type SimSummary } from '@/lib/course'
import { activitiesBySession, type ActivityDef } from '@/lib/actividades/catalog'
import { listConcepts, listContentItems, type Concept, type ContentItem } from '@/lib/content/server'
import { getTeachersBySession, type SessionTeacher } from '@/lib/organizacion/store'
import { loadBundle, loadStudentView } from '@/lib/assignments/store'
import { getCaseTeacherView, type CaseTeacherView } from '@/lib/classroom/cases'

/* Vista por jornada: junta en un solo lugar la clase, el caso, las actividades,
   las entregas, los conceptos, los materiales y los simuladores de una jornada.
   Lo que depende del rol (estado del alumno, tablero del profesor) lo cargan
   loadJornadaAlumno / loadJornadaProfesor encima de loadJornada. */

/** Duración de cada jornada: 18:30 a 22:00. */
export const JORNADA_MINUTES = 210
export const JORNADA_LUGAR = 'DOT Baires'

export const jornadaId = (n: number) => `aicm-j${n}`

export interface JornadaDeck {
  id: string
  title: string
  question: string | null
  chapters: DeckChapter[]
  slideCount: number
}

export interface JornadaAssignment { id: string; title: string; due_at: string | null; status: string; peer_reviews_per_submission: number }

export interface JornadaData {
  session: ClassSession
  sessions: ClassSession[]
  prev: ClassSession | null
  next: ClassSession | null
  deck: JornadaDeck | null
  teachers: SessionTeacher[]
  cases: CaseRow[]
  activities: ActivityDef[]
  assignments: JornadaAssignment[]
  concepts: Concept[]
  materials: ContentItem[]
  sims: SimSummary[]
  /** Hay office hours entre esta jornada y la siguiente. */
  officeHours: number
  /** Noticias del radar de la semana de la jornada. */
  radar: number
}


const CASE_COLUMNS = 'id, course_id, class_session_id, title, protagonist, summary, body_md, question, postures, teacher_notes, is_fictional, opens_at, closes_at'

/** Hora de Buenos Aires: '18:30'. */
export function hora(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function finJornada(startsAt: string | null): string | null {
  return startsAt ? new Date(new Date(startsAt).getTime() + JORNADA_MINUTES * 60_000).toISOString() : null
}

/** Simuladores que aparecen en slides `:::simulador <id>` del deck. */
function simIdsFrom(rows: Array<{ slides: { markdown: string } | null }>): string[] {
  const ids: string[] = []
  for (const r of rows) {
    const m = r.slides?.markdown.match(/^:::simulador\s+([\w-]+)/)
    if (m && !ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

/** Todo lo común de la jornada N (1-based). null si no existe. */
export async function loadJornada(n: number): Promise<JornadaData | null> {
  if (!Number.isInteger(n) || n < 1) return null
  const sessions = await getClassSessions()
  const i = sessions.findIndex((s) => s.ordinal === n)
  if (i < 0) return null
  const session = sessions[i]
  const next = sessions[i + 1] ?? null
  const deckId = session.deck_id

  const weekStart = session.starts_at ? mondayOf(session.starts_at) : null
  const ohFrom = session.starts_at ?? new Date().toISOString()
  const ohTo = next?.starts_at ?? new Date(new Date(ohFrom).getTime() + 7 * 86_400_000).toISOString()

  const [deckRes, simSlidesRes, casesRes, assignRes, teachers, items, concepts, ohRes, radarRes] = await Promise.all([
    deckId ? db().from('decks').select('id, title, question, chapters, deck_slides(count)').eq('id', deckId).maybeSingle() : Promise.resolve({ data: null }),
    deckId
      ? db().from('deck_slides').select('position, slides!inner(markdown)').eq('deck_id', deckId).like('slides.markdown', ':::simulador%').order('position')
      : Promise.resolve({ data: [] }),
    db().from('cases').select(CASE_COLUMNS).eq('class_session_id', session.id).eq('is_active', true).order('id'),
    db().from('assignments').select('id, title, due_at, status, peer_reviews_per_submission').eq('class_session_id', session.id).neq('status', 'borrador').order('due_at', { ascending: true, nullsFirst: false }),
    getTeachersBySession().catch(() => new Map<string, SessionTeacher[]>()),
    listContentItems().catch(() => [] as ContentItem[]),
    listConcepts().catch(() => [] as Concept[]),
    db().from('office_hour_slots').select('id', { count: 'exact', head: true }).eq('course_id', COURSE_ID).gte('starts_at', ohFrom).lt('starts_at', ohTo),
    weekStart ? db().from('radar_items').select('id', { count: 'exact', head: true }).eq('course_id', COURSE_ID).eq('week_start', weekStart) : Promise.resolve({ count: 0 }),
  ])

  const d = deckRes.data as { id: string; title: string; question: string | null; chapters: DeckChapter[] | null; deck_slides: Array<{ count: number }> } | null
  const deck: JornadaDeck | null = d
    ? { id: d.id, title: d.title, question: d.question, chapters: Array.isArray(d.chapters) ? d.chapters : [], slideCount: d.deck_slides?.[0]?.count ?? 0 }
    : null

  const simIds = simIdsFrom((simSlidesRes.data ?? []) as unknown as Array<{ slides: { markdown: string } | null }>)
  let sims: SimSummary[] = []
  if (simIds.length) {
    const { data } = await db().from('sim_definitions').select('id, title, description, url').in('id', simIds)
    const byId = new Map(((data ?? []) as SimSummary[]).map((s) => [s.id, s]))
    sims = simIds.map((id) => byId.get(id)).filter((s): s is SimSummary => !!s)
  }

  const cases = ((casesRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as CaseRow),
    postures: Array.isArray(row.postures) ? (row.postures as CasePosture[]).filter((p) => p && typeof p.id === 'string') : [],
  })).filter((c) => !c.is_fictional)

  return {
    session,
    sessions,
    prev: sessions[i - 1] ?? null,
    next,
    deck,
    teachers: teachers.get(session.id) ?? [],
    cases,
    activities: activitiesBySession().get(session.id) ?? [],
    assignments: (assignRes.data ?? []) as JornadaAssignment[],
    concepts: concepts.filter((c) => c.classSessionId === session.id),
    materials: items.filter((it) => it.classSessionId === session.id),
    sims,
    officeHours: ohRes.count ?? 0,
    radar: (radarRes as { count: number | null }).count ?? 0,
  }
}

/** Lunes (fecha de Buenos Aires) de la semana de `iso`, como en el radar. */
function mondayOf(iso: string): string {
  const ba = new Date(new Date(iso).getTime() - 3 * 3600_000)
  const diff = (ba.getUTCDay() + 6) % 7
  return new Date(Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate() - diff)).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- alumno

export interface AlumnoJornada {
  postures: Map<string, string>
  activitiesDone: Set<string>
  entregas: Map<string, { submitted: boolean; reviewed: boolean; grade: number | null }>
  marks: { noEntendi: number; total: number; notes: number }
}

export async function loadJornadaAlumno(j: JornadaData, personId: string): Promise<AlumnoJornada> {
  const caseIds = j.cases.map((c) => c.id)
  const actIds = j.activities.map((a) => a.id)
  const deckId = j.deck?.id
  const [posRes, actRes, marksRes, notesRes, views] = await Promise.all([
    caseIds.length ? db().from('case_postures').select('case_id, posture_id').eq('person_id', personId).in('case_id', caseIds) : Promise.resolve({ data: [] }),
    actIds.length ? db().from('activity_entries').select('activity_id').eq('person_id', personId).in('activity_id', actIds) : Promise.resolve({ data: [] }),
    deckId ? db().from('slide_marks').select('kind').eq('person_id', personId).eq('deck_id', deckId) : Promise.resolve({ data: [] }),
    deckId ? db().from('slide_notes').select('id', { count: 'exact', head: true }).eq('person_id', personId).eq('deck_id', deckId) : Promise.resolve({ count: 0 }),
    Promise.all(j.assignments.map((a) => loadStudentView(a.id, personId).catch(() => null))),
  ])
  const entregas = new Map<string, { submitted: boolean; reviewed: boolean; grade: number | null }>()
  j.assignments.forEach((a, k) => {
    const v = views[k]
    entregas.set(a.id, {
      submitted: !!v?.mySubmission,
      reviewed: !!v?.received.some((r) => r.review.is_teacher),
      grade: v?.grade?.final ?? null,
    })
  })
  const marks = (marksRes.data ?? []) as Array<{ kind: string }>
  return {
    postures: new Map(((posRes.data ?? []) as Array<{ case_id: string; posture_id: string }>).map((p) => [p.case_id, p.posture_id])),
    activitiesDone: new Set(((actRes.data ?? []) as Array<{ activity_id: string }>).map((x) => x.activity_id)),
    entregas,
    marks: { noEntendi: marks.filter((m) => m.kind === 'no-entendi').length, total: marks.length, notes: (notesRes as { count: number | null }).count ?? 0 },
  }
}

// ---------------------------------------------------------------- profesor

export interface ProfesorJornada {
  roster: number
  caseViews: Map<string, CaseTeacherView>
  activityPeople: Map<string, number>
  entregas: Map<string, { submitted: number; students: number; teacherReviewed: number }>
  live: { id: string; code: string; status: string; started_at: string } | null
  lastLiveTranscript: number
  participation: number
  polls: { draft: number; total: number }
  marks: { noEntendi: number; notes: number }
}

export async function loadJornadaProfesor(j: JornadaData): Promise<ProfesorJornada> {
  const deckId = j.deck?.id
  const actIds = j.activities.map((a) => a.id)
  const [rosterRes, caseViews, actRes, bundles, liveRes, partRes, pollsRes, marksRes, notesRes] = await Promise.all([
    db().from('people').select('id', { count: 'exact', head: true }).eq('course_id', COURSE_ID).eq('role', 'alumno'),
    Promise.all(j.cases.map((c) => getCaseTeacherView(c.id))),
    actIds.length ? db().from('activity_entries').select('activity_id, person_id').in('activity_id', actIds) : Promise.resolve({ data: [] }),
    Promise.all(j.assignments.map((a) => loadBundle(a.id).catch(() => null))),
    db().from('live_sessions').select('id, code, status, started_at').eq('class_session_id', j.session.id).order('started_at', { ascending: false }).limit(1),
    db().from('participation').select('id', { count: 'exact', head: true }).eq('class_session_id', j.session.id),
    deckId ? db().from('polls').select('status').eq('deck_id', deckId) : Promise.resolve({ data: [] }),
    deckId ? db().from('slide_marks').select('id', { count: 'exact', head: true }).eq('deck_id', deckId).eq('kind', 'no-entendi') : Promise.resolve({ count: 0 }),
    deckId ? db().from('slide_notes').select('id', { count: 'exact', head: true }).eq('deck_id', deckId) : Promise.resolve({ count: 0 }),
  ])
  const live = ((liveRes.data ?? []) as ProfesorJornada['live'][])[0] ?? null
  let lastLiveTranscript = 0
  if (live) {
    const { count } = await db().from('transcript_segments').select('id', { count: 'exact', head: true }).eq('live_session_id', live.id)
    lastLiveTranscript = count ?? 0
  }
  const activityPeople = new Map<string, number>()
  const seen = new Set<string>()
  for (const r of (actRes.data ?? []) as Array<{ activity_id: string; person_id: string }>) {
    const k = `${r.activity_id}:${r.person_id}`
    if (seen.has(k)) continue
    seen.add(k)
    activityPeople.set(r.activity_id, (activityPeople.get(r.activity_id) ?? 0) + 1)
  }
  const entregas = new Map<string, { submitted: number; students: number; teacherReviewed: number }>()
  j.assignments.forEach((a, k) => {
    const b = bundles[k]
    entregas.set(a.id, {
      submitted: b?.submissions.length ?? 0,
      students: b?.students.length ?? 0,
      teacherReviewed: b ? new Set(b.reviews.filter((r) => r.is_teacher && r.status === 'enviada').map((r) => r.submission_id)).size : 0,
    })
  })
  const polls = (pollsRes.data ?? []) as Array<{ status: string }>
  return {
    roster: rosterRes.count ?? 0,
    caseViews: new Map(caseViews.filter((v): v is NonNullable<typeof v> => !!v).map((v) => [v.caso.id, v])),
    activityPeople,
    entregas,
    live,
    lastLiveTranscript,
    participation: partRes.count ?? 0,
    polls: { draft: polls.filter((p) => p.status === 'draft').length, total: polls.length },
    marks: { noEntendi: (marksRes as { count: number | null }).count ?? 0, notes: (notesRes as { count: number | null }).count ?? 0 },
  }
}

/** Resumen corto para el índice de jornadas. */
export interface JornadaResumen { session: ClassSession; teachers: SessionTeacher[]; caseTitle: string | null; activities: number; assignments: string[] }

export async function listJornadasResumen(): Promise<JornadaResumen[]> {
  const [sessions, teachers, casesRes, assignRes] = await Promise.all([
    getClassSessions(),
    getTeachersBySession().catch(() => new Map<string, SessionTeacher[]>()),
    db().from('cases').select('class_session_id, title, is_fictional').eq('course_id', COURSE_ID).eq('is_active', true),
    db().from('assignments').select('class_session_id, title').eq('course_id', COURSE_ID).neq('status', 'borrador'),
  ])
  const acts = activitiesBySession()
  const cases = (casesRes.data ?? []) as Array<{ class_session_id: string | null; title: string; is_fictional: boolean }>
  const assigns = (assignRes.data ?? []) as Array<{ class_session_id: string | null; title: string }>
  return sessions.map((s) => ({
    session: s,
    teachers: teachers.get(s.id) ?? [],
    caseTitle: cases.find((c) => c.class_session_id === s.id && !c.is_fictional)?.title ?? null,
    activities: acts.get(s.id)?.length ?? 0,
    assignments: assigns.filter((a) => a.class_session_id === s.id).map((a) => a.title),
  }))
}
