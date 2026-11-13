/* Seguimiento (coursework): las tareas de una materia. Interfaz y reglas en
   hackai/docs/ARQUITECTURA.md. Hoy tiene la primera rebanada: el docente crea
   y edita tareas y el alumno las ve; las entregas y las calificaciones se
   suman en los tickets siguientes.

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

export type AccessError = 'persona-desconocida' | 'sin-acceso' | ExternalFailure
export type TaskTextError = 'nombre-invalido' | 'consigna-invalida' | 'fecha-invalida'
export type TaskFileError = 'demasiado-grande' | 'archivo-vacio'

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
  /** Los bytes del archivo de la consigna de una tarea, para quien la ve. */
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

export type CourseworkStore = {
  createTask(task: Omit<StoredTask, 'id'>): Promise<Result<StoredTask, CourseworkStoreError>>
  /** La tarea con lo cambiado, o `null` si no existe. */
  updateTask(taskId: string, changes: TaskChanges): Promise<Result<StoredTask | null, CourseworkStoreError>>
  task(taskId: string): Promise<Result<StoredTask | null, CourseworkStoreError>>
  /** Las tareas de todas las comisiones de la materia, por fecha límite y alta. */
  tasksOfSubject(subjectId: string): Promise<Result<StoredTask[], CourseworkStoreError>>
  /** La tarea cuya consigna es ese archivo, o `null`. */
  taskByFile(fileId: string): Promise<Result<StoredTask | null, CourseworkStoreError>>
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
