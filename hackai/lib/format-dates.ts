/* Fechas y horas para mostrar en pantalla, en español y en la hora de la
   Austral. Las cuentas de días (qué día es, cuántos faltan) están en
   lib/dates.ts. */
import { TIME_ZONE } from '@/lib/dates'

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

/** «sáb, 21 nov, 23:59»: el vencimiento de una tarea. */
export function dueTime(iso: string): string {
  return format(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
