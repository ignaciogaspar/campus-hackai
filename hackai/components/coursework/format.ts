/* Cómo se escriben en las pantallas de Seguimiento los enlaces entre pantallas,
   las fechas límite y los textos de cada tarea. Sin reglas de negocio: solo
   formato. Las fechas van en la hora de Buenos Aires. */
import { dueTime } from '@/components/dates'
import type { StatusTone } from '@/components/ui/status-pill'
import type { Role } from '@/lib/core/people'
import { daysBetween, TIME_ZONE } from '@/lib/dates'

const SUBJECTS_PATH = '/materias'

/** Un enlace de Seguimiento, con la comisión elegida en `?comision=` si hay. */
function href(path: string, comision?: string): string {
  return comision ? `${path}?${new URLSearchParams({ comision })}` : path
}

const subjectPath = (subjectId: string) => `${SUBJECTS_PATH}/${encodeURIComponent(subjectId)}`

/** La lista de tareas de la materia. */
export const tasksHref = (subjectId: string, comision?: string) => href(`${subjectPath(subjectId)}/tareas`, comision)

/** La lista de tareas recién creada una: marca cuál es la nueva en `?creada=`, para avisar que se publicó. */
export function createdTaskHref(subjectId: string, comision: string | undefined, taskId: string): string {
  const params = new URLSearchParams()
  if (comision) params.set('comision', comision)
  params.set('creada', taskId)
  return `${subjectPath(subjectId)}/tareas?${params}`
}

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
  /** La página de la lista de alumnos, desde 1. */
  pagina?: number
}

/** Calificaciones de la materia, con lo que se mira en `?comision=`, `?columna=` y `?alumno=`. */
export function gradesHref(subjectId: string, view: GradesView = {}): string {
  const params = new URLSearchParams()
  if (view.comision) params.set('comision', view.comision)
  if (view.columna) params.set('columna', view.columna)
  if (view.alumno) params.set('alumno', view.alumno)
  if (view.listo) params.set('listo', 'si')
  if (view.pegadas) params.set('pegadas', String(view.pegadas))
  if (view.pagina && view.pagina > 1) params.set('pagina', String(view.pagina))
  const query = params.toString()
  return `${subjectPath(subjectId)}/calificaciones${query ? `?${query}` : ''}`
}

/** Notas del alumno con la materia elegida: ahí aparece la nota de una tarea cuando se publica. */
export const subjectNotesHref = (subjectId: string) => `/notas?${new URLSearchParams({ materia: subjectId })}`

/** El estado de una columna en su pestaña de Calificaciones: «Sin notas», «2/3 · sin publicar», «3/3 · publicada».
    Una columna publicada con notas nuevas dice cuántas faltan publicar. */
export function columnStatus(
  column: { graded: number; unpublished: number; published: boolean },
  students: number
): string {
  if (column.graded === 0) return 'Sin notas'
  const count = `${column.graded}/${students}`
  if (!column.published) return `${count} · sin publicar`
  return column.unpublished === 0 ? `${count} · publicada` : `${count} · ${column.unpublished} sin publicar`
}

/** Cómo se evalúa la comisión: instancias de examen, pesos y promoción. Lleva la columna de Calificaciones de la que
    se viene, para volver a ella, y con `pesos` va directo a los pesos. */
export function evaluationHref(subjectId: string, comision?: string, from: { columna?: string; pesos?: boolean } = {}) {
  const params = new URLSearchParams()
  if (comision) params.set('comision', comision)
  if (from.columna) params.set('columna', from.columna)
  const query = params.toString()
  return `${subjectPath(subjectId)}/calificaciones/evaluacion${query ? `?${query}` : ''}${from.pesos ? '#pesos' : ''}`
}

/** Cuántos alumnos entran en una página de las listas del docente. */
export const PAGE_SIZE = 25

/** La página pedida en `?pagina=`, dentro de las que hay, y los elementos de esa página. */
export function pageOf<T>(items: T[], requested: string | undefined): { page: number; pages: number; items: T[] } {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const asked = Number.parseInt(requested ?? '1', 10)
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1
  return { page, pages, items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) }
}

/** La nota que se escribe en la planilla de una columna: un número de 1 a 10, «A» de ausente, o nada. */
export function sheetValue(cell: { value: number | null; absent: boolean } | undefined): string {
  if (!cell) return ''
  return cell.absent ? 'A' : gradeInputValue(cell.value)
}

/** El Excel de la materia: se baja un .xlsx con una hoja por comisión del docente. */
export const gradesExcelHref = (subjectId: string) => `${subjectPath(subjectId)}/calificaciones/excel`

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

/** El texto pegado con los saltos de línea como LF. El navegador manda un textarea con CRLF y el campo lo tiene con
    LF: sin esto, la vista previa nunca coincide con lo escrito y no se puede guardar. */
export const pastedText = (text: string) => text.replace(/\r\n?/g, '\n')

/** La nota que escribió la persona: acepta coma o punto decimal. `null` si no escribió nada; `NaN` si lo escrito no
    es un número. */
export function gradeFromInput(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (text === '') return null
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN
}

/** Lo escrito en la planilla, para comparar: sin espacios y con «a» igual que «A». */
const sheetKey = (text: string) => text.trim().toUpperCase()

/** Si lo escrito en un campo de la planilla se puede guardar: un número de 1 a 10 o «A» de ausente. */
export function isSheetGrade(value: string): boolean {
  if (sheetKey(value) === 'A') return true
  const grade = gradeFromInput(value)
  return grade !== null && grade >= 1 && grade <= 10
}

/** Qué pide una fila de la planilla al guardar: nada si no cambió («8,5» y «8.5» son lo mismo), quitar la nota si se
    vació, o guardar lo escrito, que puede no servir. Un campo que ya estaba vacío nunca pide quitar. */
export function sheetChange(row: { before: string; value: string }): 'igual' | 'quitar' | 'nota' | 'invalida' {
  const before = sheetKey(row.before)
  const value = sheetKey(row.value)
  if (value === before || (value !== '' && gradeFromInput(value) === gradeFromInput(before))) return 'igual'
  if (value === '') return 'quitar'
  return isSheetGrade(value) ? 'nota' : 'invalida'
}

/** La nota como se escribe en un campo y se lee en pantalla: con coma decimal, sin ceros de más («8,5»). */
export const gradeInputValue = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

/** La nota que el docente cargó en una tarea, y si el alumno todavía no la ve: «Nota 8,5», «Ausente · sin publicar». */
export function taskGradeLabel(grade: { value: number | null; absent: boolean; published: boolean }): string {
  const text = grade.absent ? 'Ausente' : `Nota ${gradeInputValue(grade.value)}`
  return grade.published ? text : `${text} · sin publicar`
}

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

/** «Vence vie, 13 nov, 23:59» o «Venció vie, 13 nov, 23:59»; si no es del año de `now`, con el año. */
export function dueLabel(task: { dueAt: string; past: boolean }, now: string = new Date().toISOString()): string {
  return `${task.past ? 'Venció' : 'Vence'} ${dueTime(task.dueAt, now)}`
}

/** Cuánto falta para una fecha límite, en días de Buenos Aires: «vence hoy», «vence mañana», «vence en 3 días»; si
    ya pasó, «venció». */
export function relativeDue(dueAt: string, now: string): string {
  if (new Date(dueAt).getTime() < new Date(now).getTime()) return 'venció'
  const days = daysBetween(now, dueAt)
  if (days <= 0) return 'vence hoy'
  return days === 1 ? 'vence mañana' : `vence en ${days} días`
}

type TaskForStatus = {
  dueAt: string
  past: boolean
  submission: { late: { minutes: number } | null; grade: { value: number | null; absent: boolean } | null } | null
}

/** El estado de una tarea para quien mira. Al docente, si sigue vigente o venció. Al alumno, cómo está su entrega:
    «Sin entregar · vence en 3 días», «Atrasada, podés entregarla igual», «Entregada», «Entregada con atraso» o,
    con la nota publicada, la nota. */
export function taskStatus(task: TaskForStatus, role: Role, now: string): { label: string; tone: StatusTone } {
  if (role === 'profesor') return task.past ? { label: 'Venció', tone: 'neutral' } : { label: 'Vigente', tone: 'info' }
  const { submission } = task
  if (submission?.grade) {
    const { value, absent } = submission.grade
    return { label: absent ? 'Ausente' : `Nota ${gradeInputValue(value)}`, tone: 'success' }
  }
  if (submission) {
    return submission.late
      ? { label: 'Entregada con atraso', tone: 'warning' }
      : { label: 'Entregada', tone: 'success' }
  }
  if (task.past) return { label: 'Atrasada, podés entregarla igual', tone: 'warning' }
  return { label: `Sin entregar · ${relativeDue(task.dueAt, now)}`, tone: 'info' }
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

/** Cómo va una tarea en la comisión, para la lista del docente: «2 entregas · 2 sin corregir», «3 entregas»,
    «Sin entregas». */
export function progressLabel(progress: { delivered: number; ungraded: number; missing: number }): string {
  const { delivered, ungraded } = progress
  if (delivered === 0) return 'Sin entregas'
  const text = delivered === 1 ? '1 entrega' : `${delivered} entregas`
  return ungraded > 0 ? `${text} · ${ungraded} sin corregir` : text
}

/** El resumen de quién entregó: «2 entregaron · 1 atrasada · 3 sin entregar». Sin atrasadas, no las nombra. */
export function countsLabel(counts: { onTime: number; late: number; missing: number }): string {
  const delivered = counts.onTime + counts.late
  const parts = [delivered === 1 ? '1 entregó' : `${delivered} entregaron`]
  if (counts.late > 0) parts.push(counts.late === 1 ? '1 atrasada' : `${counts.late} atrasadas`)
  parts.push(counts.missing === 1 ? '1 sin entregar' : `${counts.missing} sin entregar`)
  return parts.join(' · ')
}
