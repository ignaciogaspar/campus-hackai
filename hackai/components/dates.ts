/* Fechas para mostrar, siempre en la hora de Buenos Aires. Solo presentación:
   qué fecha es cada cosa lo deciden los módulos del núcleo. */

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** «18 dic» */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' })
}

/** «10 nov, 11:40»: la hora de una lectura, para decir de cuándo es lo que se muestra. */
export function readTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** «vie, 13 nov, 23:59»: una fecha límite. */
export function dueTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
