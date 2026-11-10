import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import type { ClassSession } from '@/lib/db-types'
import { getCases, getClassSessions, type CaseSummary } from '@/lib/course'
import { listDecks, type DeckSummary } from '@/lib/decks/store'
import { JORNADA_MINUTES } from '@/lib/jornadas'
import { getTeachersBySession, type SessionTeacher } from '@/lib/organizacion/store'

/* Datos de los inicios (alumno y profesor): todo gira alrededor de la jornada que viene. */

const TZ = 'America/Argentina/Buenos_Aires'

export type FocoFase = 'vivo' | 'hoy' | 'proxima' | 'terminado'

export interface LiveNow { id: string; code: string; deck_id: string; class_session_id: string | null }

export interface Foco {
  session: ClassSession
  fase: FocoFase
  /** Días de calendario (Buenos Aires) hasta la jornada; 0 = hoy. */
  dias: number
  live: LiveNow | null
}

export interface InicioBase {
  sessions: ClassSession[]
  teachers: Map<string, SessionTeacher[]>
  decks: Map<string, DeckSummary>
  cases: CaseSummary[]
  casesBySession: Map<string, CaseSummary>
  lives: LiveNow[]
  foco: Foco | null
}

/** 'YYYY-MM-DD' en Buenos Aires. */
function diaBA(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function diasHasta(iso: string | null, now = new Date()): number {
  if (!iso) return 0
  const a = Date.parse(`${diaBA(now)}T00:00:00Z`)
  const b = Date.parse(`${diaBA(new Date(iso))}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function finDe(s: ClassSession): number {
  return s.starts_at ? Date.parse(s.starts_at) + JORNADA_MINUTES * 60_000 : 0
}

export type EstadoJornada = 'pasada' | 'hoy' | 'proxima' | 'futura'

/** Estado de cada jornada respecto de hoy, para la línea de tiempo. */
export function estadoJornada(s: ClassSession, foco: Foco | null, now = new Date()): EstadoJornada {
  if (foco && s.id === foco.session.id && foco.fase !== 'terminado') return foco.fase === 'proxima' ? 'proxima' : 'hoy'
  return finDe(s) < now.getTime() ? 'pasada' : 'futura'
}

/** Jornada en foco: la que está en vivo; si no, la de hoy o la próxima; si terminó todo, la última. */
function elegirFoco(sessions: ClassSession[], lives: LiveNow[], now = new Date()): Foco | null {
  if (!sessions.length) return null
  const live = lives[0] ?? null
  if (live) {
    const s = sessions.find((x) => x.id === live.class_session_id) ?? sessions.find((x) => x.deck_id === live.deck_id)
    if (s) return { session: s, fase: 'vivo', dias: 0, live }
  }
  const next = sessions.find((s) => finDe(s) > now.getTime())
  if (!next) return { session: sessions[sessions.length - 1], fase: 'terminado', dias: 0, live: null }
  const dias = diasHasta(next.starts_at, now)
  return { session: next, fase: dias <= 0 ? 'hoy' : 'proxima', dias, live: null }
}

export async function loadInicioBase(): Promise<InicioBase> {
  const [sessions, teachers, decks, cases, livesRes] = await Promise.all([
    getClassSessions(),
    getTeachersBySession().catch(() => new Map<string, SessionTeacher[]>()),
    listDecks(COURSE_ID).catch(() => [] as DeckSummary[]),
    getCases(),
    db().from('live_sessions').select('id, code, deck_id, class_session_id').eq('status', 'live').order('started_at', { ascending: false }).limit(5),
  ])
  const lives = (livesRes.data ?? []) as LiveNow[]
  const casesBySession = new Map<string, CaseSummary>()
  for (const c of cases) if (c.class_session_id && !casesBySession.has(c.class_session_id)) casesBySession.set(c.class_session_id, c)
  return {
    sessions,
    teachers,
    decks: new Map(decks.map((d) => [d.id, d])),
    cases,
    casesBySession,
    lives,
    foco: elegirFoco(sessions, lives),
  }
}

export interface RadarReciente { id: string; title: string; url: string | null; source: string | null; comments: number }

/** Últimas noticias del Radar con su cantidad de comentarios. */
export async function radarReciente(limit = 3): Promise<RadarReciente[]> {
  const { data } = await db().from('radar_items')
    .select('id, title, url, source, radar_comments(count)')
    .eq('course_id', COURSE_ID)
    .order('week_start', { ascending: false }).order('ordinal')
    .limit(limit)
  return ((data ?? []) as unknown as Array<{ id: string; title: string; url: string | null; source: string | null; radar_comments: Array<{ count: number }> }>)
    .map((r) => ({ id: r.id, title: r.title, url: r.url, source: r.source, comments: r.radar_comments?.[0]?.count ?? 0 }))
}

export interface ComentarioReciente { id: string; body: string; created_at: string; name: string; itemTitle: string }

/** Últimos comentarios del Radar (para el profesor). */
export async function comentariosRadarRecientes(limit = 5): Promise<ComentarioReciente[]> {
  const { data } = await db().from('radar_comments')
    .select('id, body, created_at, people(full_name), radar_items!inner(title, course_id)')
    .eq('radar_items.course_id', COURSE_ID)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as unknown as Array<{ id: string; body: string; created_at: string; people: { full_name: string } | null; radar_items: { title: string } | null }>)
    .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, name: c.people?.full_name ?? 'Ex participante', itemTitle: c.radar_items?.title ?? '' }))
}

export interface Aviso { id: string; title: string; body_md: string; created_at: string }

export async function avisosRecientes(limit = 3): Promise<Aviso[]> {
  const { data } = await db().from('announcements').select('id, title, body_md, created_at')
    .eq('course_id', COURSE_ID).order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as Aviso[]
}

export interface SlotProximo {
  id: string
  starts_at: string
  minutes: number
  mode: string
  teacher: string
  capacity: number
  bookings: Array<{ person_id: string; name: string; topic: string }>
}

/** Próximos horarios de office hours, con sus reservas. */
export async function officeHoursProximas(limit = 4): Promise<SlotProximo[]> {
  const { data } = await db().from('office_hour_slots')
    .select('id, starts_at, minutes, mode, capacity, teacher:people!office_hour_slots_teacher_id_fkey(full_name), office_hour_bookings(person_id, topic, people(full_name))')
    .eq('course_id', COURSE_ID)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(limit)
  type Raw = { id: string; starts_at: string; minutes: number; mode: string; capacity: number; teacher: { full_name: string } | null; office_hour_bookings: Array<{ person_id: string; topic: string; people: { full_name: string } | null }> }
  return ((data ?? []) as unknown as Raw[]).map((s) => ({
    id: s.id, starts_at: s.starts_at, minutes: s.minutes, mode: s.mode, capacity: s.capacity,
    teacher: s.teacher?.full_name ?? '',
    bookings: (s.office_hour_bookings ?? []).map((b) => ({ person_id: b.person_id, name: b.people?.full_name ?? '', topic: b.topic })),
  }))
}
