/* Seguimiento (coursework): las tareas de una materia y sus entregas. Interfaz y
   reglas en hackai/docs/ARQUITECTURA.md. Hoy el docente crea y edita tareas, el
   alumno las ve y las entrega; la vista del docente sobre las entregas y las
   calificaciones se suman en los tickets siguientes.

   - Una tarea es de una o más comisiones vigentes de una materia, y la crea un
     docente que las dicta todas. La gestionan los docentes de esas comisiones.
   - La ven los docentes y los alumnos de esas comisiones. La pertenencia se
     deduce de `sectionsOf` de Cursada en cada llamada y no se guarda: nunca se
     confía en una comisión que llega del navegador.
   - Una tarea sin nota queda marcada (`graded: false`): no tendrá columna en
     Calificaciones.
   - «Vencida» (`past`) se calcula al leer, con el reloj: si el docente corre la
     fecha límite, se recalcula.
   - El archivo de la consigna se guarda en Archivos y se entrega solo a quien
     ve la tarea.
   - Entregar es cosa del alumno de una de las comisiones de la tarea: sube uno
     o más archivos y queda guardado cuándo lo hizo. Pasada la fecha límite se
     acepta igual y queda atrasada, con cuántos minutos. El atraso se calcula al
     leer, con la fecha límite vigente. Volver a entregar reemplaza la entrega
     anterior (y borra sus archivos) hasta que el docente la califica. Los
     archivos de una entrega los baja solo quien la hizo.
   - Las tareas con fecha de las materias actuales del alumno (`dated`) las
     compone Hoy para el calendario y el `.ics`.

   Usa Cursada, el puerto de Archivos y el reloj. Cursada no lo llama. */
import { createCourseworkModule } from '@/lib/core/coursework/module'
import type { PersonId, Role } from '@/lib/core/people'
import type { Studies } from '@/lib/core/studies'
import type { ClockPort } from '@/lib/ports/clock'
import type { FileContent, FilesPort, NewFile } from '@/lib/ports/files'
import type { ExternalFailure, Result } from '@/lib/result'

export type TaskId = string

/** Una comisión de la persona que mira. */
export type TaskSection = { sectionId: string; name: string }

export type TaskFile = { name: string; contentType: string; size: number; url: string }

/** La materia de una tarea, para el título de la pantalla. */
export type TaskSubject = { subjectId: string; subjectName: string; subjectCode: string; termName: string }

/** Una entrega del alumno a una tarea. */
export type Submission = {
  id: string
  taskId: TaskId
  /** ISO: cuándo entregó, o cuándo reemplazó la entrega. */
  submittedAt: string
  files: TaskFile[]
  /** Si entregó después de la fecha límite (la vigente), cuántos minutos tarde; si no, `null`. */
  late: { minutes: number } | null
  /** Si el docente ya la calificó: desde entonces no se reemplaza. */
  graded: boolean
}

export type Task = {
  id: TaskId
  subjectId: string
  name: string
  instructions: string
  file: TaskFile | null
  /** ISO. */
  dueAt: string
  /** Si lleva nota. Una tarea sin nota no tiene columna en Calificaciones. */
  graded: boolean
  /** Las comisiones de la tarea que tiene la persona que mira: nunca las de otras comisiones. */
  sections: TaskSection[]
  /** Si la fecha límite ya pasó, según el reloj de la lectura. */
  past: boolean
  createdAt: string
  /** La entrega de quien mira, si es alumno y ya entregó; si no, `null`. */
  submission: Submission | null
}

export type TaskView = Task & { subject: TaskSubject; role: Role; canManage: boolean; staleSince: string | null }

export type TaskList = {
  subject: TaskSubject
  role: Role
  /** Las comisiones de la persona en la materia (las vigentes, o todas si ninguna lo es). */
  sections: TaskSection[]
  /** La comisión de la que se listan las tareas: la pedida si es de la persona, o la primera. */
  sectionId: string
  /** Las que vencen primero arriba; las que ya vencieron, al final, la más reciente primero. */
  tasks: Task[]
  staleSince: string | null
}

export type NewTask = {
  subjectId: string
  /** Las comisiones vigentes de esa materia que dicta el docente. */
  sectionIds: string[]
  name: string
  instructions: string
  /** Fecha límite: cualquier fecha ISO con zona. */
  dueAt: string
  graded: boolean
  file?: NewFile
}

/** Lo único que se cambia de una tarea ya creada: sus comisiones y si lleva nota, no. */
export type TaskChanges = { name: string; instructions: string; dueAt: string }

/** Una tarea con fecha de una materia actual del alumno, para el calendario. */
export type DatedTask = {
  id: TaskId
  subjectId: string
  subjectCode: string
  subjectName: string
  name: string
  /** ISO. */
  dueAt: string
  past: boolean
}

export type AccessError = 'persona-desconocida' | 'sin-acceso' | ExternalFailure
export type TaskTextError = 'nombre-invalido' | 'consigna-invalida' | 'fecha-invalida'
export type TaskFileError = 'demasiado-grande' | 'archivo-vacio'
export type SubmitError =
  | AccessError
  | 'tarea-desconocida'
  | 'solo-alumnos'
  | 'sin-archivos'
  | 'demasiados-archivos'
  | 'ya-calificada'
  | TaskFileError

export type Coursework = {
  /** Crea una tarea para una o varias comisiones vigentes que dicta el docente. Si algo falla después de
      guardar el archivo, lo borra. */
  createTask(
    personId: PersonId,
    task: NewTask
  ): Promise<Result<TaskView, AccessError | 'solo-docentes' | 'sin-comisiones' | TaskTextError | TaskFileError>>
  /** Cambia el nombre, la consigna y la fecha límite. Lo hacen los docentes de las comisiones de la tarea. */
  updateTask(
    personId: PersonId,
    taskId: TaskId,
    changes: TaskChanges
  ): Promise<Result<TaskView, AccessError | 'tarea-desconocida' | 'solo-docentes' | TaskTextError>>
  /** Las tareas de una comisión de la materia: al docente, la que elige de las que dicta; al alumno, la suya. */
  tasksOf(personId: PersonId, subjectId: string, sectionId?: string): Promise<Result<TaskList, AccessError>>
  /** Una tarea, si la persona es de una de sus comisiones; si no, `tarea-desconocida`, como si no existiera. */
  task(personId: PersonId, taskId: TaskId): Promise<Result<TaskView, AccessError | 'tarea-desconocida'>>
  /** El alumno entrega uno o más archivos a una tarea de su comisión, o reemplaza su entrega anterior si el
      docente todavía no la calificó. Después de la fecha límite se acepta y queda atrasada. Si algo falla, no
      deja archivos sueltos y la entrega anterior sigue como estaba. */
  submit(personId: PersonId, taskId: TaskId, files: NewFile[]): Promise<Result<Submission, SubmitError>>
  /** Las tareas de las materias actuales del alumno, por fecha límite. A un docente le da una lista vacía. */
  dated(personId: PersonId): Promise<Result<DatedTask[], AccessError>>
  /** Los bytes de un archivo de Seguimiento: la consigna de una tarea, para quien la ve, o un archivo de una
      entrega, para quien la hizo. */
  file(personId: PersonId, fileId: string): Promise<Result<FileContent, 'archivo-desconocido' | AccessError>>
}

// Almacén de Seguimiento: un seam interno, que se inyecta al armar el módulo y
// no es parte de su interfaz. Guarda las tareas. No sabe de permisos: eso es del
// módulo.

export type CourseworkStoreError = ExternalFailure

export type StoredTaskFile = { id: string; name: string; contentType: string; size: number }

export type StoredTask = {
  id: string
  subjectId: string
  sectionIds: string[]
  name: string
  instructions: string
  file: StoredTaskFile | null
  dueAt: string
  graded: boolean
  createdBy: PersonId
  createdAt: string
}

export type StoredSubmission = {
  id: string
  taskId: string
  personId: PersonId
  submittedAt: string
  files: StoredTaskFile[]
  /** Desde cuándo está calificada, o `null`. */
  gradedAt: string | null
}

export type CourseworkStore = {
  createTask(task: Omit<StoredTask, 'id'>): Promise<Result<StoredTask, CourseworkStoreError>>
  /** La tarea con lo cambiado, o `null` si no existe. */
  updateTask(taskId: string, changes: TaskChanges): Promise<Result<StoredTask | null, CourseworkStoreError>>
  task(taskId: string): Promise<Result<StoredTask | null, CourseworkStoreError>>
  /** Las tareas de todas las comisiones de la materia, por fecha límite y alta. */
  tasksOfSubject(subjectId: string): Promise<Result<StoredTask[], CourseworkStoreError>>
  /** La tarea cuya consigna es ese archivo, o `null`. */
  taskByFile(fileId: string): Promise<Result<StoredTask | null, CourseworkStoreError>>
  /** La entrega de esa persona a esa tarea, o `null`. */
  submission(taskId: string, personId: PersonId): Promise<Result<StoredSubmission | null, CourseworkStoreError>>
  /** Guarda la entrega de la persona a la tarea: la crea o, si ya había una, la reemplaza entera. */
  saveSubmission(submission: Omit<StoredSubmission, 'id'>): Promise<Result<StoredSubmission, CourseworkStoreError>>
  /** Las entregas de la persona a esas tareas. */
  submissionsBy(personId: PersonId, taskIds: string[]): Promise<Result<StoredSubmission[], CourseworkStoreError>>
  /** La entrega que tiene ese archivo, o `null`. */
  submissionByFile(fileId: string): Promise<Result<StoredSubmission | null, CourseworkStoreError>>
}

export type CourseworkDeps = {
  studies: Studies
  files: FilesPort
  clock: ClockPort
  store: CourseworkStore
}

export function createCoursework(deps: CourseworkDeps): Coursework {
  return createCourseworkModule(deps)
}
