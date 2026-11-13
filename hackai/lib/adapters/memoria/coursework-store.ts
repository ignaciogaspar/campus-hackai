/* Almacén de Seguimiento en memoria. Arranca vacío: las tareas las crean los
   docentes y las entregas, los alumnos. Se porta como el de Supabase y pasa la misma batería de contrato
   (tests/contracts/coursework-store.test.ts). */
import type { CourseworkStore, StoredGrade, StoredSubmission, StoredTask } from '@/lib/core/coursework'
import { ok } from '@/lib/result'

export function createMemoryCourseworkStore(): CourseworkStore {
  const tasks: StoredTask[] = []
  const submissions: StoredSubmission[] = []
  const grades: StoredGrade[] = []
  let gradeCounter = 0
  let counter = 0
  let submissionCounter = 0

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
    },

    async submission(taskId, personId) {
      const found = submissions.find((s) => s.taskId === taskId && s.personId === personId)
      return ok(found ? copy(found) : null)
    },

    async saveSubmission(submission) {
      const index = submissions.findIndex((s) => s.taskId === submission.taskId && s.personId === submission.personId)
      if (index >= 0) {
        submissions[index] = { ...copy(submission), id: submissions[index].id }
        return ok(copy(submissions[index]))
      }
      submissionCounter += 1
      const created: StoredSubmission = { ...copy(submission), id: `entrega-${submissionCounter}` }
      submissions.push(created)
      return ok(copy(created))
    },

    async submissionsBy(personId, taskIds) {
      return ok(copy(submissions.filter((s) => s.personId === personId && taskIds.includes(s.taskId))))
    },

    async submissionByFile(fileId) {
      const found = submissions.find((s) => s.files.some((f) => f.id === fileId))
      return ok(found ? copy(found) : null)
    },

    async saveGrade(grade) {
      const index = grades.findIndex(
        (g) =>
          g.sectionId === grade.sectionId &&
          g.kind === grade.kind &&
          g.refId === grade.refId &&
          g.personId === grade.personId
      )
      if (index >= 0) {
        grades[index] = { ...copy(grade), id: grades[index].id }
        return ok(copy(grades[index]))
      }
      gradeCounter += 1
      const created: StoredGrade = { ...copy(grade), id: `nota-${gradeCounter}` }
      grades.push(created)
      return ok(copy(created))
    },

    async gradesOfSection(sectionId) {
      return ok(copy(grades.filter((g) => g.sectionId === sectionId)))
    },

    async publishColumn(column, at, pass) {
      const published = grades.filter(
        (g) =>
          g.sectionId === column.sectionId &&
          g.kind === column.kind &&
          g.refId === column.refId &&
          g.publishedAt === null &&
          (g.value !== null || g.absent)
      )
      for (const g of published) {
        g.publishedAt = at
        g.pass = pass ? copy(pass) : null
      }
      return ok(copy(published))
    },

    async setPassStatus(gradeIds, status) {
      for (const g of grades) if (g.pass && gradeIds.includes(g.id)) g.pass.status = status
      return ok(undefined)
    },

    async pendingPasses() {
      const pending = grades.filter((g) => g.pass?.status === 'pendiente')
      return ok(copy(pending.sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''))))
    },

    async publishedGradesOf(personId) {
      return ok(copy(grades.filter((g) => g.personId === personId && g.publishedAt !== null)))
    },

    async gradeSubmission(taskId, personId, at) {
      const found = submissions.find((s) => s.taskId === taskId && s.personId === personId)
      if (!found) return ok(null)
      found.gradedAt ??= at
      return ok(copy(found))
    },

    async submissionById(submissionId) {
      const found = submissions.find((s) => s.id === submissionId)
      return ok(found ? copy(found) : null)
    },

    async submissionsOfTask(taskId) {
      return ok(copy(submissions.filter((s) => s.taskId === taskId)))
    }
  }
}
