/* Cómo se escriben en las pantallas de Seguimiento los enlaces entre pantallas,
   las fechas límite y los textos de cada tarea. Sin reglas de negocio: solo
   formato. Las fechas van en la hora de Buenos Aires. */
import { TIME_ZONE } from '@/lib/dates'

const SUBJECTS_PATH = '/materias'

/** Un enlace de Seguimiento, con la comisión elegida en `?comision=` si hay. */
function href(path: string, comision?: string): string {
  return comision ? `${path}?${new URLSearchParams({ comision })}` : path
}

const subjectPath = (subjectId: string) => `${SUBJECTS_PATH}/${encodeURIComponent(subjectId)}`

/** La lista de tareas de la materia. */
export const tasksHref = (subjectId: string, comision?: string) => href(`${subjectPath(subjectId)}/tareas`, comision)

/** El formulario de tarea nueva. */
export const newTaskHref = (subjectId: string, comision?: string) =>
  href(`${subjectPath(subjectId)}/tareas/nueva`, comision)

/** Una tarea. */
export const taskHref = (subjectId: string, taskId: string, comision?: string) =>
  href(`${subjectPath(subjectId)}/tareas/${encodeURIComponent(taskId)}`, comision)

/** El valor de `?columna=` para la nota de cursada: no es una columna, es lo que se calcula de las columnas. */
export const COURSE_COLUMN = 'cursada'

/** Qué se mira en Calificaciones: la comisión, la columna y, si se está calificando, el alumno. `listo` marca que se
    terminó de calificar la lista. */
export type GradesView = {
  comision?: string
  columna?: string
  alumno?: string
  listo?: boolean
  /** Cuántas notas se acaban de guardar pegándolas desde una planilla. */
  pegadas?: number
}

/** Calificaciones de la materia, con lo que se mira en `?comision=`, `?columna=` y `?alumno=`. */
export function gradesHref(subjectId: string, view: GradesView = {}): string {
  const params = new URLSearchParams()
  if (view.comision) params.set('comision', view.comision)
  if (view.columna) params.set('columna', view.columna)
  if (view.alumno) params.set('alumno', view.alumno)
  if (view.listo) params.set('listo', 'si')
  if (view.pegadas) params.set('pegadas', String(view.pegadas))
  const query = params.toString()
  return `${subjectPath(subjectId)}/calificaciones${query ? `?${query}` : ''}`
}

/** Pegar notas desde una planilla en una columna de Calificaciones. */
export function pasteGradesHref(subjectId: string, view: { comision?: string; columna?: string } = {}): string {
  const params = new URLSearchParams()
  if (view.comision) params.set('comision', view.comision)
  if (view.columna) params.set('columna', view.columna)
  const query = params.toString()
  return `${subjectPath(subjectId)}/calificaciones/pegar${query ? `?${query}` : ''}`
}

/** La cantidad de notas: «1 nota», «12 notas». */
export const notesLabel = (count: number) => (count === 1 ? '1 nota' : `${count} notas`)

/** La nota que escribió la persona: acepta coma o punto decimal. `null` si no escribió nada; `NaN` si lo escrito no
    es un número. */
export function gradeFromInput(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (text === '') return null
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN
}

/** La nota como se escribe en un campo y se lee en pantalla: con coma decimal, sin ceros de más («8,5»). */
export const gradeInputValue = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

/** A quién se califica después: el que sigue de `current` en la lista, o `null` si es el último (o no está). Solo
    cuentan los que se pueden calificar. */
export function nextStudent(ids: string[], current: string): string | null {
  const index = ids.indexOf(current)
  return index >= 0 ? (ids[index + 1] ?? null) : null
}

/** La entrega de un alumno, abierta por el docente. */
export const submissionHref = (subjectId: string, taskId: string, submissionId: string, comision?: string) =>
  href(
    `${subjectPath(subjectId)}/tareas/${encodeURIComponent(taskId)}/entregas/${encodeURIComponent(submissionId)}`,
    comision
  )

/** «Comisión A». */
export const sectionLabel = (name: string) => `Comisión ${name}`

/** «Comisión A y B», «Comisiones A, B y C». */
export function sectionsLabel(names: string[]): string {
  if (names.length <= 1) return sectionLabel(names[0] ?? '')
  const last = names[names.length - 1]
  return `Comisiones ${names.slice(0, -1).join(', ')} y ${last}`
}

/** «vie, 13 nov, 23:59»: en 24 horas, como se escribe la hora acá. */
export function dueTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
}

/** «Vence vie, 13 nov, 23:59» o «Venció vie, 13 nov, 23:59». */
export function dueLabel(task: { dueAt: string; past: boolean }): string {
  return `${task.past ? 'Venció' : 'Vence'} ${dueTime(task.dueAt)}`
}

/** El valor de un `<input type='datetime-local'>` para una fecha, en la hora de Buenos Aires: `2026-11-13T23:59`. */
export function inputValueOf(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

/** La fecha ISO de lo que escribió la persona en un `<input type='datetime-local'>`, que no lleva zona: se toma
    siempre en Buenos Aires (Argentina no tiene horario de verano). `null` si no es una fecha con hora. */
export function dueAtFromInput(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null
  const date = new Date(`${match[1]}T${match[2]}:00-03:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Cuánto es un atraso: «45 min», «2 h 30 min», «1 día», «3 días 4 h». */
export function durationLabel(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) {
    return [days === 1 ? '1 día' : `${days} días`, hours > 0 ? `${hours} h` : ''].filter(Boolean).join(' ')
  }
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`
  return `${mins} min`
}

/** El estado de una entrega en una palabra y cuánto se atrasó: «Entregada», «Atrasada · 2 h 30 min». */
export function submissionStatus(submission: { late: { minutes: number } | null }): string {
  return submission.late ? `Atrasada · ${durationLabel(submission.late.minutes)}` : 'Entregada'
}

/** El estado de un alumno frente a una tarea, en palabras: «Entregada», «Atrasada · 2 h 30 min», «No entregó». */
export function rowStatus(row: { submission: { late: { minutes: number } | null } | null }): string {
  return row.submission ? submissionStatus(row.submission) : 'No entregó'
}

/** El resumen de quién entregó: «2 entregaron · 1 atrasada · 3 sin entregar». Sin atrasadas, no las nombra. */
export function countsLabel(counts: { onTime: number; late: number; missing: number }): string {
  const delivered = counts.onTime + counts.late
  const parts = [delivered === 1 ? '1 entregó' : `${delivered} entregaron`]
  if (counts.late > 0) parts.push(counts.late === 1 ? '1 atrasada' : `${counts.late} atrasadas`)
  parts.push(counts.missing === 1 ? '1 sin entregar' : `${counts.missing} sin entregar`)
  return parts.join(' · ')
}
