/* Los chequeos del Planning antes de guardar, fila por fila y contra lo que ya
   está cargado (si se suma) o contra las filas anteriores de la planilla:

   - Repetida: igual a otra fila o a una clase ya cargada. Se carga una sola vez.
   - Misma clase dos veces: la misma materia, comisión y facultad con dos clases
     que se pisan el mismo día, o dos cambios para el mismo día. Error.
   - Aula ocupada: dos clases distintas en la misma aula, el mismo día y en
     horarios que se pisan. Error. Una clase semanal que ese día tiene un cambio
     (otra aula, otro horario o suspendida) deja su aula libre ese día.
   - Suspender lo que no existe: una suspensión sin clase semanal de esa materia
     ese día. Error.
   - Clase extra: una fila con fecha sin clase semanal que pisar se carga, con
     un aviso, porque suele ser la materia escrita distinto que en la semanal.

   Cada error dice qué choca con qué (la línea o «ya cargada») y cómo
   arreglarlo, para que secretaría sepa qué está pasando. */
import type { PlanningEntryInput, PlanningPreviewRow, Weekday } from '@/lib/core/planning'
import { keyOf, WEEKDAY_INDEX } from '@/lib/core/planning/schedule'
import type { ParsedRow } from '@/lib/core/planning/sheet'
import { weekdayIndex } from '@/lib/dates'
import { plainText } from '@/lib/plain-text'

/** Una clase ya aceptada y cómo nombrarla en un mensaje: «línea 4» o «ya cargada». */
type Placed = { entry: PlanningEntryInput; ref: string }

const EXISTING = 'ya cargada'

const PLURAL: Record<Weekday, string> = {
  lunes: 'los lunes',
  martes: 'los martes',
  miercoles: 'los miércoles',
  jueves: 'los jueves',
  viernes: 'los viernes',
  sabado: 'los sábados'
}
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const WEEKDAYS = Object.keys(WEEKDAY_INDEX) as Weekday[]

const hhmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const dateText = (date: string) => `el ${DAY_NAMES[weekdayIndex(date)]} ${date.split('-').reverse().join('/')}`
const whenText = (e: PlanningEntryInput) => (e.weekday ? PLURAL[e.weekday] : dateText(e.date ?? ''))
const timeText = (e: PlanningEntryInput) => `de ${hhmm(e.start)} a ${hhmm(e.end)}`
const classText = (e: PlanningEntryInput) => (e.section ? `${e.subject} (Comisión ${e.section})` : e.subject)
/** «Aula A9 (Pilar - Edificio Olivo - Módulo A)». */
const roomText = (e: PlanningEntryInput) => {
  const place = [e.campus, e.building, e.wing].filter(Boolean).join(' - ')
  return place ? `${e.room} (${place})` : e.room
}

const same = (a: string, b: string) => plainText(a) === plainText(b)
/** Lo mismo, o una de las dos no lo dice: una planilla sin sede o sin módulo no esquiva un choque. */
const samePart = (a: string, b: string) => !a || !b || same(a, b)
/** La misma aula: mismo nombre en la misma sede, edificio y módulo. */
const sameRoom = (a: PlanningEntryInput, b: PlanningEntryInput) =>
  same(a.room, b.room) && samePart(a.campus, b.campus) && samePart(a.building, b.building) && samePart(a.wing, b.wing)
const overlaps = (a: PlanningEntryInput, b: PlanningEntryInput) => a.start < b.end && b.start < a.end
const weekdayOf = (e: PlanningEntryInput) => (e.weekday ? WEEKDAY_INDEX[e.weekday] : weekdayIndex(e.date ?? ''))
const sameDay = (a: PlanningEntryInput, b: PlanningEntryInput) =>
  a.date && b.date ? a.date === b.date : weekdayOf(a) === weekdayOf(b)

const identical = (a: PlanningEntryInput, b: PlanningEntryInput) =>
  keyOf(a) === keyOf(b) &&
  a.weekday === b.weekday &&
  a.date === b.date &&
  a.start === b.start &&
  a.end === b.end &&
  same(a.room, b.room) &&
  same(a.campus, b.campus) &&
  same(a.building, b.building) &&
  same(a.wing, b.wing) &&
  a.cancelled === b.cancelled

/** Dos filas de la misma clase que no pueden convivir: dos semanales del mismo día que se pisan, o dos filas con
    la misma fecha (dos cambios, o un cambio y una suspensión). Una semanal y una con fecha sí: la de fecha la pisa. */
function sameClassClash(e: PlanningEntryInput, a: PlanningEntryInput): boolean {
  if (keyOf(e) !== keyOf(a)) return false
  if (e.weekday && a.weekday) return e.weekday === a.weekday && overlaps(e, a)
  return e.date !== null && e.date === a.date
}

type Context = {
  /** Si la clase semanal `a` no se dicta el día `date` porque una fila con fecha de la misma clase la pisa. */
  replaced: (a: PlanningEntryInput, date: string) => boolean
  /** Si hay una clase semanal de esa misma clase el día de la semana de su fecha. */
  hasWeekly: (e: PlanningEntryInput) => boolean
}

/** Si dos clases distintas están en el aula al mismo tiempo algún día. */
function occupiedTogether(e: PlanningEntryInput, a: PlanningEntryInput, ctx: Context): boolean {
  if (e.cancelled || a.cancelled || !overlaps(e, a) || !sameDay(e, a)) return false
  if (e.date && a.weekday) return !ctx.replaced(a, e.date)
  if (a.date && e.weekday) return !ctx.replaced(e, a.date)
  return true
}

function sameClassMessage(e: PlanningEntryInput, a: Placed): string {
  if (e.weekday) {
    return `${classText(e)} ya tiene clase ${whenText(a.entry)} ${timeText(a.entry)} en ${roomText(a.entry)} (${a.ref}). Una comisión no puede tener dos clases que se pisan: si es la misma clase, dejá una sola fila; si cambió el horario, corregí una de las dos.`
  }
  const day = dateText(e.date ?? '')
  if (e.cancelled || a.entry.cancelled) {
    return `La clase de ${classText(e)} ${day} está cargada como suspendida y también con aula u horario (${a.ref}). Dejá una sola fila para ese día.`
  }
  return `La clase de ${classText(e)} ${day} ya tiene un cambio cargado: ${roomText(a.entry)} ${timeText(a.entry)} (${a.ref}). Dejá una sola fila para ese día.`
}

function roomMessage(e: PlanningEntryInput, a: Placed): string {
  const when = e.date ? dateText(e.date) : a.entry.date ? dateText(a.entry.date) : whenText(e)
  return `${roomText(e)} ya está ocupada ${when} ${timeText(a.entry)} por ${classText(a.entry)} (${a.ref}). Dos clases no pueden estar en la misma aula a la misma hora: cambiá el aula o el horario de una de las dos.`
}

const weekdayName = (date: string) => PLURAL[WEEKDAYS[weekdayIndex(date)]] ?? 'los domingos'

type Checked =
  | { status: 'ok'; entry: PlanningEntryInput; note: string | null }
  | { status: 'repetida'; entry: PlanningEntryInput; note: string }
  | { status: 'error'; error: string }

/** El resultado de una clase contra las ya aceptadas. */
function checkOne(e: PlanningEntryInput, accepted: Placed[], ctx: Context): Checked {
  const twin = accepted.find((a) => identical(e, a.entry))
  if (twin) {
    const note =
      twin.ref === EXISTING
        ? 'Ya estaba cargada: no se vuelve a cargar.'
        : `Repetida: es igual a la ${twin.ref}. Se carga una sola vez.`
    return { status: 'repetida', entry: e, note }
  }
  if (e.cancelled && !ctx.hasWeekly(e)) {
    return {
      status: 'error',
      error: `No hay clase de ${classText(e)} ${weekdayName(e.date ?? '')} para suspender ${dateText(e.date ?? '')}. Revisá que la materia, la comisión y la facultad estén escritas igual que en la clase semanal.`
    }
  }
  const sibling = accepted.find((a) => sameClassClash(e, a.entry))
  if (sibling) return { status: 'error', error: sameClassMessage(e, sibling) }
  const occupant = accepted.find(
    (a) => keyOf(a.entry) !== keyOf(e) && sameRoom(e, a.entry) && occupiedTogether(e, a.entry, ctx)
  )
  if (occupant) return { status: 'error', error: roomMessage(e, occupant) }
  const extra = e.date !== null && !e.cancelled && !ctx.hasWeekly(e)
  const note = extra
    ? `No hay clase semanal de ${classText(e)} ${weekdayName(e.date ?? '')}: se carga como clase extra de ese día. Si era un cambio de aula u horario, escribí la materia, la comisión y la facultad igual que en la clase semanal.`
    : null
  return { status: 'ok', entry: e, note }
}

/** Los chequeos de todas las filas, en orden. `existing` es lo ya cargado que tiene que seguir valiendo: lo cargado
    si se suma, nada si se reemplaza. */
export function checkRows(parsed: ParsedRow[], existing: PlanningEntryInput[]): PlanningPreviewRow[] {
  const all = [...existing, ...parsed.flatMap((r) => ('entry' in r ? [r.entry] : []))]
  const ctx: Context = {
    replaced: (a, date) => all.some((x) => x !== a && x.date === date && keyOf(x) === keyOf(a)),
    hasWeekly: (e) =>
      all.some((x) => x.weekday !== null && keyOf(x) === keyOf(e) && WEEKDAY_INDEX[x.weekday] === weekdayOf(e))
  }
  const accepted: Placed[] = existing.map((entry) => ({ entry, ref: EXISTING }))
  return parsed.map((row): PlanningPreviewRow => {
    if ('error' in row) return { line: row.line, status: 'error', error: row.error }
    const checked = checkOne(row.entry, accepted, ctx)
    if (checked.status === 'ok') accepted.push({ entry: row.entry, ref: `línea ${row.line}` })
    return { line: row.line, ...checked }
  })
}
