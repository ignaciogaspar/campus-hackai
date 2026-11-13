/* Seguimiento (coursework): las tareas de una materia y sus entregas. Interfaz y
   reglas en hackai/docs/ARQUITECTURA.md. Hoy el docente crea y edita tareas, ve
   quién entregó, califica y publica las notas; el alumno las ve y las entrega y
   ve sus notas publicadas, y el docente pone un peso a cada columna y publica
   la nota de cursada.

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
     archivos de una entrega los baja quien la hizo y los docentes de la
     comisión del alumno.
   - Quién entregó: el docente ve todos los alumnos de una comisión suya (los de
     Cursada) con su estado, y abre cada entrega. Una comisión que no dicta es
     `sin-acceso`; la entrega de un alumno de otra comisión, para él, no existe.
   - Las tareas con fecha de las materias actuales del alumno (`dated`) las
     compone Hoy para el calendario y el `.ics`.
   - Calificaciones: una columna por tarea con nota de la comisión y una por
     evaluación del cronograma del SIU (Cursada, solo docentes de la comisión).
     La columna es por comisión: la misma tarea en dos comisiones tiene dos
     columnas, y se publica de a una. Una tarea sin nota no tiene columna. El
     docente pone nota (1 a 10, con dos decimales) o ausente, y un comentario;
     calificar la entrega de una tarea cierra su reemplazo.
   - El alumno ve una nota solo cuando su columna está publicada. Publicar
     sella las notas cargadas; una nota que se carga o se cambia después en una
     columna ya publicada sale publicada en ese momento. Que una nota publicada
     sea nueva para la campana lo decide `newGrades` (última semana, después de
     la última vez que el alumno las vio); quien junta estas notas con las del
     SIU es Hoy, no Cursada.
   - Pegar notas: el docente pega texto con tabulaciones copiado de Excel o
     Google Sheets en una columna y ve una vista previa (`previewPaste`) antes
     de guardar: a quién reconoció (por legajo, mail o nombre), a quién no y cómo
     leyó cada nota (de 1 a 10 o de 0 a 100, coma o punto, «A» de ausente).
     `applyPaste` vuelve a leer el mismo texto y guarda; antes no se guarda nada.
     Una nota pegada no pisa el comentario que ya tenía.

   - Pase al SIU: publicar una columna de una evaluación del SIU pasa sus notas al
     SIU por Cursada (`passGrades`); una tarea no existe en el SIU y queda solo en
     HackAI. Cada nota guarda su estado de pase: `pendiente` (todavía no pasó, o el
     SIU falló y se reintenta, sin duplicar), `pasado`, o `no-permitido` (el SIU no
     deja escribir notas). El alumno ve la nota igual en los tres estados. Una nota
     que se cambia en una columna publicada vuelve a pasar. Reintenta `retryPass`
     (la corrida periódica), en el orden en que se publicaron, y el docente desde
     Calificaciones.

   - Pesos y nota de cursada: cada columna de la comisión puede tener un peso (de 0
     a 100; sin peso no cuenta). La nota de cursada de cada alumno es el promedio
     ponderado de sus columnas con nota y peso; no se guarda, se calcula al leer.
     Las columnas sin nota del alumno, y los ausentes, no cuentan: el peso se
     reparte entre las que sí tienen. El docente la puede pisar (`editada`) y volver
     al cálculo. Publicarla (`publishCourseGrade`) guarda lo que ve el alumno y la
     pasa al SIU con el mismo pase de las evaluaciones; si después cambia el
     cálculo, el docente la vuelve a publicar. Pisar una nota ya publicada la
     publica en el momento, como cambiar una nota de una columna publicada.

   Usa Cursada, el puerto de Archivos y el reloj. Cursada no lo llama. */
import { createCourseworkModule } from '@/lib/core/coursework/module'
import type { PersonId, Role } from '@/lib/core/people'
import type { SectionStudent, Studies } from '@/lib/core/studies'
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

/** Qué se califica: una tarea, una evaluación del SIU, una instancia de examen que el docente sumó en HackAI (no
    existe en el SIU) o la nota de cursada (una por alumno y comisión). La de cursada no es una columna de
    Calificaciones: se calcula de las columnas. */
export type ColumnKind = 'tarea' | 'evaluacion' | 'examen' | 'cursada'

/** De qué tipo es una instancia de examen que suma el docente. */
export type ExamKind = 'parcial' | 'recuperatorio' | 'integrador'

/** Una instancia de examen guardada en HackAI: una propia del docente (`siuAssessmentId` en `null`) o el nombre y la
    fecha que el docente le corrigió a una evaluación del SIU. */
export type StoredExam = {
  id: string
  sectionId: string
  siuAssessmentId: string | null
  kind: ExamKind
  name: string
  /** ISO. */
  date: string
}

/** Si la materia se promociona en la comisión y con qué nota de cursada como mínimo. */
export type Promotion = { promotable: boolean; minimum: number }

/** Cómo queda la cursada con la nota que vale: promociona (si la comisión es promocionable y llega al mínimo),
    regular desde 4 o desaprobada. */
export type CourseCondition = 'promociona' | 'regular' | 'desaprobado'

/** Una instancia de examen de la comisión, como la ve el docente en «Evaluación»: las del SIU (con lo que les
    corrigió) y las propias. */
export type ExamInstance = {
  /** El id de su columna en Calificaciones. */
  columnId: string
  source: 'siu' | 'hackai'
  kind: ExamKind | 'tp'
  name: string
  date: string
  /** Si es del SIU y el docente le cambió el nombre o la fecha. */
  edited: boolean
  /** Cuántos alumnos tienen nota o ausente en ella. */
  graded: number
  /** Una propia sin notas se puede borrar; una del SIU, nunca. */
  canDelete: boolean
}

/** Cómo se evalúa una comisión: sus instancias de examen, los pesos de las columnas y la promoción. */
export type EvaluationSetup = {
  subject: TaskSubject
  sections: TaskSection[]
  sectionId: string
  exams: ExamInstance[]
  /** Las columnas de Calificaciones, con su peso. */
  columns: GradeColumn[]
  weightTotal: number
  promotion: Promotion
  staleSince: string | null
}

/** Lo que manda el docente para sumar una instancia (`columnId` ausente) o corregir una existente. */
export type ExamInput = { sectionId: string; columnId?: string; kind: ExamKind; name: string; date: string }

export type ExamError =
  | 'solo-docentes'
  | 'columna-desconocida'
  | 'nombre-invalido'
  | 'fecha-invalida'
  | 'tipo-invalido'
  | 'examen-con-notas'

/** Cuántas notas de una columna pasaron al SIU, esperan pasar o el SIU no permite pasar. */
export type PassCounts = { passed: number; pending: number; refused: number }

/** Una columna de Calificaciones de una comisión: una tarea con nota o una evaluación del cronograma del SIU. */
export type GradeColumn = {
  /** `tarea:<id de la tarea>` o `evaluacion:<id de la evaluación del SIU>`. */
  id: string
  kind: ColumnKind
  name: string
  /** ISO: la fecha límite de la tarea o la fecha de la evaluación. */
  date: string
  /** Si es una evaluación o una instancia de examen, de qué tipo; si es una tarea, `null`. */
  assessmentKind: 'parcial' | 'recuperatorio' | 'integrador' | 'tp' | null
  /** ISO: desde cuándo la ven los alumnos; `null` si todavía es un borrador. */
  publishedAt: string | null
  /** Cuántos alumnos tienen nota o ausente. */
  graded: number
  /** De esos, cuántos todavía no los ve el alumno. */
  unpublished: number
  /** Cómo va el pase al SIU de sus notas publicadas; `null` en una tarea, que no existe en el SIU. */
  pass: PassCounts | null
  /** El peso en la nota de cursada, de 0 a 100; `null` si todavía no tiene (y no cuenta). */
  weight: number | null
}

/** Cómo va el pase de una nota al SIU: todavía no pasó, ya pasó o el SIU no lo permite. */
export type PassStatus = 'pendiente' | 'pasado' | 'no-permitido'

/** Una nota que se pasa al SIU en nombre de un docente de la comisión: `by` es la persona que publicó o cambió la
    nota, con la que se reintenta. */
export type GradePass = { status: PassStatus; by: PersonId }

/** La nota de un alumno en una columna. */
export type GradeCell = {
  /** De 1 a 10; `null` si estuvo ausente. */
  value: number | null
  absent: boolean
  comment: string
  /** ISO: cuándo se cargó. */
  gradedAt: string
  /** Si el alumno ya la ve. */
  published: boolean
  /** Cómo va el pase al SIU: solo una nota publicada de una evaluación del SIU se pasa; si no, `null`. */
  pass: PassStatus | null
}

/** La nota de cursada de un alumno. */
export type CourseGradeCell = {
  /** El promedio ponderado de sus columnas con nota y peso; `null` si ninguna cuenta. */
  calculated: number | null
  /** La que vale: la que pisó el docente o, si no, la calculada. */
  value: number | null
  /** Si la pisó el docente. */
  edited: boolean
  /** La que ve el alumno; `null` si todavía no se publicó. */
  published: number | null
  /** Cómo va su pase al SIU; `null` si no se publicó. */
  pass: PassStatus | null
  /** Cómo queda la cursada con la nota que vale; `null` sin nota. */
  condition: CourseCondition | null
}

/** La nota de cursada de la comisión: cuántos tienen, cuántos falta publicar y cómo va el pase al SIU. */
export type CourseGradeSummary = {
  /** La suma de los pesos de las columnas. */
  weightTotal: number
  promotion: Promotion
  /** Cuántos alumnos tienen nota de cursada (calculada o pisada). */
  graded: number
  /** De esos, a cuántos todavía no se les publicó la nota que vale ahora. */
  unpublished: number
  pass: PassCounts
}

export type GradebookStudent = {
  /** `null` si todavía no tiene cuenta en HackAI: no se le puede cargar nota. */
  personId: PersonId | null
  legajo: string
  /** «Apellido, Nombres». */
  name: string
  email: string
  /** Su nota en cada columna, por id de columna; sin entrada si no tiene. */
  cells: Record<string, GradeCell>
  course: CourseGradeCell
}

export type Gradebook = {
  subject: TaskSubject
  /** Las comisiones vigentes que dicta (o todas, si la materia está archivada). */
  sections: TaskSection[]
  sectionId: string
  /** Por fecha. */
  columns: GradeColumn[]
  students: GradebookStudent[]
  course: CourseGradeSummary
  /** Cuántas notas de la comisión esperan pasar al SIU. */
  pendingPass: number
  staleSince: string | null
}

export type NewGrade = {
  sectionId: string
  columnId: string
  studentId: PersonId
  /** De 1 a 10. Se ignora si `absent`. */
  value: number | null
  absent: boolean
  comment: string
}

/** La nota de qué alumno y en qué columna. */
export type GradeTarget = Pick<NewGrade, 'sectionId' | 'columnId' | 'studentId'>

/** Una nota publicada, como la ve el alumno. */
export type PublishedGrade = {
  subjectId: string
  subjectName: string
  sectionId: string
  kind: ColumnKind
  /** El id de la tarea o de la evaluación del SIU. */
  refId: string
  name: string
  /** ISO: la fecha límite de la tarea; `null` en una evaluación (la fecha la tiene el SIU). */
  date: string | null
  /** De 1 a 10; `null` si estuvo ausente. */
  value: number | null
  absent: boolean
  comment: string
  /** ISO: desde cuándo la ve. */
  publishedAt: string
}

/** Un alumno de la comisión, como lo da Cursada. `personId` es `null` si todavía no tiene cuenta en HackAI. */
export type SubmissionStudent = SectionStudent

/** Entregó a tiempo, entregó tarde o todavía no entregó. */
export type SubmissionState = 'entregada' | 'atrasada' | 'sin-entrega'

/** Un alumno de la comisión y su entrega a la tarea, si la hizo. */
export type SubmissionRow = { student: SubmissionStudent; state: SubmissionState; submission: Submission | null }

export type SubmissionCounts = { onTime: number; late: number; missing: number }

/** Quién entregó una tarea en una comisión: todos sus alumnos, por apellido. */
export type TaskSubmissions = {
  task: TaskView
  sectionId: string
  rows: SubmissionRow[]
  counts: SubmissionCounts
  staleSince: string | null
}

/** Una entrega abierta por el docente: de quién es, con sus archivos. */
export type SubmissionDetail = {
  task: TaskView
  /** La comisión del docente a la que pertenece el alumno. */
  sectionId: string
  student: SubmissionStudent
  submission: Submission
  staleSince: string | null
}

/** Cuántas notas pasaron al SIU en un reintento y cuántas siguen esperando. */
export type PassRetry = { passed: number; pending: number }

export type AccessError = 'persona-desconocida' | 'sin-acceso' | ExternalFailure
/** La escala de las notas que se pegan: de 1 a 10 como se guardan, o de 0 a 100 (se pasan a de 1 a 10). */
export type GradeScale = '1-10' | '0-100'

/** Por qué dato de la línea se reconoció al alumno. */
export type PastedBy = 'legajo' | 'mail' | 'nombre'

/** Qué se entendió de una línea pegada. Solo `nota` y `ausente` se guardan. */
export type PasteOutcome =
  | 'nota'
  | 'ausente'
  /** El alumno es de la comisión, pero la nota no es un número de la escala ni «A». */
  | 'invalida'
  /** El alumno es de la comisión y la línea no trae nota: no se toca lo que ya tenía. */
  | 'sin-nota'
  /** La línea se pudo partir en alumno y nota, pero nadie de la comisión tiene ese legajo, mail o nombre. */
  | 'no-reconocido'
  /** La línea no se pudo partir en alumno y nota (no tiene tabulación) y entera tampoco es nadie de la comisión. */
  | 'formato'
  /** El nombre coincide con más de un alumno de la comisión. */
  | 'ambiguo'
  /** Es de la comisión pero todavía no entró a HackAI: no se le puede cargar nota. */
  | 'sin-cuenta'
  /** El mismo alumno ya venía en una línea anterior: se usa esa. */
  | 'repetido'

export type PasteRow = {
  /** El número de línea del texto pegado, desde 1. */
  line: number
  /** Lo que se pegó para identificar al alumno. */
  key: string
  /** La nota como se pegó. */
  raw: string
  outcome: PasteOutcome
  by: PastedBy | null
  personId: PersonId | null
  /** «Apellido, Nombres», si se lo reconoció. */
  name: string | null
  legajo: string | null
  /** La nota ya de 1 a 10; `null` si es un ausente o no se leyó. */
  value: number | null
  /** En un `repetido`, la línea anterior del mismo alumno y si su nota no servía (entonces no se guarda ninguna). */
  repeats: { line: number; invalid: boolean } | null
}

export type PasteCounts = {
  /** Con nota, para guardar. */
  ready: number
  /** Ausentes, para guardar. */
  absent: number
  /** Líneas que no se pudieron emparejar con un alumno de la comisión. */
  unmatched: number
  invalid: number
  /** Líneas sin nota o repetidas, que no cambian nada. */
  skipped: number
}

export type PastePreview = { scale: GradeScale; rows: PasteRow[]; counts: PasteCounts }

export type PasteError = 'texto-vacio' | 'texto-demasiado-largo'

export type GradeError = 'nota-invalida' | 'comentario-invalido'
export type CourseGradeError = 'peso-invalido' | 'sin-nota-calculada'
export type ColumnError = 'solo-docentes' | 'columna-desconocida'
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
  /** Quién entregó y quién no en una comisión que dicta el docente: todos sus alumnos con su estado (entregó, no
      entregó, atrasada con cuánto). Un docente de otra comisión recibe `sin-acceso`; un alumno, `solo-docentes`. */
  submissions(
    personId: PersonId,
    taskId: TaskId,
    sectionId: string
  ): Promise<Result<TaskSubmissions, AccessError | 'tarea-desconocida' | 'solo-docentes'>>
  /** Una entrega con sus archivos, para el docente de la comisión del alumno. Para cualquier otra persona, o si no
      existe, `entrega-desconocida`. */
  submission(
    personId: PersonId,
    submissionId: string
  ): Promise<Result<SubmissionDetail, AccessError | 'entrega-desconocida'>>
  /** Las tareas de las materias actuales del alumno, por fecha límite. A un docente le da una lista vacía. */
  dated(personId: PersonId): Promise<Result<DatedTask[], AccessError>>
  /** Los bytes de un archivo de Seguimiento: la consigna de una tarea, para quien la ve, o un archivo de una
      entrega, para quien la hizo. */
  file(personId: PersonId, fileId: string): Promise<Result<FileContent, 'archivo-desconocido' | AccessError>>
  /** Calificaciones de una comisión de la materia: las columnas y una fila por alumno. La comisión es la pedida si el
      docente la dicta, o la primera. A un alumno le da `solo-docentes`. */
  gradebook(
    personId: PersonId,
    subjectId: string,
    sectionId?: string
  ): Promise<Result<Gradebook, AccessError | 'solo-docentes'>>
  /** Carga la nota (o el ausente) y el comentario de un alumno en una columna, o los reemplaza. Si la columna ya está
      publicada, el alumno la ve al toque. Calificar la entrega de una tarea cierra su reemplazo. */
  grade(
    personId: PersonId,
    input: NewGrade
  ): Promise<Result<GradeCell, AccessError | ColumnError | GradeError | 'alumno-desconocido'>>
  /** Quita la nota (o el ausente) y el comentario de un alumno en una columna, si todavía no está publicada. Una nota
      que ya ven los alumnos es `nota-publicada`: no se quita, porque ya la vio el alumno y puede haber pasado al SIU.
      Si el alumno no tenía nota, no cambia nada. */
  removeGrade(
    personId: PersonId,
    target: GradeTarget
  ): Promise<Result<void, AccessError | ColumnError | 'alumno-desconocido' | 'nota-publicada'>>
  /** Publica las notas cargadas de una columna: desde ahí las ven los alumnos y les llega a la campana. Publicar de
      nuevo no repite nada. Una columna sin notas cargadas es `sin-notas`. Devuelve cuántas notas se publicaron ahora. */
  publish(
    personId: PersonId,
    sectionId: string,
    columnId: string
  ): Promise<Result<{ published: number }, AccessError | ColumnError | 'sin-notas'>>
  /** Pasa al SIU las notas que esperan, de todas las comisiones, en el orden en que se publicaron. Es lo que corre la
      corrida periódica. Cada nota se pasa en nombre de quien la publicó. Corta en cuanto el SIU falla, para no
      insistir ni desordenar. Devuelve cuántas pasaron y cuántas siguen esperando. */
  retryPass(): Promise<Result<PassRetry, ExternalFailure>>
  /** Lo mismo para las notas de una comisión que dicta el docente, en su nombre: el botón «Reintentar el pase» de
      Calificaciones. */
  retryPassOf(personId: PersonId, sectionId: string): Promise<Result<PassRetry, AccessError | 'solo-docentes'>>
  /** Qué entendería `applyPaste` del texto pegado en una columna de una comisión que dicta el docente: una línea por
      alumno con a quién reconoció y qué nota leyó. No guarda nada. */
  previewPaste(
    personId: PersonId,
    sectionId: string,
    columnId: string,
    text: string,
    scale: GradeScale
  ): Promise<Result<PastePreview, AccessError | ColumnError | PasteError>>
  /** Guarda las notas y los ausentes del texto pegado, leído igual que en `previewPaste`. Conserva el comentario que
      ya tenía cada alumno; en una columna ya publicada las notas salen publicadas. Sin ninguna nota que guardar es
      `sin-notas`. Devuelve cuántas guardó. */
  applyPaste(
    personId: PersonId,
    sectionId: string,
    columnId: string,
    text: string,
    scale: GradeScale
  ): Promise<Result<{ saved: number }, AccessError | ColumnError | PasteError | 'sin-notas'>>
  /** Pone el peso de cada columna que se pasa (de 0 a 100, o `null` para quitarlo); las que no se pasan quedan como
      estaban. No cambia nada si alguna columna no es de la comisión o algún peso no sirve. */
  setWeights(
    personId: PersonId,
    sectionId: string,
    weights: { columnId: string; weight: number | null }[]
  ): Promise<Result<void, AccessError | 'solo-docentes' | 'columna-desconocida' | 'peso-invalido'>>
  /** Pisa la nota de cursada de un alumno (de 1 a 10) y queda marcada como editada, o con `null` vuelve al cálculo.
      Si ya estaba publicada, el cambio se publica y pasa al SIU en el momento. */
  overrideCourseGrade(
    personId: PersonId,
    sectionId: string,
    studentId: PersonId,
    value: number | null
  ): Promise<
    Result<void, AccessError | 'solo-docentes' | 'alumno-desconocido' | 'nota-invalida' | 'sin-nota-calculada'>
  >
  /** Publica la nota de cursada de los alumnos que tienen una y todavía no se les publicó la que vale ahora: la ven
      en Notas y les llega a la campana, y pasa al SIU. Sin ninguna nota de cursada es `sin-notas`. Devuelve a cuántos
      alumnos se les publicó. */
  publishCourseGrade(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<{ published: number }, AccessError | 'solo-docentes' | 'sin-notas'>>
  /** Cómo se evalúa una comisión que dicta el docente: instancias de examen, pesos y promoción. */
  evaluation(
    personId: PersonId,
    subjectId: string,
    sectionId?: string
  ): Promise<Result<EvaluationSetup, AccessError | 'solo-docentes'>>
  /** Suma una instancia de examen propia o corrige el nombre, el tipo y la fecha de una existente (también de una
      del SIU: el cambio queda en HackAI y sus notas se siguen pasando al SIU). */
  saveExam(personId: PersonId, input: ExamInput): Promise<Result<ExamInstance, AccessError | ExamError>>
  /** Borra una instancia propia sin notas. Una del SIU, o una con notas, no se borra. */
  deleteExam(personId: PersonId, sectionId: string, columnId: string): Promise<Result<void, AccessError | ExamError>>
  /** Si la comisión promociona y con qué nota mínima (de 4 a 10). */
  setPromotion(
    personId: PersonId,
    sectionId: string,
    promotion: Promotion
  ): Promise<Result<void, AccessError | 'solo-docentes' | 'nota-invalida'>>
  /** Las notas publicadas del alumno, la más nueva primero. Nunca trae una de una columna sin publicar. */
  publishedFor(personId: PersonId): Promise<Result<PublishedGrade[], AccessError>>
  /** Las publicadas con número en los últimos 7 días y después de `seenAt` (cuando el alumno vio sus notas por última
      vez, o `null`), la más nueva primero. Un ausente no es una nota que llega. */
  newGrades(personId: PersonId, seenAt: string | null): Promise<Result<PublishedGrade[], AccessError>>
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

/** La nota de un alumno en una columna de una comisión. Una columna es `sectionId` + `kind` + `refId`. */
export type StoredGrade = {
  id: string
  sectionId: string
  kind: ColumnKind
  /** El id de la tarea o de la evaluación del SIU. */
  refId: string
  personId: PersonId
  /** Cómo se llamaba la columna al cargar la nota. Una tarea se lee siempre de la tarea. */
  columnName: string
  value: number | null
  absent: boolean
  comment: string
  gradedAt: string
  /** Desde cuándo la ve el alumno, o `null` si es borrador. */
  publishedAt: string | null
  /** El pase al SIU: `null` si no se pasa (una tarea, o todavía un borrador). */
  pass: GradePass | null
  /** Solo en la nota de cursada: si la pisó el docente en vez de salir del cálculo. */
  edited: boolean
}

/** El peso de una columna en la nota de cursada de su comisión. */
export type StoredWeight = ColumnKey & { weight: number }

export type ColumnKey = Pick<StoredGrade, 'sectionId' | 'kind' | 'refId'>

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
  /** Guarda la entrega o reemplaza la que ya tiene la persona en la tarea. Una entrega calificada no se reemplaza:
      `ya-calificada`, también si el docente la calificó después de que se leyó. */
  saveSubmission(
    submission: Omit<StoredSubmission, 'id'>
  ): Promise<Result<StoredSubmission, CourseworkStoreError | 'ya-calificada'>>
  /** Las entregas de la persona a esas tareas. */
  submissionsBy(personId: PersonId, taskIds: string[]): Promise<Result<StoredSubmission[], CourseworkStoreError>>
  /** La entrega que tiene ese archivo, o `null`. */
  submissionByFile(fileId: string): Promise<Result<StoredSubmission | null, CourseworkStoreError>>
  /** Guarda la nota de la persona en la columna: la crea o, si ya había una, la reemplaza entera. */
  saveGrade(grade: Omit<StoredGrade, 'id'>): Promise<Result<StoredGrade, CourseworkStoreError>>
  /** Pone el peso de la columna (de 0 a 100), o lo quita con `null`. */
  saveWeight(column: ColumnKey, weight: number | null): Promise<Result<void, CourseworkStoreError>>
  /** Los pesos que tienen las columnas de la comisión. */
  weightsOfSection(sectionId: string): Promise<Result<StoredWeight[], CourseworkStoreError>>
  /** Las instancias de examen de la comisión guardadas en HackAI: las propias y las correcciones a las del SIU. */
  examsOfSection(sectionId: string): Promise<Result<StoredExam[], CourseworkStoreError>>
  /** Crea la instancia (sin `id`) o reemplaza la que tiene ese id. Para una del SIU hay una sola por evaluación. */
  saveExam(exam: Omit<StoredExam, 'id'> & { id?: string }): Promise<Result<StoredExam, CourseworkStoreError>>
  deleteExam(examId: string): Promise<Result<void, CourseworkStoreError>>
  /** La promoción de la comisión, o `null` si el docente nunca la configuró. */
  promotionOf(sectionId: string): Promise<Result<Promotion | null, CourseworkStoreError>>
  savePromotion(sectionId: string, promotion: Promotion): Promise<Result<void, CourseworkStoreError>>
  /** Todas las notas de la comisión, en el orden en que se cargaron por primera vez. */
  gradesOfSection(sectionId: string): Promise<Result<StoredGrade[], CourseworkStoreError>>
  /** Publica en `at` las notas de la columna que tienen nota o ausente y todavía no estaban publicadas, con ese pase
      (`null` si la columna no se pasa al SIU). Devuelve las que se publicaron ahora. */
  publishColumn(
    column: ColumnKey,
    at: string,
    pass: GradePass | null
  ): Promise<Result<StoredGrade[], CourseworkStoreError>>
  /** Cambia el estado de pase de esas notas, sin tocar quién las pasa. Las que no tienen pase no se tocan. */
  setPassStatus(gradeIds: string[], status: PassStatus): Promise<Result<void, CourseworkStoreError>>
  /** Las notas que esperan pasar al SIU, en el orden en que se publicaron (a igual hora, en el que se cargaron). */
  pendingPasses(): Promise<Result<StoredGrade[], CourseworkStoreError>>
  /** Las notas publicadas de la persona, de todas sus comisiones, en el orden en que se cargaron. */
  publishedGradesOf(personId: PersonId): Promise<Result<StoredGrade[], CourseworkStoreError>>
  /** Cierra en `at` la entrega de la persona a la tarea (si ya estaba cerrada, no la toca). La entrega, o `null` si
      no entregó. */
  gradeSubmission(
    taskId: string,
    personId: PersonId,
    at: string
  ): Promise<Result<StoredSubmission | null, CourseworkStoreError>>
  /** La entrega con ese id, o `null`. */
  submissionById(submissionId: string): Promise<Result<StoredSubmission | null, CourseworkStoreError>>
  /** Las entregas de todos los alumnos a esa tarea. */
  submissionsOfTask(taskId: string): Promise<Result<StoredSubmission[], CourseworkStoreError>>
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
