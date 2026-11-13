/* Cómo se ve una clase del Planning en el calendario: el mismo bloque que una
   clase de Calendario, con la facultad como sigla y el aula y el edificio como
   lugar. Qué clase hay cada día y qué cambió lo decide Planning: acá solo se
   ubica y se filtra. */
import type { CalendarEvent } from '@/components/today/calendar-layout'
import { hhmm } from '@/components/today/calendar-layout'
import type { PlanningClass, PlanningEntryInput } from '@/lib/core/planning'
import { plainText } from '@/lib/plain-text'

/** Sin tildes ni mayúsculas, para comparar el nombre de una materia con el del SIU. */
export const plainName = plainText

const CHANGE: Record<NonNullable<PlanningClass['change']>, string> = {
  cambio: 'Cambio de último momento',
  suspendida: 'Suspendida',
  extra: 'Clase extra'
}

/** Una clase del Planning como evento del calendario. */
export function eventOf(c: PlanningClass, today: string): CalendarEvent {
  return {
    id: c.id,
    day: c.day,
    minutes: c.start,
    end: c.end,
    // Un bloque de menos de hora y media en la grilla muestra solo el nombre y la hora: el aula va con la hora.
    time: `${hhmm(c.start)} – ${hhmm(c.end)}${c.end - c.start < 90 ? ` · ${c.room}` : ''}`,
    code: c.school || null,
    title: c.subject,
    subject: [c.section && `Comisión ${c.section}`, c.change && CHANGE[c.change]].filter(Boolean).join(' · '),
    place: [c.room, c.building].filter(Boolean).join(' · '),
    tone: c.change === 'suspendida' ? 'suspendida' : 'clase',
    origin: 'hackai',
    past: c.day < today,
    next: false
  }
}

export type PlanningFilters = {
  school: string
  building: string
  room: string
  subject: string
  onlyMine: boolean
}

export const NO_FILTERS: PlanningFilters = { school: '', building: '', room: '', subject: '', onlyMine: false }

/** Si la clase pasa los filtros elegidos. `mine` son los nombres de sus materias, ya sin tildes. */
export function matches(c: PlanningClass, f: PlanningFilters, mine: Set<string>): boolean {
  return (
    (!f.school || c.school === f.school) &&
    (!f.building || c.building === f.building) &&
    (!f.room || c.room === f.room) &&
    (!f.subject || c.subject === f.subject) &&
    (!f.onlyMine || mine.has(plainName(c.subject)))
  )
}

/** Los valores distintos de un campo, ordenados, para un filtro. */
export const optionsOf = (classes: PlanningClass[], pick: (c: PlanningClass) => string) =>
  [...new Set(classes.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))

const WEEKDAYS: Record<NonNullable<PlanningEntryInput['weekday']>, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado'
}

/** «Lunes» o «13/11/2026». */
export function whenLabel(e: Pick<PlanningEntryInput, 'weekday' | 'date'>): string {
  if (e.weekday) return `${WEEKDAYS[e.weekday]}, cada semana`
  return e.date ? e.date.split('-').reverse().join('/') : ''
}

/** Un aula como columna de la grilla del día: su edificio y su nombre. */
export type RoomColumn = { key: string; building: string; room: string }

/** La clave de un aula: el mismo nombre en dos edificios son dos aulas. */
export const roomKeyOf = (c: Pick<PlanningClass, 'building' | 'room'>) => `${c.building}\u0000${c.room}`

/** Las aulas de esas clases, sin repetir y ordenadas por edificio y por nombre («Aula 2» antes que «Aula 10»). */
export function roomColumns(classes: PlanningClass[]): RoomColumn[] {
  const found = new Map<string, RoomColumn>()
  for (const c of classes) found.set(roomKeyOf(c), { key: roomKeyOf(c), building: c.building, room: c.room })
  return [...found.values()].sort(
    (a, b) => a.building.localeCompare(b.building, 'es') || a.room.localeCompare(b.room, 'es', { numeric: true })
  )
}

/** La media hora: cada fila de la grilla del día. */
export const HALF_HOUR = 30

/** Desde y hasta qué minuto va la grilla del día: al menos de 8 a 20, estirada a la media hora si algo empieza antes
    o termina después. */
export function dayRange(classes: PlanningClass[]): { from: number; to: number } {
  const from = Math.min(8 * 60, ...classes.map((c) => c.start))
  const to = Math.max(20 * 60, ...classes.map((c) => c.end))
  return { from: Math.floor(from / HALF_HOUR) * HALF_HOUR, to: Math.ceil(to / HALF_HOUR) * HALF_HOUR }
}
