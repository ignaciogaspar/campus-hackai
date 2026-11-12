/* Cómo se reparten en la pantalla las fechas que da Hoy: en el celular, las
   próximas 2 semanas, lo que viene después y lo que ya pasó; en compu, un
   calendario de esta semana y la próxima. Qué es un parcial, qué pasó y cuál
   es el próximo lo decide Hoy: acá solo se agrupa por día. */
import { spaceHref } from '@/components/spaces/format'
import type { CalendarEvent } from '@/components/ui/calendar-day'
import type { UpcomingItem } from '@/lib/core/studies'
import { addDays, dayKey, weekdayIndex } from '@/lib/dates'

/** Las 2 semanas de Hoy, en días: las próximas desde hoy en el celular, y esta semana y la próxima en compu. */
const TWO_WEEKS = 14

const isSame = (a: UpcomingItem, b: UpcomingItem | null) => a.id === b?.id

export type Agenda = {
  /** Hasta dos semanas desde hoy, sin el próximo parcial (va arriba). */
  soon: UpcomingItem[]
  /** El último día de las dos semanas, `AAAA-MM-DD`. */
  soonUntil: string
  /** Si el próximo parcial cae en estas dos semanas (y por eso no está en `soon`). */
  nextIsSoon: boolean
  later: UpcomingItem[]
  past: UpcomingItem[]
}

export function agendaOf(items: UpcomingItem[], now: string, next: UpcomingItem | null): Agenda {
  const soonUntil = addDays(dayKey(now), TWO_WEEKS - 1)
  const coming = items.filter((i) => !i.past && !isSame(i, next))
  return {
    soon: coming.filter((i) => dayKey(i.date) <= soonUntil),
    soonUntil,
    nextIsSoon: next !== null && dayKey(next.date) <= soonUntil,
    later: coming.filter((i) => dayKey(i.date) > soonUntil),
    past: items.filter((i) => i.past)
  }
}

export type CalendarCell = { day: string; number: number; today: boolean; past: boolean; events: CalendarEvent[] }

export type Calendar = {
  days: CalendarCell[]
  /** Lo que viene después del calendario. */
  after: UpcomingItem[]
  /** Lo que ya pasó antes de que empiece el calendario. */
  before: UpcomingItem[]
}

/** Esta semana y la próxima, de lunes a domingo. */
export function calendarOf(items: UpcomingItem[], now: string, next: UpcomingItem | null): Calendar {
  const today = dayKey(now)
  const first = addDays(today, -weekdayIndex(today))
  const last = addDays(first, TWO_WEEKS - 1)
  const days = Array.from({ length: TWO_WEEKS }, (_, i): CalendarCell => {
    const day = addDays(first, i)
    return {
      day,
      number: Number(day.slice(8)),
      today: day === today,
      past: day < today,
      events: items
        .filter((item) => dayKey(item.date) === day)
        .map((item) => ({
          id: item.id,
          code: item.subjectCode,
          title: item.name,
          href: spaceHref(item.subjectId),
          location: item.location,
          origin: item.source,
          past: item.past,
          next: isSame(item, next)
        }))
    }
  })
  return {
    days,
    after: items.filter((i) => dayKey(i.date) > last),
    before: items.filter((i) => dayKey(i.date) < first)
  }
}
