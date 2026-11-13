/* Cómo se ve una clase del Planning en el calendario: el mismo bloque que una
   clase de Calendario, con la facultad como sigla y el aula y el edificio como
   lugar. Qué clase hay cada día y qué cambió lo decide Planning: acá solo se
   ubica y se filtra. */
import type { CalendarEvent } from '@/components/today/calendar-layout'
import { hhmm } from '@/components/today/calendar-layout'
import type { PlanningClass, PlanningEntryInput } from '@/lib/core/planning'

/** Sin tildes ni mayúsculas, para comparar el nombre de una materia con el del SIU. */
export const plainName = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

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
    time: `${hhmm(c.start)} – ${hhmm(c.end)}`,
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

/** «540» → «9:00», para la pantalla de secretaría. */
export const timeOf = (minutes: number) => hhmm(minutes)

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
