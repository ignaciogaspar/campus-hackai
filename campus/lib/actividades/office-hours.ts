import 'server-only'
import { db, COURSE_ID } from '@/lib/db'

/* Office hours: franjas que publican los profesores y reservas de los alumnos. */

export interface SlotBooking { id: string; person_id: string; name: string; company: string | null; topic: string; created_at: string }
export interface Slot {
  id: string
  teacher_id: string
  teacher_name: string
  starts_at: string
  minutes: number
  mode: 'online' | 'presencial'
  location: string | null
  capacity: number
  notes: string | null
  bookings: SlotBooking[]
}

/** Buenos Aires no tiene horario de verano: -03:00 fijo. */
export function baToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const d = new Date(`${date}T${time}:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function listSlots(opts: { from?: string; courseId?: string } = {}): Promise<Slot[]> {
  let q = db().from('office_hour_slots')
    .select('id, teacher_id, starts_at, minutes, mode, location, capacity, notes, teacher:people!office_hour_slots_teacher_id_fkey(full_name), office_hour_bookings(id, person_id, topic, created_at, people(full_name, company))')
    .eq('course_id', opts.courseId ?? COURSE_ID)
  if (opts.from) q = q.gte('starts_at', opts.from)
  const { data, error } = await q.order('starts_at')
  if (error) throw new Error(`office hours: ${error.message}`)
  type Raw = Omit<Slot, 'teacher_name' | 'bookings'> & {
    teacher: { full_name: string } | null
    office_hour_bookings: Array<{ id: string; person_id: string; topic: string; created_at: string; people: { full_name: string; company: string | null } | null }>
  }
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    teacher_id: r.teacher_id,
    teacher_name: r.teacher?.full_name ?? 'Profesor',
    starts_at: r.starts_at,
    minutes: r.minutes,
    mode: r.mode,
    location: r.location,
    capacity: r.capacity,
    notes: r.notes,
    bookings: (r.office_hour_bookings ?? []).map((b) => ({ id: b.id, person_id: b.person_id, name: b.people?.full_name ?? 'Alumno', company: b.people?.company ?? null, topic: b.topic, created_at: b.created_at }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
}

export async function listTeachers(courseId = COURSE_ID): Promise<Array<{ id: string; full_name: string }>> {
  const { data } = await db().from('people').select('id, full_name').eq('course_id', courseId).eq('role', 'profesor').order('full_name')
  return (data ?? []) as Array<{ id: string; full_name: string }>
}

export async function createSlot(input: { teacherId: string; startsAt: string; minutes: number; mode: string; location: string; capacity: number; notes: string }): Promise<string> {
  const { data, error } = await db().from('office_hour_slots').insert({
    course_id: COURSE_ID,
    teacher_id: input.teacherId,
    starts_at: input.startsAt,
    minutes: input.minutes,
    mode: input.mode === 'presencial' ? 'presencial' : 'online',
    location: input.location || null,
    capacity: input.capacity,
    notes: input.notes || null,
  }).select('id').single()
  if (error) throw new Error(`crear franja: ${error.message}`)
  return (data as { id: string }).id
}

export async function deleteSlot(slotId: string): Promise<void> {
  const { error } = await db().from('office_hour_slots').delete().eq('id', slotId)
  if (error) throw new Error(`borrar franja: ${error.message}`)
}

export type BookResult = 'ok' | 'lleno' | 'pasado' | 'ya' | 'no-existe'

export async function bookSlot(slotId: string, personId: string, topic: string): Promise<BookResult> {
  const { data, error } = await db().rpc('oh_book', { p_slot: slotId, p_person: personId, p_topic: topic })
  if (error) throw new Error(`reservar: ${error.message}`)
  return data as BookResult
}

export async function cancelBooking(slotId: string, personId: string): Promise<void> {
  const { error } = await db().from('office_hour_bookings').delete().eq('slot_id', slotId).eq('person_id', personId)
  if (error) throw new Error(`cancelar: ${error.message}`)
}
