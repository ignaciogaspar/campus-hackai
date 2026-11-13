/* Las reglas de los textos de una tarea y cómo se arma la que ve cada persona.
   Todo puro. */
import type { StoredTask, Task, TaskChanges, TaskFile, TaskSection, TaskTextError } from '@/lib/core/coursework'
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

function fileOf({ file }: StoredTask): TaskFile | null {
  if (!file) return null
  return { name: file.name, contentType: file.contentType, size: file.size, url: fileUrl(file.id, file.name) }
}

/** La tarea como la ve una persona: con sus comisiones (solo las de ella) y si ya venció. */
export function taskFor(task: StoredTask, sections: TaskSection[], now: Date): Task {
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
    createdAt: task.createdAt
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
