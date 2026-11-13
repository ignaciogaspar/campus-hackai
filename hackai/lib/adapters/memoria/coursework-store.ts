/* Almacén de Seguimiento en memoria. Arranca vacío: las tareas las crean los
   docentes. Se porta como el de Supabase y pasa la misma batería de contrato
   (tests/contracts/coursework-store.test.ts). */
import type { CourseworkStore, StoredTask } from '@/lib/core/coursework'
import { ok } from '@/lib/result'

export function createMemoryCourseworkStore(): CourseworkStore {
  const tasks: StoredTask[] = []
  let counter = 0

  const copy = <T>(value: T): T => structuredClone(value)
  const byDueThenCreation = (a: StoredTask, b: StoredTask) =>
    new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() || a.createdAt.localeCompare(b.createdAt)

  return {
    async createTask(task) {
      counter += 1
      const created: StoredTask = { ...copy(task), id: `tarea-${counter}` }
      tasks.push(created)
      return ok(copy(created))
    },

    async updateTask(taskId, changes) {
      const found = tasks.find((t) => t.id === taskId)
      if (!found) return ok(null)
      Object.assign(found, changes)
      return ok(copy(found))
    },

    async task(taskId) {
      const found = tasks.find((t) => t.id === taskId)
      return ok(found ? copy(found) : null)
    },

    async tasksOfSubject(subjectId) {
      return ok(copy(tasks.filter((t) => t.subjectId === subjectId).sort(byDueThenCreation)))
    },

    async taskByFile(fileId) {
      const found = tasks.find((t) => t.file?.id === fileId)
      return ok(found ? copy(found) : null)
    }
  }
}
