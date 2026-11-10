import 'server-only'
import { db, COURSE_ID } from '@/lib/db'
import type { ActivityEntry, ActivityItem, ActivityState, RosterPerson } from './types'

/* Acceso a datos de las actividades (server, service role). */

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

export async function getRoster(courseId = COURSE_ID): Promise<RosterPerson[]> {
  const { data, error } = await db().from('people').select('id, full_name, company, position, photo_url')
    .eq('course_id', courseId).eq('role', 'alumno').order('full_name')
  fail('padrón', error)
  return (data ?? []) as RosterPerson[]
}

export async function getActivityState(activityId: string): Promise<ActivityState> {
  const { data, error } = await db().from('activity_state').select('state').eq('activity_id', activityId).maybeSingle()
  fail('estado', error)
  return ((data?.state ?? {}) as ActivityState)
}

export async function patchActivityState(activityId: string, patch: Partial<ActivityState>, by: string | null): Promise<ActivityState> {
  const current = await getActivityState(activityId)
  const next: ActivityState = { ...current, ...patch }
  const { error } = await db().from('activity_state').upsert({ activity_id: activityId, state: next, updated_by: by, updated_at: new Date().toISOString() })
  fail('guardar estado', error)
  return next
}

export async function getEntry(activityId: string, personId: string): Promise<ActivityEntry | null> {
  const { data, error } = await db().from('activity_entries').select('person_id, data, updated_at').eq('activity_id', activityId).eq('person_id', personId).maybeSingle()
  fail('entrada', error)
  return (data as ActivityEntry | null) ?? null
}

export async function listEntries(activityId: string): Promise<ActivityEntry[]> {
  const { data, error } = await db().from('activity_entries').select('person_id, data, updated_at').eq('activity_id', activityId).order('updated_at', { ascending: false })
  fail('entradas', error)
  return (data ?? []) as ActivityEntry[]
}

export async function saveEntry(activityId: string, personId: string, data: Record<string, unknown>): Promise<ActivityEntry> {
  const now = new Date().toISOString()
  const { data: row, error } = await db().from('activity_entries')
    .upsert({ activity_id: activityId, person_id: personId, data, updated_at: now }, { onConflict: 'activity_id,person_id' })
    .select('person_id, data, updated_at').single()
  fail('guardar entrada', error)
  return row as ActivityEntry
}

const ITEM_COLUMNS = 'id, activity_id, kind, person_id, target_person_id, data, created_at, updated_at'

export async function listItems(activityId: string, opts: { kind?: string; involving?: string } = {}): Promise<ActivityItem[]> {
  let query = db().from('activity_items').select(ITEM_COLUMNS).eq('activity_id', activityId)
  if (opts.kind) query = query.eq('kind', opts.kind)
  if (opts.involving) query = query.or(`person_id.eq.${opts.involving},target_person_id.eq.${opts.involving}`)
  const { data, error } = await query.order('created_at', { ascending: true })
  fail('registros', error)
  return (data ?? []) as ActivityItem[]
}

export async function getItem(itemId: string): Promise<ActivityItem | null> {
  const { data, error } = await db().from('activity_items').select(ITEM_COLUMNS).eq('id', itemId).maybeSingle()
  fail('registro', error)
  return (data as ActivityItem | null) ?? null
}

export async function addItem(row: { activityId: string; kind: string; personId: string; targetPersonId: string | null; data: Record<string, unknown> }): Promise<ActivityItem> {
  const { data, error } = await db().from('activity_items').insert({
    activity_id: row.activityId, kind: row.kind, person_id: row.personId, target_person_id: row.targetPersonId, data: row.data,
  }).select(ITEM_COLUMNS).single()
  fail('agregar registro', error)
  return data as ActivityItem
}

export async function updateItemData(itemId: string, data: Record<string, unknown>): Promise<ActivityItem> {
  const { data: row, error } = await db().from('activity_items').update({ data, updated_at: new Date().toISOString() }).eq('id', itemId).select(ITEM_COLUMNS).single()
  fail('actualizar registro', error)
  return row as ActivityItem
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await db().from('activity_items').delete().eq('id', itemId)
  fail('borrar registro', error)
}

/** Un voto por persona y presentador (índice único parcial): reemplaza el anterior. */
export async function upsertVote(activityId: string, voterId: string, presenterId: string, data: Record<string, unknown>): Promise<void> {
  const client = db()
  const { data: existing } = await client.from('activity_items').select('id').eq('activity_id', activityId).eq('kind', 'voto')
    .eq('person_id', voterId).eq('target_person_id', presenterId).maybeSingle()
  if (existing) {
    await updateItemData((existing as { id: string }).id, data)
    return
  }
  const { error } = await client.from('activity_items').insert({ activity_id: activityId, kind: 'voto', person_id: voterId, target_person_id: presenterId, data })
  if (error && /duplicate|23505/.test(error.message)) {
    // Dos clicks a la vez: el otro insert ganó; actualizamos ese.
    const { data: again } = await client.from('activity_items').select('id').eq('activity_id', activityId).eq('kind', 'voto')
      .eq('person_id', voterId).eq('target_person_id', presenterId).single()
    if (again) await updateItemData((again as { id: string }).id, data)
    return
  }
  fail('votar', error)
}

/** Cuántas entradas hay por actividad (tablero del profesor). */
export async function entryCounts(): Promise<Map<string, number>> {
  const { data, error } = await db().from('activity_entries').select('activity_id')
  fail('conteo', error)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ activity_id: string }>) map.set(r.activity_id, (map.get(r.activity_id) ?? 0) + 1)
  return map
}

export async function itemCounts(): Promise<Map<string, number>> {
  const { data, error } = await db().from('activity_items').select('activity_id')
  fail('conteo', error)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ activity_id: string }>) map.set(r.activity_id, (map.get(r.activity_id) ?? 0) + 1)
  return map
}
