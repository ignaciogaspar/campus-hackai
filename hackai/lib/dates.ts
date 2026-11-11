/* Días y horas en la hora de la Austral. Las fechas viajan en ISO 8601 (UTC);
   para saber qué día es algo (hoy, mañana, esta semana) y para mostrarlo se
   miran en Buenos Aires. */

export const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DAY_MS = 86_400_000

/** El día de un instante en Buenos Aires, como `AAAA-MM-DD`. */
export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

/** Días de calendario de una fecha a otra en Buenos Aires: del domingo a la noche al lunes a la mañana hay uno. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(dayKey(to)) - Date.parse(dayKey(from))) / DAY_MS)
}

/** El día `AAAA-MM-DD` que está `days` días después de otro. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Qué día de la semana es un día `AAAA-MM-DD`, con el lunes como 0. */
export function weekdayIndex(day: string): number {
  return (new Date(Date.parse(day)).getUTCDay() + 6) % 7
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('es-AR', { timeZone: TIME_ZONE, ...options })
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** «Lunes 16 de noviembre». */
export function longDay(iso: string): string {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${capitalize(part('weekday'))} ${part('day')} de ${part('month')}`
}

/** «08:00». */
export function timeOf(iso: string): string {
  return format(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** «4/12». */
export function shortDate(iso: string): string {
  return format(iso, { day: 'numeric', month: 'numeric' })
}

/** «24/11» de un día `AAAA-MM-DD` (no es un instante: no se corre de zona horaria). */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${date}/${month}`
}

/** «16 nov, 08:00»: la hora de una lectura. */
export function readTime(iso: string): string {
  return format(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Las partes de una fecha para un bloque de día: «lun», «16», «nov». */
export function dayParts(iso: string): { weekday: string; day: string; month: string } {
  return {
    weekday: format(iso, { weekday: 'short' }).replace('.', ''),
    day: format(iso, { day: 'numeric' }),
    month: format(iso, { month: 'short' }).replace('.', '')
  }
}
