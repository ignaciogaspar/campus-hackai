/* Puerto del SIU Guaraní. Copia la forma de la API REST v2 (research:
   docs/research/2026-11-10-siu-guarani-integracion.md): personas, comisiones,
   inscripciones a cursada y a examen, mesas, historia académica y condiciones
   de constancias. Inscribir y el cronograma de evaluaciones no existen en la
   API real: el adaptador declara si los soporta en sus capacidades.

   Todos los ids de personas son ids del SIU; Personas los mapea a personas de
   HackAI. Las fechas van en ISO 8601. */
import type { ExternalFailure, Result } from '@/lib/result'

export type SiuCapabilities = {
  /** Inscribir y dar de baja por API. La API real no lo permite. */
  canEnroll: boolean
  /** Expone el cronograma de evaluaciones (parciales y TP). La API real no. */
  hasAssessmentSchedule: boolean
  /** El SIU ya matricula en Moodle (su interfaz oficial está activa). */
  enrolsInClassroom: boolean
}

export type SiuRole = 'alumno' | 'profesor'

export type SiuSchool = { id: string; name: string }

export type SiuProgram = { id: string; name: string; status: 'activa' | 'pasiva' }

export type SiuPerson = {
  id: string
  surname: string
  names: string
  email: string
  role: SiuRole
  school: SiuSchool
  /** Propuestas del alumno. Un docente no tiene. */
  programs: SiuProgram[]
}

/** Período lectivo, con su ventana de inscripción a cursada. */
export type SiuTerm = {
  id: string
  name: string
  start: string
  end: string
  enrollmentStart: string
  enrollmentEnd: string
}

/** Materia («actividad» en el SIU). Se dicta en una o más facultades. */
export type SiuSubject = { id: string; code: string; name: string }

export type SiuSchedule = { day: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'; start: string; end: string }

/** Comisión: el dictado de una materia en un período lectivo y una facultad. */
export type SiuSection = {
  id: string
  name: string
  subjectId: string
  schoolId: string
  termId: string
  teacherIds: string[]
  schedule: SiuSchedule[]
  location: string
  modality: 'presencial' | 'virtual' | 'hibrida'
  instance: 'promocion' | 'regularidad'
  /** Cupo. `null` es «sin definir». */
  capacity: number | null
}

export type SiuEnrollmentStatus = 'aceptada' | 'pendiente' | 'rechazada' | 'baja'

export type SiuCourseEnrollment = {
  id: string
  transactionNumber: string
  personId: string
  sectionId: string
  date: string
  status: SiuEnrollmentStatus
}

/** Mesa de examen, con su ventana de inscripción. */
export type SiuExamBoard = {
  id: string
  subjectId: string
  schoolId: string
  examPeriod: string
  date: string
  location: string
  teacherIds: string[]
  capacity: number | null
  enrollmentStart: string
  enrollmentEnd: string
}

export type SiuExamEnrollment = {
  id: string
  transactionNumber: string
  personId: string
  examBoardId: string
  date: string
  status: SiuEnrollmentStatus
}

/** Evaluación del cronograma: parcial, recuperatorio o trabajo práctico. */
export type SiuAssessment = {
  id: string
  sectionId: string
  name: string
  kind: 'parcial' | 'recuperatorio' | 'tp'
  date: string
}

export type SiuHistoryResult = 'promocionado' | 'aprobado' | 'regular' | 'desaprobado' | 'ausente' | 'libre'

/** Renglón de la historia académica (el «datosanalitico» de la API). */
export type SiuHistoryEntry = {
  id: string
  personId: string
  subjectId: string
  type: 'cursada' | 'examen' | 'promocion' | 'equivalencia'
  date: string
  grade: number | null
  result: SiuHistoryResult
  gradeRecord: string
}

/** Nota cargada en un acta todavía abierta. */
export type SiuProvisionalResult = {
  id: string
  personId: string
  sectionId: string
  assessmentId: string
  grade: number | null
  date: string
}

export type SiuCertificateType = 'alumno-regular' | 'examen-final'

export type SiuTarget =
  | { kind: 'comision'; sectionId: string }
  | { kind: 'mesa'; examBoardId: string }

export type SiuReceipt = {
  transactionNumber: string
  date: string
  target: SiuTarget
}

export type SiuEnrollError = 'sin-cupo' | 'fuera-de-periodo' | 'ya-inscripto' | 'no-encontrado' | 'no-soportado' | ExternalFailure
export type SiuDropError = 'no-inscripto' | 'fuera-de-periodo' | 'no-encontrado' | 'no-soportado' | ExternalFailure
export type SiuReadError = 'no-encontrado' | ExternalFailure

/** Dónde mandar al alumno en la Autogestión del SIU. */
export type SiuSelfServiceTarget = SiuTarget | { kind: 'constancia'; type: SiuCertificateType }

export type SiuSectionFilter = { subjectId?: string; schoolId?: string; termId?: string }
export type SiuExamBoardFilter = { subjectId?: string; schoolId?: string }

export type SiuPort = {
  capabilities: SiuCapabilities

  person(personId: string): Promise<Result<SiuPerson, SiuReadError>>
  terms(): Promise<Result<SiuTerm[], ExternalFailure>>
  subject(subjectId: string): Promise<Result<SiuSubject, SiuReadError>>
  section(sectionId: string): Promise<Result<SiuSection, SiuReadError>>
  /** Oferta de comisiones, con la cantidad de inscriptos aceptados. */
  sections(filter: SiuSectionFilter): Promise<Result<(SiuSection & { enrolled: number })[], ExternalFailure>>
  /** Comisiones que dicta un docente. */
  teacherSections(personId: string): Promise<Result<SiuSection[], SiuReadError>>
  /** Inscripciones a cursada. Por defecto las vigentes; con `historic`, todas. */
  courseEnrollments(personId: string, options?: { historic?: boolean }): Promise<Result<SiuCourseEnrollment[], SiuReadError>>
  examBoards(filter: SiuExamBoardFilter): Promise<Result<(SiuExamBoard & { enrolled: number })[], ExternalFailure>>
  examEnrollments(personId: string, options?: { historic?: boolean }): Promise<Result<SiuExamEnrollment[], SiuReadError>>
  /** Cronograma de una comisión. Sin `hasAssessmentSchedule` devuelve `no-soportado`. */
  assessments(sectionId: string): Promise<Result<SiuAssessment[], SiuReadError | 'no-soportado'>>
  history(personId: string): Promise<Result<SiuHistoryEntry[], SiuReadError>>
  provisionalResults(personId: string): Promise<Result<SiuProvisionalResult[], SiuReadError>>
  meetsCertificateConditions(personId: string, type: SiuCertificateType): Promise<Result<boolean, SiuReadError>>

  /** Sin `canEnroll` devuelven `no-soportado`. */
  enroll(personId: string, target: SiuTarget): Promise<Result<SiuReceipt, SiuEnrollError>>
  drop(personId: string, target: SiuTarget): Promise<Result<SiuReceipt, SiuDropError>>

  selfServiceUrl(target: SiuSelfServiceTarget): string
}
