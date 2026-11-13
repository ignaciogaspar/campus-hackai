/* Las reglas de los textos de una tarea y cómo se arma la que ve cada persona.
   Todo puro. */
import type {
  DatedTask,
  StoredSubmission,
  StoredTask,
  StoredTaskFile,
  Submission,
  Task,
  TaskChanges,
  TaskFile,
  TaskSection,
  TaskTextError
} from '@/lib/core/coursework'
import type { MySection } from '@/lib/core/studies'
import { fileUrl } from '@/lib/ports/files'
import { fail, ok, type Result } from '@/lib/result'

export const MAX_NAME = 120
export const MAX_INSTRUCTIONS = 5000

/** Lo que llega del navegador, ya limpio, o por qué no sirve. La fecha vuelve normalizada a ISO. */
export function checkedTexts(input: TaskChanges): Result<TaskChanges, TaskTextError> {
  const name = input.name.trim()
  if (name === '' || name.length > MAX_NAME) return fail('nombre-invalido')
  const instructions = input.instructions.trim()
  if (instructions.length > MAX_INSTRUCTIONS) return fail('consigna-invalida')
  const due = new Date(input.dueAt)
  if (Number.isNaN(due.getTime())) return fail('fecha-invalida')
  return ok({ name, instructions, dueAt: due.toISOString() })
}

/** Si la fecha límite (ya normalizada) es de antes de `now`: una tarea no nace vencida, ni se la corre al pasado. */
export function checkedDue(dueAt: string, now: Date): Result<string, 'fecha-pasada'> {
  return new Date(dueAt).getTime() < now.getTime() ? fail('fecha-pasada') : ok(dueAt)
}

function fileView(file: StoredTaskFile): TaskFile {
  return { name: file.name, contentType: file.contentType, size: file.size, url: fileUrl(file.id, file.name) }
}

const fileOf = ({ file }: StoredTask): TaskFile | null => (file ? fileView(file) : null)

/** Cuántos minutos después de la fecha límite se entregó; `null` si fue a tiempo. Un atraso de menos de un minuto
    cuenta como uno. */
export function lateBy(submittedAt: string, dueAt: string): { minutes: number } | null {
  const late = new Date(submittedAt).getTime() - new Date(dueAt).getTime()
  return late > 0 ? { minutes: Math.ceil(late / 60_000) } : null
}

/** La entrega como la ve el alumno, con el atraso contra la fecha límite vigente de la tarea. */
export function submissionFor(submission: StoredSubmission, task: StoredTask): Submission {
  return {
    id: submission.id,
    taskId: submission.taskId,
    submittedAt: submission.submittedAt,
    files: submission.files.map(fileView),
    late: lateBy(submission.submittedAt, task.dueAt),
    graded: submission.gradedAt !== null
  }
}

/** La tarea como la ve una persona: con sus comisiones (solo las de ella) y si ya venció. */
export function taskFor(
  task: StoredTask,
  sections: TaskSection[],
  now: Date,
  submission: StoredSubmission | null = null
): Task {
  return {
    id: task.id,
    subjectId: task.subjectId,
    name: task.name,
    instructions: task.instructions,
    file: fileOf(task),
    dueAt: task.dueAt,
    graded: task.graded,
    sections,
    past: new Date(task.dueAt).getTime() < now.getTime(),
    createdAt: task.createdAt,
    submission: submission ? submissionFor(submission, task) : null
  }
}

/** La tarea como fecha del calendario del alumno, vista desde una de sus comisiones. */
export function datedOf(task: StoredTask, section: MySection, now: string): DatedTask {
  return {
    id: task.id,
    subjectId: task.subjectId,
    subjectCode: section.subjectCode,
    subjectName: section.subjectName,
    name: task.name,
    dueAt: task.dueAt,
    past: task.dueAt < now
  }
}

/** Las que vencen primero arriba; las que ya vencieron, al final y la más reciente primero. */
export function byDue(tasks: Task[]): Task[] {
  const time = (t: Task) => new Date(t.dueAt).getTime()
  const upcoming = tasks
    .filter((t) => !t.past)
    .sort((a, b) => time(a) - time(b) || a.createdAt.localeCompare(b.createdAt))
  const past = tasks.filter((t) => t.past).sort((a, b) => time(b) - time(a) || a.createdAt.localeCompare(b.createdAt))
  return [...upcoming, ...past]
}
