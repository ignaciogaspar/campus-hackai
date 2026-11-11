/* Aula virtual en memoria, sobre una copia del set de datos sintéticos. Se
   porta como el Moodle simulado: matricula y tiene tareas con fecha. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ClassroomCapabilities, ClassroomPort } from '@/lib/ports/classroom'
import { fail, ok } from '@/lib/result'

export type MemoryClassroomOptions = { capabilities?: Partial<ClassroomCapabilities> }

export function createMemoryClassroom(data: SyntheticData, options: MemoryClassroomOptions = {}): ClassroomPort {
  const db = structuredClone(data.moodle)
  const users = new Set(data.people.map((p) => p.moodleId))
  const capabilities: ClassroomCapabilities = { canEnrol: true, hasAssignments: true, ...options.capabilities }

  const copy = <T>(value: T): T => structuredClone(value)
  const hasCourse = (id: string) => db.courses.some((c) => c.id === id)

  return {
    capabilities,

    async coursesOf(userId) {
      const mine = db.enrolments.filter((e) => e.userId === userId)
      return ok(
        mine.flatMap((e) => {
          const course = db.courses.find((c) => c.id === e.courseId)
          return course ? [{ ...copy(course), role: e.role }] : []
        })
      )
    },

    async coursesForSection(siuSectionId) {
      return ok(copy(db.courses.filter((c) => c.siuSectionIds.includes(siuSectionId))))
    },

    async enrol(userId, courseId, role) {
      if (!capabilities.canEnrol) return fail('no-soportado')
      if (!hasCourse(courseId)) return fail('curso-inexistente')
      if (!users.has(userId)) return fail('usuario-inexistente')
      const existing = db.enrolments.find((e) => e.userId === userId && e.courseId === courseId)
      if (existing) existing.role = role
      else db.enrolments.push({ userId, courseId, role })
      return ok({ userId, courseId, role })
    },

    async unenrol(userId, courseId) {
      if (!capabilities.canEnrol) return fail('no-soportado')
      if (!hasCourse(courseId)) return fail('curso-inexistente')
      if (!users.has(userId)) return fail('usuario-inexistente')
      db.enrolments = db.enrolments.filter((e) => !(e.userId === userId && e.courseId === courseId))
      return ok(null)
    },

    async announcements(courseId, since) {
      if (!hasCourse(courseId)) return fail('curso-inexistente')
      return ok(copy(db.announcements.filter((a) => a.courseId === courseId && (!since || a.createdAt > since))))
    },

    async contents(courseId) {
      if (!hasCourse(courseId)) return fail('curso-inexistente')
      return ok(copy(db.contents.filter((c) => c.courseId === courseId)))
    },

    async assignments(courseId) {
      if (!capabilities.hasAssignments) return fail('no-soportado')
      if (!hasCourse(courseId)) return fail('curso-inexistente')
      return ok(copy(db.assignments.filter((a) => a.courseId === courseId)))
    },

    courseUrl(courseId) {
      return `${db.baseUrl}/course/view.php?id=${encodeURIComponent(courseId)}`
    }
  }
}
