/* Quién entregó y quién no: los alumnos de una comisión (de Cursada) con su
   entrega a una tarea. Lo pedido por el docente se cruza siempre con lo que dice
   Cursada de sus comisiones: nunca se confía en una comisión ni en una persona
   que llegan del navegador. */
import type {
  AccessError,
  StoredGrade,
  StoredSubmission,
  StoredTask,
  SubmissionCounts,
  SubmissionRow,
  SubmissionStudent,
  TaskGrade
} from '@/lib/core/coursework'
import { submissionFor, taskGradeOf } from '@/lib/core/coursework/tasks'
import type { PersonId } from '@/lib/core/people'
import type { MySection, Studies } from '@/lib/core/studies'
import { fail, ok, type Result } from '@/lib/result'

/** Los alumnos de una comisión que dicta la persona, y desde cuándo vienen desactualizados, si es el caso.
    `sin-acceso` si no la dicta. */
export async function studentsOf(
  studies: Studies,
  personId: PersonId,
  sectionId: string
): Promise<Result<{ students: SubmissionStudent[]; staleSince: string | null }, AccessError>> {
  const read = await studies.sectionStudents(personId, sectionId)
  if (!read.ok) {
    if (read.error === 'persona-desconocida' || read.error === 'sin-acceso') return fail(read.error)
    return fail('falla-externa')
  }
  return ok({ students: read.value.data, staleSince: read.value.stale ? read.value.readAt : null })
}

/** El alumno, con su entrega a la tarea si la hizo (a tiempo, atrasada con cuánto, o sin entregar) y la nota que le
    cargó el docente. */
export function rowOf(
  student: SubmissionStudent,
  stored: StoredSubmission | undefined,
  task: StoredTask,
  grade: TaskGrade | null = null
): SubmissionRow {
  if (!stored) return { student, state: 'sin-entrega', submission: null, grade }
  const submission = submissionFor(stored, task, grade)
  return { student, state: submission.late ? 'atrasada' : 'entregada', submission, grade }
}

/** Todos los alumnos de la comisión, en el orden de Cursada, con las notas de la comisión en la tarea. Una entrega
    de alguien que ya no está en la comisión no cuenta. */
export function rowsOf(
  students: SubmissionStudent[],
  stored: StoredSubmission[],
  task: StoredTask,
  grades: StoredGrade[] = []
): SubmissionRow[] {
  const byPerson = new Map(stored.map((s) => [s.personId, s]))
  return students.map((student) => {
    const { personId } = student
    if (!personId) return rowOf(student, undefined, task)
    return rowOf(student, byPerson.get(personId), task, taskGradeOf(grades, task.id, personId, false))
  })
}

export function countsOf(rows: SubmissionRow[]): SubmissionCounts {
  const count = (state: SubmissionRow['state']) => rows.filter((r) => r.state === state).length
  return { onTime: count('entregada'), late: count('atrasada'), missing: count('sin-entrega') }
}

/** El alumno entre las comisiones que dicta la persona, y en cuál está. `null` si no es alumno de ninguna: para
    el docente, esa entrega no existe. */
export async function studentInTaught(
  studies: Studies,
  personId: PersonId,
  taught: MySection[],
  studentId: PersonId
): Promise<Result<{ student: SubmissionStudent; sectionId: string; staleSince: string | null } | null, AccessError>> {
  for (const section of taught.filter((s) => s.role === 'profesor')) {
    const read = await studentsOf(studies, personId, section.sectionId)
    if (!read.ok) {
      if (read.error === 'sin-acceso') continue
      return read
    }
    const student = read.value.students.find((s) => s.personId === studentId)
    if (student) return ok({ student, sectionId: section.sectionId, staleSince: read.value.staleSince })
  }
  return ok(null)
}
