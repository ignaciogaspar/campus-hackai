/* Lo que el calendario responde antes de la semana: qué vence esta semana y
   cuál es el próximo parcial y el próximo final, y la lista de próximas fechas,
   que corta en unas pocas sin dejar afuera esos dos. Sin reglas de negocio: qué
   es cada fecha y qué ya pasó lo decide Hoy; acá solo se elige qué mostrar. */
import { mondayOf } from '@/components/today/calendar-layout'
import type { UpcomingItem } from '@/lib/core/studies'
import { addDays, dayKey, daysBetween } from '@/lib/dates'

export type CalendarSummary = {
  /** Las entregas que vencen de hoy al domingo, sin las que ya pasaron. */
  dueThisWeek: UpcomingItem[]
  /** El próximo parcial o recuperatorio. */
  nextExam: UpcomingItem | null
  nextFinal: UpcomingItem | null
}

const EXAMS: UpcomingItem['kind'][] = ['parcial', 'recuperatorio']

const byDate = (a: UpcomingItem, b: UpcomingItem) => a.date.localeCompare(b.date)

/** Lo que no pasó, por fecha. */
const aheadOf = (items: UpcomingItem[]) => items.filter((i) => !i.past).sort(byDate)

const nextExamIn = (ahead: UpcomingItem[]) => ahead.find((i) => EXAMS.includes(i.kind)) ?? null
const nextFinalIn = (ahead: UpcomingItem[]) => ahead.find((i) => i.kind === 'final') ?? null

export function summaryOf(items: UpcomingItem[], now: string): CalendarSummary {
  const ahead = aheadOf(items)
  const sunday = addDays(mondayOf(dayKey(now)), 6)
  return {
    dueThisWeek: ahead.filter((i) => i.kind === 'entrega' && dayKey(i.date) <= sunday),
    nextExam: nextExamIn(ahead),
    nextFinal: nextFinalIn(ahead)
  }
}

/** Las próximas `limit` fechas y, si quedaron afuera, el próximo parcial y el próximo final, por fecha. */
export function nextDatesOf(items: UpcomingItem[], limit = 6): UpcomingItem[] {
  const ahead = aheadOf(items)
  const shown = ahead.slice(0, limit)
  const extra = [nextExamIn(ahead), nextFinalIn(ahead)].filter(
    (i): i is UpcomingItem => i !== null && !shown.includes(i)
  )
  return [...shown, ...extra].sort(byDate)
}

/** «hoy», «mañana» o «en 13 días», en días de calendario de Buenos Aires. */
export function inDays(date: string, now: string): string {
  const days = daysBetween(now, date)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days} días`
}
