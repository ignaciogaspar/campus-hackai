/* Fechas para mostrar, siempre en la hora de Buenos Aires. Solo presentación:
   qué fecha es cada cosa lo deciden los módulos del núcleo, y las cuentas de
   días (qué día es, cuántos faltan) están en lib/dates.ts. */
import { dayKey, TIME_ZONE } from '@/lib/dates'

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('es-AR', { timeZone: TIME_ZONE, ...options })
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** «18 dic» */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
}

/** «23 nov» de un día `AAAA-MM-DD`: se toma al mediodía de Buenos Aires para que no se corra de día. */
export function shortDay(day: string): string {
  return shortDate(`${day}T12:00:00-03:00`)
}

/** «10 nov, 11:40»: la hora de una lectura, para decir de cuándo es lo que se muestra. */
export function readTime(iso: string): string {
  return format(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** «vie, 13 nov, 23:59»: una fecha límite, en 24 horas, como se escribe la hora acá. Con `now`, si es de otro año
    lleva el año: «jue, 1 ene 2026, 01:00». */
export function dueTime(iso: string, now?: string): string {
  const otherYear = now !== undefined && dayKey(iso).slice(0, 4) !== dayKey(now).slice(0, 4)
  return format(iso, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(otherYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
}

/** «13/11 a las 23:59»: cuándo cierra una entrega, corto, para una tarjeta. */
export function closesAt(iso: string): string {
  return `${format(iso, { day: 'numeric', month: 'numeric' })} a las ${timeOf(iso)}`
}

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

/** Las partes de una fecha para un bloque de día: «lun», «16», «nov». */
export function dayParts(iso: string): { weekday: string; day: string; month: string } {
  return {
    weekday: format(iso, { weekday: 'short' }).replace('.', ''),
    day: format(iso, { day: 'numeric' }),
    month: format(iso, { month: 'short' }).replace('.', '')
  }
}

/** «hace 5 min», «hace 3 h», «hace 2 días»: cuánto pasó desde `iso` hasta `now`. Menos de un minuto es «recién». */
export function timeAgo(iso: string, now: string): string {
  const minutes = Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}
