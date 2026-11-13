/* Lo que Planning le arma al asistente y lo que hace con su respuesta, sin el
   modelo: el listado de clases cargadas con un número corto (el modelo nunca ve
   ni inventa un id), y las filas y las bajas que devuelve, pasadas a la planilla
   de siempre. Todo puro. */
import type { PlanningCell, PlanningEntry } from '@/lib/core/planning'
import { COLUMNS } from '@/lib/core/planning/sheet'
import { plainText } from '@/lib/plain-text'
import type { AssistantAnswer } from '@/lib/ports/planning-assistant'

/** Lo más largo que se le manda al modelo de un mensaje. */
export const MAX_MESSAGE_CHARS = 1000
/** Cuántas clases cargadas van como contexto; con más, solo las de las materias que nombra el mensaje. */
export const MAX_CATALOG = 500
/** Cuántos pedidos al asistente puede hacer cada persona por día. */
export const DAILY_LIMIT = 50

const hhmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

const lineOf = (e: PlanningEntry, n: number) =>
  [
    n,
    e.subject,
    e.section ?? '',
    e.school,
    e.campus,
    e.building,
    e.wing,
    e.room,
    e.weekday ?? e.date ?? '',
    `${hhmm(e.start)}-${hhmm(e.end)}`,
    e.cancelled ? 'suspendida' : ''
  ].join('|')

/** Las clases que van como contexto y su listado, numerado desde 1 en ese orden. Si son más de `MAX_CATALOG`, primero
    las de las materias que nombra el mensaje. */
export function catalogOf(entries: PlanningEntry[], message: string): { shown: PlanningEntry[]; text: string } {
  let shown = entries
  if (entries.length > MAX_CATALOG) {
    const words = plainText(message)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3)
    const named = entries.filter((e) => words.some((w) => plainText(e.subject).includes(w)))
    shown = [...named, ...entries.filter((e) => !named.includes(e))]
  }
  shown = shown.slice(0, MAX_CATALOG)
  return { shown, text: shown.map((e, i) => lineOf(e, i + 1)).join('\n') }
}

/** Las altas como filas de la planilla, con el encabezado, para leerlas y chequearlas igual que una planilla. */
export function rowsOf(answer: AssistantAnswer): PlanningCell[][] {
  const header = COLUMNS.map((c) => c.header)
  return [header, ...answer.altas.map((row) => COLUMNS.map(({ column }) => row[column]))]
}

/** Las clases de las bajas, o `null` si algún número no está en el listado: el modelo no puede borrar lo que no vio. */
export function removalsOf(answer: AssistantAnswer, shown: PlanningEntry[]): PlanningEntry[] | null {
  const unique = [...new Set(answer.bajas)]
  if (unique.some((n) => n < 1 || n > shown.length)) return null
  return unique.map((n) => shown[n - 1])
}
