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
  // --- B: notas ---
  /** Cargar por API las notas de una evaluación y la de cursada. La API real no lo permite. */
  canWriteGrades: boolean
  // --- fin B: notas ---
}

/** El rol como lo informa el SIU. El de una persona de HackAI es `Role`, de
    Personas, que lo toma de acá al armar la persona. */
export type SiuRole = 'alumno' | 'profesor'

export type SiuSchool = { id: string; name: string }

export type SiuProgram = {
  id: string
  name: string
  status: 'activa' | 'pasiva'
  /** El avance del alumno en la propuesta, de 0 a 100, como lo calcula el SIU (Reportes > Promedio y porcentaje
      de avance). Solo lo da un SIU leído con la cuenta del alumno. */
  progressPercent?: number | null
  /** El avance por certificado (título, título intermedio u orientación), como lo lista el mismo reporte. Solo lo
      da un SIU leído con la cuenta del alumno. */
  certificates?: SiuCertificateProgress[]
}

/** Una fila de Reportes > Promedio y porcentaje de avance: un certificado de la propuesta, con su orientación si
    la tiene. Los nombres van como los escribe el SIU. */
export type SiuCertificateProgress = {
  name: string
  /** `null` si el certificado no es de una orientación. */
  orientation: string | null
  /** La orientación que eligió el alumno («Ori. Elegida»). */
  chosen: boolean
  /** De 0 a 100. `null` si el SIU no lo informa. */
  percent: number | null
  /** Materias aprobadas que cuentan para el certificado. */
  approved: number | null
}

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
  /** Ventana de inscripción a cursada. `null` es «el SIU no la informa»: entonces dice `enrollmentOpen`. */
  enrollmentStart: string | null
  enrollmentEnd: string | null
  /** Lo que dice el SIU hoy cuando no da las fechas: la inscripción está abierta o no. Sin esto, mandan las fechas. */
  enrollmentOpen?: boolean
}

/** Materia («actividad» en el SIU). Se dicta en una o más facultades. Las
    actividades de vida universitaria dan créditos y las optativas, horas (el
    SIU las llama créditos a las dos); las demás materias, `null`. */
export type SiuSubject = { id: string; code: string; name: string; credits: number | null }

export type SiuSchedule = {
  day: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'
  start: string
  end: string
}

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
  /** `null` si el SIU no la informa. */
  modality: 'presencial' | 'virtual' | 'hibrida' | null
  /** `null` si el SIU no la informa. */
  instance: 'promocion' | 'regularidad' | null
  /** Cupo. `null` es «sin definir». */
  capacity: number | null
  /** Propuestas para las que se abre la comisión. Vacío es «para todas las de la facultad». */
  programIds: string[]
  /** Observaciones de la comisión, como las carga la facultad. */
  notes: string | null
  /** Cuántas clases tiene la comisión en su período, si se puede saber (el SIU real: su calendario de
      asignaciones). Sirve para el máximo de faltas cuando el SIU no lo da. */
  classCount?: number | null
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
  /** Observaciones de la mesa, como las carga la facultad. */
  notes: string | null
}

export type SiuExamEnrollment = {
  id: string
  transactionNumber: string
  personId: string
  examBoardId: string
  date: string
  status: SiuEnrollmentStatus
}

/** Cómo cuenta una materia en el plan: obligatoria, optativa o actividad de vida universitaria. */
export type SiuPlanSubjectKind = 'obligatoria' | 'optativa' | 'vida-universitaria'

/** Una materia del plan de estudios, con el año de la carrera en que va.
    `year` es `null` si se puede hacer en cualquier año, como las de vida universitaria. */
export type SiuPlanSubject = { subjectId: string; year: number | null; kind: SiuPlanSubjectKind }

/** Plan de estudios vigente de una propuesta (/propuestas/{propuesta}/planes):
    cuántos años dura, sus materias y cuántas optativas y actividades de vida
    universitaria pide. */
export type SiuStudyPlan = {
  programId: string
  name: string
  years: number
  electivesRequired: number
  /** Las horas de optativas que pide la regla del plan, si el SIU las da. Sin ellas, el núcleo las cuenta por
      cantidad de optativas. */
  electiveHoursRequired?: number | null
  /** Los créditos de vida universitaria que pide el plan, si el SIU los da. Sin ellos, los de las reglas del núcleo. */
  universityLifeCreditsRequired?: number | null
  universityLifeRequired: number
  subjects: SiuPlanSubject[]
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

/** Renglón de la historia académica (el «datosanalitico» de la API). Además de
    cursadas, exámenes, promociones y equivalencias, trae las notas de
    evaluaciones (parciales, recuperatorios, TP) que el docente cargó en la
    historia y no en un acta abierta. Que el SIU de la Austral las muestre así es
    una hipótesis (docs/product/preguntas-abiertas.md). */
export type SiuHistoryEntry = {
  id: string
  personId: string
  subjectId: string
  type: 'cursada' | 'examen' | 'promocion' | 'equivalencia' | 'evaluacion'
  date: string
  grade: number | null
  result: SiuHistoryResult
  gradeRecord: string
  /** Comisión y evaluación del cronograma. Solo en los renglones `evaluacion`; en los demás, `null`. */
  sectionId: string | null
  assessmentId: string | null
  /** Cuándo se cargó la nota, si el SIU lo dice. Solo en los renglones `evaluacion`; en los demás, `null`. */
  loadedAt: string | null
}

/** Nota cargada en un acta todavía abierta. */
export type SiuProvisionalResult = {
  id: string
  personId: string
  sectionId: string
  assessmentId: string
  grade: number | null
  date: string
  /** Cuándo se cargó la nota, si el SIU lo dice; `date` es la fecha de la evaluación. */
  loadedAt: string | null
}

/** Falta a una clase, como la lista Reportes > Inasistencias: por comisión, con fecha y si está justificada. */
export type SiuAbsence = {
  id: string
  personId: string
  sectionId: string
  date: string
  justified: boolean
  /** Cuántas inasistencias vale esa clase («Cant. inasistencias» del SIU: puede ser 0,5 o 2). Sin dato, 1. */
  amount?: number
}

/** Máximo de inasistencias de una comisión. Que el SIU de la Austral lo dé es
    una hipótesis (docs/product/preguntas-abiertas.md): una comisión sin máximo
    no figura. */
export type SiuAbsenceLimit = { sectionId: string; max: number }

/** Las inasistencias del alumno y el máximo de las comisiones que lo tienen,
    entre las que cursa o cursó. */
export type SiuAbsences = { absences: SiuAbsence[]; limits: SiuAbsenceLimit[] }

export type SiuCertificateType = 'alumno-regular' | 'examen-final'

export type SiuTarget = { kind: 'comision'; sectionId: string } | { kind: 'mesa'; examBoardId: string }

export type SiuReceipt = {
  transactionNumber: string
  date: string
  target: SiuTarget
}

export type SiuEnrollError =
  | 'sin-cupo'
  | 'fuera-de-periodo'
  | 'ya-inscripto'
  | 'no-encontrado'
  | 'no-soportado'
  | ExternalFailure
export type SiuDropError = 'no-inscripto' | 'fuera-de-periodo' | 'no-encontrado' | 'no-soportado' | ExternalFailure
export type SiuReadError = 'no-encontrado' | ExternalFailure
// --- B: notas ---
/** Qué se cargó en el SIU: la nota de la evaluación o la de cursada, y cuándo. */
export type SiuGradeReceipt = { date: string }
/** Sin `canWriteGrades`, `no-soportado`. Una nota fuera de 1 a 10 es `nota-invalida`. */
export type SiuWriteGradeError = 'no-soportado' | 'no-encontrado' | 'nota-invalida' | ExternalFailure
// --- fin B: notas ---

/** Dónde mandar al alumno en la Autogestión del SIU. */
export type SiuSelfServiceTarget = SiuTarget | { kind: 'constancia'; type: SiuCertificateType }

/** Una solicitud de constancia o certificado, como la lista Trámites > Solicitudes. Los textos van como los
    escribe el SIU («Impreso», «Online», «Autogestión»). */
export type SiuCertificateRequest = {
  id: string
  type: string
  requestedAt: string | null
  presentTo: string
  requestedIn: string
  copies: number | null
  status: string
  expiresAt: string | null
  /** Dónde verla o descargarla en la Autogestión, si el SIU da un enlace. */
  url: string | null
}

export type SiuNewCertificateRequest = {
  type: SiuCertificateType
  copies: number
  presentTo: string
  notes: string
}

/** Lo que respondió el SIU a una solicitud: si la aceptó y su mensaje, tal cual. */
export type SiuRequestOutcome = { accepted: boolean; message: string }

/** Un documento oficial del SIU para descargar, como lo genera la Autogestión. */
export type SiuOfficialDocumentKind = 'historia' | 'plan'
export type SiuOfficialDocument = { body: ArrayBuffer; contentType: string; filename: string }

export type SiuSectionFilter = { subjectId?: string; schoolId?: string; termId?: string }
export type SiuExamBoardFilter = { subjectId?: string; schoolId?: string }

export type SiuPort = {
  capabilities: SiuCapabilities

  person(personId: string): Promise<Result<SiuPerson, SiuReadError>>
  /** Los períodos lectivos. `personId`: para quién se piden; un SIU con cuentas propias de cada alumno suma los
      de esa cuenta, y nunca los de otra. */
  terms(personId?: string): Promise<Result<SiuTerm[], ExternalFailure>>
  subject(subjectId: string): Promise<Result<SiuSubject, SiuReadError>>
  /** Devuelve las materias encontradas, sin repetir ids. */
  subjects(ids: string[]): Promise<Result<SiuSubject[], ExternalFailure>>
  section(sectionId: string): Promise<Result<SiuSection, SiuReadError>>
  /** Oferta de comisiones, con la cantidad de inscriptos aceptados. */
  sections(filter: SiuSectionFilter): Promise<Result<(SiuSection & { enrolled: number })[], ExternalFailure>>
  /** Comisiones que dicta un docente. */
  teacherSections(personId: string): Promise<Result<SiuSection[], SiuReadError>>
  /** Inscripciones a cursada. Por defecto las vigentes; con `historic`, todas. */
  courseEnrollments(
    personId: string,
    options?: { historic?: boolean }
  ): Promise<Result<SiuCourseEnrollment[], SiuReadError>>
  // --- B: seguimiento ---
  /** Inscripciones aceptadas o pendientes a una comisión, de cualquier alumno (el SIU real: `/inscripciones?comision=`). */
  sectionEnrollments(sectionId: string): Promise<Result<SiuCourseEnrollment[], SiuReadError>>
  // --- fin B: seguimiento ---
  examBoards(filter: SiuExamBoardFilter): Promise<Result<(SiuExamBoard & { enrolled: number })[], ExternalFailure>>
  examEnrollments(
    personId: string,
    options?: { historic?: boolean }
  ): Promise<Result<SiuExamEnrollment[], SiuReadError>>
  /** Cronograma de una comisión. Sin `hasAssessmentSchedule` devuelve `no-soportado`. */
  assessments(sectionId: string): Promise<Result<SiuAssessment[], SiuReadError | 'no-soportado'>>
  history(personId: string): Promise<Result<SiuHistoryEntry[], SiuReadError>>
  /** Plan de estudios vigente de una propuesta. */
  studyPlan(programId: string): Promise<Result<SiuStudyPlan, SiuReadError>>
  provisionalResults(personId: string): Promise<Result<SiuProvisionalResult[], SiuReadError>>
  /** Inasistencias del alumno (Reportes > Inasistencias) y el máximo de cada comisión, si lo hay. */
  absences(personId: string): Promise<Result<SiuAbsences, SiuReadError>>
  meetsCertificateConditions(personId: string, type: SiuCertificateType): Promise<Result<boolean, SiuReadError>>

  // --- B: notas ---
  /** Carga la nota de un alumno en una evaluación del cronograma de su comisión (`null` es ausente). Es idempotente
      por alumno y evaluación: cargarla de nuevo la reemplaza y no deja dos. Se lee de vuelta con
      `provisionalResults`. */
  writeAssessmentGrade(
    personId: string,
    sectionId: string,
    assessmentId: string,
    grade: number | null
  ): Promise<Result<SiuGradeReceipt, SiuWriteGradeError>>
  /** Carga la nota de cursada de un alumno en una comisión. Es idempotente por alumno y comisión. Se lee de vuelta
      con `history`, como un renglón `cursada`; con `promoted`, con resultado `promocionado`. */
  writeCourseGrade(
    personId: string,
    sectionId: string,
    grade: number,
    promoted?: boolean
  ): Promise<Result<SiuGradeReceipt, SiuWriteGradeError>>
  // --- fin B: notas ---

  /** Sin `canEnroll` devuelven `no-soportado`. */
  enroll(personId: string, target: SiuTarget): Promise<Result<SiuReceipt, SiuEnrollError>>
  drop(personId: string, target: SiuTarget): Promise<Result<SiuReceipt, SiuDropError>>

  /** `personId`: de quién es, cuando el destino depende de la persona (por ejemplo, la cuenta real). */
  selfServiceUrl(target: SiuSelfServiceTarget, personId?: string): string

  /** Trámites de la Autogestión. Solo los tiene un SIU leído con la cuenta del alumno: sin ellos, Trámites muestra
      lo de la demo. */
  certificateRequests?(personId: string): Promise<Result<SiuCertificateRequest[], SiuReadError | 'no-soportado'>>
  /** Pide una constancia. `no-soportado` si este SIU no puede pedirla por API (se pide en la Autogestión). */
  requestCertificate?(
    personId: string,
    request: SiuNewCertificateRequest
  ): Promise<Result<SiuRequestOutcome, 'no-soportado' | ExternalFailure>>
  officialDocument?(
    personId: string,
    kind: SiuOfficialDocumentKind
  ): Promise<Result<SiuOfficialDocument, SiuReadError | 'no-soportado'>>
}
