/* Días de calendario en la hora de la Austral. Las fechas viajan en ISO 8601
   (UTC); para saber qué día es algo (hoy, mañana, esta semana) se miran en
   Buenos Aires. Cómo se muestran está en components/dates.ts. */

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

/** El instante ISO de una hora `HH:MM` de un día `AAAA-MM-DD` en Buenos Aires (UTC-3, sin horario de verano). */
export function atBuenosAires(day: string, time: string): string {
  return new Date(`${day}T${time}:00-03:00`).toISOString()
}

/** El día `AAAA-MM-DD` que está `days` días después de otro. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Qué día de la semana es un día `AAAA-MM-DD`, con el lunes como 0. */
export function weekdayIndex(day: string): number {
  return (new Date(Date.parse(day)).getUTCDay() + 6) % 7
}
