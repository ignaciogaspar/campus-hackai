import 'server-only'
import { db, COURSE_ID } from '@/lib/db'

/* Radar semanal: el profesor publica 3 noticias por semana y la cohorte las comenta. */

export const RADAR_PER_WEEK = 3
export const RADAR_COMMENT_MAX = 1000

export interface RadarComment { id: string; person_id: string | null; name: string; role: 'profesor' | 'alumno' | null; body: string; created_at: string }
export interface RadarItem {
  id: string
  week_start: string
  ordinal: number
  title: string
  url: string | null
  source: string | null
  summary: string
  created_at: string
  comments: RadarComment[]
}

/** Lunes (fecha de Buenos Aires) de la semana de `d`. */
export function mondayOf(d = new Date()): string {
  const ba = new Date(d.getTime() - 3 * 3600_000)
  const day = ba.getUTCDay() // 0 domingo
  const diff = (day + 6) % 7
  const monday = new Date(Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate() - diff))
  return monday.toISOString().slice(0, 10)
}

export async function listRadar(courseId = COURSE_ID): Promise<RadarItem[]> {
  const { data, error } = await db().from('radar_items')
    .select('id, week_start, ordinal, title, url, source, summary, created_at, radar_comments(id, person_id, body, created_at, people(full_name, role))')
    .eq('course_id', courseId)
    .order('week_start', { ascending: false }).order('ordinal')
  if (error) throw new Error(`radar: ${error.message}`)
  type Raw = Omit<RadarItem, 'comments'> & { radar_comments: Array<{ id: string; person_id: string | null; body: string; created_at: string; people: { full_name: string; role: 'profesor' | 'alumno' } | null }> }
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id, week_start: r.week_start, ordinal: r.ordinal, title: r.title, url: r.url, source: r.source, summary: r.summary, created_at: r.created_at,
    comments: (r.radar_comments ?? [])
      .map((c) => ({ id: c.id, person_id: c.person_id, name: c.people?.full_name ?? 'Ex participante', role: c.people?.role ?? null, body: c.body, created_at: c.created_at }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}

export function byWeek(items: RadarItem[]): Array<{ week: string; items: RadarItem[] }> {
  const map = new Map<string, RadarItem[]>()
  for (const it of items) map.set(it.week_start, [...(map.get(it.week_start) ?? []), it])
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([week, list]) => ({ week, items: list.sort((a, b) => a.ordinal - b.ordinal) }))
}

export async function publishRadarItem(input: { week: string; title: string; url: string; source: string; summary: string; by: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = db()
  const { count } = await client.from('radar_items').select('id', { count: 'exact', head: true }).eq('course_id', COURSE_ID).eq('week_start', input.week)
  if ((count ?? 0) >= RADAR_PER_WEEK) return { ok: false, error: `Esa semana ya tiene ${RADAR_PER_WEEK} noticias. Borrá una para publicar otra.` }
  const { error } = await client.from('radar_items').insert({
    course_id: COURSE_ID, week_start: input.week, ordinal: (count ?? 0) + 1,
    title: input.title, url: input.url || null, source: input.source || null, summary: input.summary, created_by: input.by,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteRadarItem(id: string): Promise<void> {
  const { error } = await db().from('radar_items').delete().eq('id', id)
  if (error) throw new Error(`borrar noticia: ${error.message}`)
}

export async function addRadarComment(itemId: string, personId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = db()
  const { data } = await client.from('radar_items').select('id').eq('id', itemId).eq('course_id', COURSE_ID).maybeSingle()
  if (!data) return { ok: false, error: 'Esa noticia ya no está.' }
  const { error } = await client.from('radar_comments').insert({ item_id: itemId, person_id: personId, body })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Borra un comentario: el autor o cualquier profesor. */
export async function deleteRadarComment(commentId: string, personId: string, isProfesor: boolean): Promise<boolean> {
  let q = db().from('radar_comments').delete().eq('id', commentId)
  if (!isProfesor) q = q.eq('person_id', personId)
  const { data, error } = await q.select('id')
  if (error) throw new Error(`borrar comentario: ${error.message}`)
  return (data ?? []).length > 0
}
