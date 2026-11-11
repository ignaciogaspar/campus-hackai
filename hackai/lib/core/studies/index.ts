/* Cursada (studies): todo lo que viene del SIU y de Moodle sobre la vida
   académica del alumno. Interfaz e invariantes en hackai/docs/ARQUITECTURA.md.

   - `enroll` es todo o nada: si el SIU inscribe y Moodle falla, deshace la del
     SIU antes de devolver `falla-externa`.
   - Matricula en Moodle solo si el SIU no lo hace (capacidad `enrolsInClassroom`).
   - Si el SIU no deja inscribir por API, devuelve `requiere-autogestion` con el
     enlace: es un paso más, no un error.
   - Las lecturas toleran caídas: devuelven lo último leído, marcado como
     desactualizado (`Fresh`).

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuCertificateType, SiuPort, SiuSchedule } from '@/lib/ports/siu'
import { notImplemented, type ExternalFailure, type NotImplemented, type Result } from '@/lib/result'

/** Una lectura con la hora en que se hizo. `stale` si el sistema de origen no
    respondió y es lo último que se leyó. */
export type Fresh<T> = { data: T; readAt: string; stale: boolean }

/** Una comisión (cursada) o una mesa (examen). */
export type Target =
  | { kind: 'comision'; sectionId: string }
  | { kind: 'mesa'; examBoardId: string }

/** Qué oferta se busca: comisiones para cursar o mesas para rendir una materia. */
export type OfferQuery = { kind: 'cursada' | 'examen'; subjectId: string }

export type CertificateType = SiuCertificateType

export type Teacher = { personId: PersonId | null; name: string }

/** Una materia de la persona, en una comisión y un período lectivo. */
export type MySubject = {
  subjectId: string
  code: string
  name: string
  schoolId: string
  termId: string
  termName: string
  sectionId: string
  sectionName: string
  role: Role
  /** Cursos de Moodle vinculados a la comisión. */
  classroomCourseIds: string[]
}

export type MySubjects = { current: MySubject[]; archived: MySubject[] }

export type MySection = {
  sectionId: string
  name: string
  subjectId: string
  schoolId: string
  termId: string
  role: Role
  teachers: Teacher[]
}

export type OfferItem = {
  target: Target
  subjectId: string
  subjectName: string
  name: string
  /** Comisión: horarios. Mesa: vacío. */
  schedule: SiuSchedule[]
  /** Mesa: fecha del examen. Comisión: `null`. */
  date: string | null
  location: string
  teachers: Teacher[]
  capacity: number | null
  enrolled: number
  enrollmentEnd: string
  alreadyEnrolled: boolean
}

export type Receipt = { transactionNumber: string; date: string; target: Target }

export type EnrollOutcome =
  | { kind: 'inscripto'; receipt: Receipt; classroomCourseIds: string[] }
  | { kind: 'requiere-autogestion'; url: string }

export type DropOutcome =
  | { kind: 'baja'; receipt: Receipt }
  | { kind: 'requiere-autogestion'; url: string }

export type EnrollError = 'sin-cupo' | 'fuera-de-periodo' | 'ya-inscripto' | 'objetivo-desconocido' | ExternalFailure
export type DropError = 'no-inscripto' | 'fuera-de-periodo' | 'objetivo-desconocido' | ExternalFailure

/** Parcial, final o, como complemento, una entrega con fecha de Moodle. */
export type UpcomingItem = {
  kind: 'parcial' | 'recuperatorio' | 'tp' | 'final' | 'entrega'
  source: 'siu' | 'moodle'
  subjectId: string
  subjectName: string
  name: string
  date: string
  past: boolean
}

export type OpenEnrollment = {
  kind: 'cursada' | 'examen'
  subjectId: string
  subjectName: string
  opensAt: string
  closesAt: string
}

/** Nota de un parcial, venga de la historia académica o de la actuación provisoria. */
export type AssessmentGrade = {
  subjectId: string
  subjectName: string
  assessmentName: string
  grade: number | null
  date: string
  source: 'historia' | 'actuacion-provisoria'
}

export type HistoryItem = {
  subjectId: string
  subjectName: string
  type: 'cursada' | 'examen' | 'promocion' | 'equivalencia'
  date: string
  grade: number | null
  result: 'promocionado' | 'aprobado' | 'regular' | 'desaprobado' | 'ausente' | 'libre'
}

export type AcademicRecord = {
  grades: AssessmentGrade[]
  history: HistoryItem[]
  average: number | null
}

export type CertificateStatus = { type: CertificateType; meetsConditions: boolean; url: string }

type ReadError = 'persona-desconocida' | ExternalFailure | NotImplemented

export type Studies = {
  /** Materias del período lectivo actual y archivadas. */
  subjectsOf(personId: PersonId): Promise<Result<Fresh<MySubjects>, ReadError>>
  /** Sus comisiones, como alumno o como docente. */
  sectionsOf(personId: PersonId): Promise<Result<Fresh<MySection[]>, ReadError>>
  /** Comisiones o mesas de examen con cupo, horario y docentes. */
  offer(personId: PersonId, query: OfferQuery): Promise<Result<OfferItem[], ReadError>>
  /** Inscribe en el SIU y matricula en Moodle, todo o nada. */
  enroll(personId: PersonId, target: Target): Promise<Result<EnrollOutcome, EnrollError | 'persona-desconocida' | NotImplemented>>
  /** Baja en el SIU y desmatriculación en Moodle. */
  drop(personId: PersonId, target: Target): Promise<Result<DropOutcome, DropError | 'persona-desconocida' | NotImplemented>>
  /** Parciales y finales de todas sus materias, ordenados por fecha, con los pasados marcados. */
  upcoming(personId: PersonId): Promise<Result<Fresh<UpcomingItem[]>, ReadError>>
  /** Inscripciones abiertas que le sirven. */
  openEnrollments(personId: PersonId): Promise<Result<Fresh<OpenEnrollment[]>, ReadError>>
  /** Notas de parciales unificadas e historia académica. */
  record(personId: PersonId): Promise<Result<Fresh<AcademicRecord>, ReadError>>
  /** Si cumple las condiciones de la constancia y el enlace a la Autogestión del SIU. */
  certificate(personId: PersonId, type: CertificateType): Promise<Result<CertificateStatus, ReadError>>
}

export type StudiesDeps = {
  people: People
  siu: SiuPort
  classroom: ClassroomPort
  clock: ClockPort
}

export function createStudies(_deps: StudiesDeps): Studies {
  return {
    subjectsOf: notImplemented,
    sectionsOf: notImplemented,
    offer: notImplemented,
    enroll: notImplemented,
    drop: notImplemented,
    upcoming: notImplemented,
    openEnrollments: notImplemented,
    record: notImplemented,
    certificate: notImplemented,
  }
}
