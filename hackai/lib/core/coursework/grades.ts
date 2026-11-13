/* Las reglas de una nota y cómo se arman las columnas de Calificaciones y lo
   que ve el alumno. Todo puro. */
import type {
  ColumnKind,
  GradeCell,
  GradeColumn,
  GradeError,
  NewGrade,
  PassCounts,
  PassStatus,
  PublishedGrade,
  StoredGrade,
  StoredTask
} from '@/lib/core/coursework'
import type { SectionAssessment } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

export const MIN_GRADE = 1
export const MAX_GRADE = 10
export const MAX_COMMENT = 2000

/** Cuántos días es nueva una nota publicada para la campana: lo mismo que una nota que llega del SIU. */
const NEW_GRADE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** El id de una columna: `tarea:<id>` o `evaluacion:<id>`. */
export const columnId = (kind: ColumnKind, refId: string) => `${kind}:${refId}`

/** La columna de un id que llega del navegador, o `null` si no tiene esa forma. */
export function parseColumnId(id: string): { kind: ColumnKind; refId: string } | null {
  const [kind, ...rest] = id.split(':')
  const refId = rest.join(':')
  return (kind === 'tarea' || kind === 'evaluacion') && refId !== '' ? { kind, refId } : null
}

/** Lo que se guarda de una nota, ya limpio, o por qué no sirve: de 1 a 10 con dos decimales, o ausente (sin número). */
export function checkedGrade(input: NewGrade): Result<Pick<StoredGrade, 'value' | 'absent' | 'comment'>, GradeError> {
  const comment = input.comment.trim()
  if (comment.length > MAX_COMMENT) return fail('comentario-invalido')
  if (input.absent) return ok({ value: null, absent: true, comment })
  const { value } = input
  if (value === null || !Number.isFinite(value) || value < MIN_GRADE || value > MAX_GRADE) return fail('nota-invalida')
  return ok({ value: Math.round(value * 100) / 100, absent: false, comment })
}

/** Si la nota se puede publicar: tiene número o es un ausente. */
export const isGraded = (g: Pick<StoredGrade, 'value' | 'absent'>) => g.value !== null || g.absent

export const cellOf = (g: StoredGrade): GradeCell => ({
  value: g.value,
  absent: g.absent,
  comment: g.comment,
  gradedAt: g.gradedAt,
  published: g.publishedAt !== null,
  pass: g.pass?.status ?? null
})

/** Una columna de la comisión sin sus conteos: lo que dicen la tarea o el cronograma del SIU. */
export type ColumnDef = Pick<GradeColumn, 'kind' | 'name' | 'date' | 'assessmentKind'> & { refId: string }

export const taskColumn = (task: StoredTask): ColumnDef => ({
  kind: 'tarea',
  refId: task.id,
  name: task.name,
  date: task.dueAt,
  assessmentKind: null
})

export const assessmentColumn = (a: SectionAssessment): ColumnDef => ({
  kind: 'evaluacion',
  refId: a.id,
  name: a.name,
  date: a.date,
  assessmentKind: a.kind
})

/** Las columnas de la comisión por fecha: una por tarea con nota y una por evaluación del SIU. */
export function columnDefs(tasks: StoredTask[], sectionId: string, assessments: SectionAssessment[]): ColumnDef[] {
  return [
    ...tasks.filter((t) => t.graded && t.sectionIds.includes(sectionId)).map(taskColumn),
    ...assessments.map(assessmentColumn)
  ].sort((a, b) => a.date.localeCompare(b.date) || a.refId.localeCompare(b.refId))
}

/** Si dos notas son de la misma columna. */
export const inColumn = (g: StoredGrade, column: { kind: ColumnKind; refId: string }) =>
  g.kind === column.kind && g.refId === column.refId

/** La columna con lo cargado y publicado hasta ahora. */
export function columnWith(def: ColumnDef, grades: StoredGrade[]): GradeColumn {
  const ofColumn = grades.filter((g) => inColumn(g, def) && isGraded(g))
  const published = ofColumn.flatMap((g) => (g.publishedAt ? [g.publishedAt] : [])).sort()[0] ?? null
  return {
    id: columnId(def.kind, def.refId),
    kind: def.kind,
    name: def.name,
    date: def.date,
    assessmentKind: def.assessmentKind,
    publishedAt: published,
    graded: ofColumn.length,
    unpublished: ofColumn.filter((g) => g.publishedAt === null).length,
    pass: def.kind === 'evaluacion' ? passCounts(ofColumn) : null
  }
}

/** Cuántas notas pasaron al SIU, esperan pasar o el SIU no permite pasar. */
function passCounts(grades: StoredGrade[]): PassCounts {
  const count = (status: PassStatus) => grades.filter((g) => g.pass?.status === status).length
  return { passed: count('pasado'), pending: count('pendiente'), refused: count('no-permitido') }
}

/** Las notas publicadas con número en la última semana y después de `seenAt`, no después de ahora, la más nueva
    primero. Un ausente no es una nota que llega. */
export function newOnes(grades: PublishedGrade[], now: string, seenAt: string | null): PublishedGrade[] {
  const weekAgo = new Date(new Date(now).getTime() - NEW_GRADE_DAYS * DAY_MS).toISOString()
  const since = seenAt && seenAt > weekAgo ? seenAt : weekAgo
  return grades.filter((g) => g.value !== null && g.publishedAt > since && g.publishedAt <= now)
}

/** La más reciente publicada primero y, a igual hora, por nombre. */
export const byPublication = (a: PublishedGrade, b: PublishedGrade) =>
  b.publishedAt.localeCompare(a.publishedAt) || a.name.localeCompare(b.name, 'es')
