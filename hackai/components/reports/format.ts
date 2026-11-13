/* Textos de Reportes que dependen de los datos: el corte del reporte, los nombres de los días y las horas del
   Planning. Solo presentación. */
import { shortDay } from '@/components/dates'
import type { ScheduleSlot } from '@/lib/core/reports'

/** «al cierre de 2021» o, en el año actual, «al 13 nov». */
export function cutoffText(year: number, cutoff: string): string {
  return cutoff === `${year}-12-31` ? `al cierre de ${year}` : `al ${shortDay(cutoff)}`
}

const WEEKDAY: Record<ScheduleSlot['weekday'], string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado'
}

export const weekdayText = (day: ScheduleSlot['weekday']) => WEEKDAY[day]

/** «9:00» de minutos desde la medianoche. */
export function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/** «1.234» con el separador de miles de acá. */
export const count = (n: number) => n.toLocaleString('es-AR')

/** «12 %» de una parte sobre el total, o «—» si no hay total. */
export function share(part: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)} %`
}
