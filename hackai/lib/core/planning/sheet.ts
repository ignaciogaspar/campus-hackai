/* Leer la planilla de clases que carga secretaría: el texto pegado desde Excel
   o Google Sheets, o las filas de un .xlsx o un .csv. Dice, fila por fila, qué
   clase entendió o por qué no la entendió. Todo puro: no guarda nada.

   Cada fila es una clase de una materia en un aula. Con «Día» se repite cada
   semana; con «Fecha» es de ese día solo: un cambio de aula o de horario, una
   clase suspendida o una clase extra. Las columnas se reconocen por el
   encabezado, en cualquier orden; sin encabezado van en el orden de `COLUMNS`. */

import type {
  PlanningCell,
  PlanningEntryInput,
  PlanningPreview,
  PlanningPreviewRow,
  Weekday
} from '@/lib/core/planning'
import { plainText as plain } from '@/lib/plain-text'

export type PlanningColumn =
  | 'materia'
  | 'comision'
  | 'facultad'
  | 'edificio'
  | 'aula'
  | 'dia'
  | 'fecha'
  | 'inicio'
  | 'fin'
  | 'estado'

/** El orden de las columnas de la planilla de ejemplo, y el que se usa si no hay encabezado. */
export const COLUMNS: { column: PlanningColumn; header: string }[] = [
  { column: 'materia', header: 'Materia' },
  { column: 'comision', header: 'Comisión' },
  { column: 'facultad', header: 'Facultad' },
  { column: 'edificio', header: 'Edificio' },
  { column: 'aula', header: 'Aula' },
  { column: 'dia', header: 'Día' },
  { column: 'fecha', header: 'Fecha' },
  { column: 'inicio', header: 'Inicio' },
  { column: 'fin', header: 'Fin' },
  { column: 'estado', header: 'Estado' }
]

const ALIASES: Record<PlanningColumn, string[]> = {
  materia: ['materia', 'asignatura'],
  comision: ['comision', 'com'],
  facultad: ['facultad', 'unidad academica', 'fac'],
  edificio: ['edificio', 'sede', 'sede y edificio'],
  aula: ['aula', 'sala', 'espacio'],
  dia: ['dia', 'dia de la semana'],
  fecha: ['fecha'],
  inicio: ['inicio', 'desde', 'hora de inicio', 'hora inicio', 'hora desde'],
  fin: ['fin', 'hasta', 'hora de fin', 'hora fin', 'hora hasta'],
  estado: ['estado', 'observaciones']
}

/** Lo más que se lee de una vez: un cuatrimestre entero de una facultad entra de sobra. */
export const MAX_ROWS = 3000
const MAX_TEXT = 120

const WEEKDAYS: Record<string, Weekday> = {
  lunes: 'lunes',
  lu: 'lunes',
  lun: 'lunes',
  martes: 'martes',
  ma: 'martes',
  mar: 'martes',
  miercoles: 'miercoles',
  mi: 'miercoles',
  mie: 'miercoles',
  jueves: 'jueves',
  ju: 'jueves',
  jue: 'jueves',
  viernes: 'viernes',
  vi: 'viernes',
  vie: 'viernes',
  sabado: 'sabado',
  sa: 'sabado',
  sab: 'sabado'
}

const textOf = (cell: PlanningCell | undefined) => (cell === null || cell === undefined ? '' : String(cell).trim())

/** Qué columna es cada celda del encabezado, o `null` si la primera fila no parece un encabezado. */
function headerOf(row: PlanningCell[]): (PlanningColumn | null)[] | null {
  const columns = row.map((cell) => {
    const name = plain(textOf(cell))
    return (Object.keys(ALIASES) as PlanningColumn[]).find((c) => ALIASES[c].includes(name)) ?? null
  })
  return columns.filter(Boolean).length >= 3 ? columns : null
}

/** «9», «9:30», «09.30», «9hs», o la fracción de día con que Excel guarda una hora (0,375 son las 9). */
export function minutesFrom(cell: PlanningCell | undefined): number | null {
  if (typeof cell === 'number') {
    if (cell >= 0 && cell < 1) return Math.round(cell * 24 * 60)
    if (Number.isInteger(cell) && cell >= 0 && cell <= 24) return cell * 60
    return null
  }
  const match = plain(textOf(cell)).match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|hs|horas)?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  return hours <= 24 && minutes < 60 ? hours * 60 + minutes : null
}

/** Un día del calendario de Excel (días desde el 30/12/1899) como `AAAA-MM-DD`. */
const fromSerial = (serial: number) => new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)

/** «13/11/2026», «13/11/26», «2026-11-13» o un día de Excel, como `AAAA-MM-DD`. */
export function dayFrom(cell: PlanningCell | undefined): string | null {
  if (typeof cell === 'number')
    return cell > 30_000 && cell < 80_000 ? fromSerial(cell).toISOString().slice(0, 10) : null
  const value = textOf(cell)
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const local = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local
      ? [Number(local[3]) + (local[3].length === 2 ? 2000 : 0), Number(local[2]), Number(local[1])]
      : null
  if (!parts) return null
  const [y, m, d] = parts
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null
}

const clip = (text: string) => text.slice(0, MAX_TEXT)

type Cells = Partial<Record<PlanningColumn, PlanningCell>>

/** Cuándo es la clase: el día de la semana o la fecha (si están los dos, manda la fecha), o el error. */
function whenOf(cells: Cells): { weekday: Weekday | null; date: string | null } | string {
  const rawDate = textOf(cells.fecha)
  const rawDay = plain(textOf(cells.dia)).replace(/\.$/, '')
  if (rawDate) {
    const date = dayFrom(cells.fecha)
    return date ? { weekday: null, date } : `No entendimos la fecha «${rawDate}». Usá día/mes/año, como 13/11/2026.`
  }
  if (rawDay) {
    const weekday = WEEKDAYS[rawDay]
    return weekday ? { weekday, date: null } : `No entendimos el día «${textOf(cells.dia)}». Va de lunes a sábado.`
  }
  return 'Poné el día de la semana (lunes a sábado) o la fecha de la clase.'
}

/** La clase de una fila, o por qué no se entendió. */
function entryOf(cells: Cells): PlanningEntryInput | string {
  const subject = textOf(cells.materia)
  const room = textOf(cells.aula)
  if (!subject) return 'Falta la materia.'
  if (!room) return 'Falta el aula.'
  const when = whenOf(cells)
  if (typeof when === 'string') return when
  const start = minutesFrom(cells.inicio)
  const end = minutesFrom(cells.fin)
  if (start === null) return `No entendimos la hora de inicio «${textOf(cells.inicio)}». Usá horas:minutos, como 9:00.`
  if (end === null) return `No entendimos la hora de fin «${textOf(cells.fin)}». Usá horas:minutos, como 13:00.`
  if (end <= start) return 'La clase termina antes de empezar: revisá el inicio y el fin.'
  const cancelled = /suspend|cancel/.test(plain(textOf(cells.estado)))
  if (cancelled && when.date === null) return 'Para suspender una clase, poné la fecha del día que no se dicta.'
  return {
    subject: clip(subject),
    section: clip(textOf(cells.comision).replace(/^com(isi[oó]n)?\.?\s*/i, '')) || null,
    school: clip(textOf(cells.facultad).toUpperCase()),
    building: clip(textOf(cells.edificio)),
    room: clip(room),
    ...when,
    start,
    end,
    cancelled
  }
}

/** Lo que se entendió de cada fila con algo escrito. Las vacías no cuentan. */
export function previewRows(rows: PlanningCell[][]): PlanningPreview {
  const header = rows.length > 0 ? headerOf(rows[0]) : null
  const columns = header ?? COLUMNS.map((c) => c.column)
  const first = header ? 1 : 0
  const result: PlanningPreviewRow[] = []
  for (let i = first; i < rows.length && result.length < MAX_ROWS; i++) {
    if (rows[i].every((cell) => textOf(cell) === '')) continue
    const cells: Cells = {}
    columns.forEach((column, index) => {
      if (column && cells[column] === undefined) cells[column] = rows[i][index] ?? null
    })
    const entry = entryOf(cells)
    result.push(typeof entry === 'string' ? { line: i + 1, error: entry } : { line: i + 1, entry })
  }
  const ok = result.filter((r) => 'entry' in r).length
  return { rows: result, counts: { ok, errors: result.length - ok }, header: header !== null }
}
