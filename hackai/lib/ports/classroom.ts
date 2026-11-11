/* Puerto del aula virtual (Moodle). Copia la forma de sus Web Services
   (research: docs/research/2026-11-10-moodle-web-services.md): cursos de un
   usuario, matricular y desmatricular, avisos del foro, contenidos y tareas
   con fecha. Los ids de usuario son ids de Moodle; Personas los mapea. */
import type { ExternalFailure, Result } from '@/lib/result'

export type ClassroomCapabilities = {
  /** Matricular y desmatricular por API. */
  canEnrol: boolean
  /** Expone tareas con fecha límite. */
  hasAssignments: boolean
}

export type ClassroomRole = 'student' | 'editingteacher'

/** Curso de Moodle, con las comisiones del SIU a las que está vinculado. */
export type ClassroomCourse = {
  id: string
  shortName: string
  fullName: string
  siuSectionIds: string[]
}

export type ClassroomEnrolment = { userId: string; courseId: string; role: ClassroomRole }

export type ClassroomFile = { name: string; url: string; contentType: string; size: number }

/** Aviso del foro de Avisos de un curso. */
export type ClassroomAnnouncement = {
  id: string
  courseId: string
  authorId: string
  subject: string
  message: string
  createdAt: string
  attachments: ClassroomFile[]
}

/** Recurso del curso: un archivo o un enlace, dentro de un tema. */
export type ClassroomContent = {
  id: string
  courseId: string
  topic: string
  name: string
  type: 'file' | 'url'
  url: string
  modifiedAt: string
}

/** Tarea con fecha límite. */
export type ClassroomAssignment = {
  id: string
  courseId: string
  name: string
  dueDate: string | null
}

export type ClassroomReadError = 'curso-inexistente' | ExternalFailure
export type ClassroomEnrolError = 'curso-inexistente' | 'usuario-inexistente' | 'no-soportado' | ExternalFailure

export type ClassroomPort = {
  capabilities: ClassroomCapabilities

  coursesOf(userId: string): Promise<Result<(ClassroomCourse & { role: ClassroomRole })[], ExternalFailure>>
  /** Cursos vinculados a una comisión del SIU. */
  coursesForSection(siuSectionId: string): Promise<Result<ClassroomCourse[], ExternalFailure>>
  enrol(userId: string, courseId: string, role: ClassroomRole): Promise<Result<ClassroomEnrolment, ClassroomEnrolError>>
  unenrol(userId: string, courseId: string): Promise<Result<null, ClassroomEnrolError>>
  /** Avisos del curso, opcionalmente solo los posteriores a `since`. */
  announcements(courseId: string, since?: string): Promise<Result<ClassroomAnnouncement[], ClassroomReadError>>
  contents(courseId: string): Promise<Result<ClassroomContent[], ClassroomReadError>>
  assignments(courseId: string): Promise<Result<ClassroomAssignment[], ClassroomReadError | 'no-soportado'>>
  /** Enlace al aula del curso en el Campus Virtual (`<base>/course/view.php?id=<id>`). No consulta nada. */
  courseUrl(courseId: string): string
}
