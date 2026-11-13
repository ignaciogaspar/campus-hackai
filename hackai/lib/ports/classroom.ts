/* Puerto del aula virtual (Moodle). Copia la forma de sus Web Services
   (research: docs/research/2026-11-10-moodle-web-services.md): cursos de un
   usuario, matricular y desmatricular, avisos del foro, todos los elementos
   del curso en el orden del aula (archivos, enlaces, carpetas, páginas,
   textos y actividades) y tareas con su consigna. Los ids de usuario son ids
   de Moodle; Personas los mapea. Con la cuenta real de un alumno, lo leído no
   se guarda (ADR 0010): lo dice cada curso con `liveOnly`. */
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
  /** Si lo del curso se lee con la credencial de una persona (su cuenta real del Campus): entonces se muestra
      leído en vivo y no se guarda en HackAI (ADR 0010). Sin el campo, se puede guardar. */
  liveOnly?: boolean
}

export type ClassroomEnrolment = { userId: string; courseId: string; role: ClassroomRole }

export type ClassroomFile = { name: string; url: string; contentType: string; size: number }

/** Aviso del foro de Avisos de un curso. El mensaje va en texto, sin HTML. */
export type ClassroomAnnouncement = {
  id: string
  courseId: string
  authorId: string
  /** El nombre del autor como lo muestra el aula, para cuando Personas no lo tiene vinculado. */
  authorName?: string
  subject: string
  message: string
  createdAt: string
  attachments: ClassroomFile[]
}

/** Qué es un elemento del curso, según su módulo de Moodle (`modname`):
    - `file` (`resource`): un archivo; `url` es el archivo y `files` lo describe.
    - `url`: un enlace a otro sitio.
    - `folder`: una carpeta, con sus archivos en `files`.
    - `page`: una página de texto dentro del aula, con su texto en `text`.
    - `label`: un texto suelto entre los demás elementos (`text`), sin enlace.
    - `activity`: algo que se hace en el aula (cuestionario, foro, tarea, lista de control…). `activity` es su
      módulo y `url` lleva a la actividad en el aula. */
export type ClassroomContentType = 'file' | 'url' | 'folder' | 'page' | 'label' | 'activity'

/** Elemento del curso, dentro de un tema. */
export type ClassroomContent = {
  id: string
  courseId: string
  topic: string
  name: string
  type: ClassroomContentType
  /** El archivo, el enlace o la actividad en el aula. Vacío en un texto suelto. */
  url: string
  modifiedAt: string
  /** El lugar en el aula: los temas en orden y, adentro, los elementos en orden. */
  position: number
  /** Los archivos de una carpeta, o el de un archivo. Vacío en lo demás. */
  files: ClassroomFile[]
  /** El texto de una página o de un texto suelto, sin HTML. `null` en lo demás. */
  text: string | null
  /** El módulo de Moodle de una actividad (`quiz`, `forum`, `assign`…). `null` en lo demás. */
  activity: string | null
}

/** Cómo está la entrega de una tarea para quien lee el aula con su cuenta. */
export type ClassroomSubmission = 'sin-entregar' | 'borrador' | 'entregada'

/** Tarea con fecha límite. */
export type ClassroomAssignment = {
  id: string
  courseId: string
  name: string
  dueDate: string | null
  /** La consigna, en texto. `null` si no tiene. */
  description: string | null
  /** La tarea en el aula, donde se entrega. */
  url: string
  /** La entrega de quien lee el aula con su cuenta; `null` si el aula no la sabe, como en el simulado, que no
      lee por persona. */
  submission: ClassroomSubmission | null
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
