/* Cursada (studies): todo lo que viene del SIU y de Moodle sobre la vida
   académica del alumno. Interfaz e invariantes en hackai/docs/ARQUITECTURA.md.

   - `enroll` es todo o nada: si el SIU inscribe y Moodle falla, deshace la del
     SIU antes de devolver `falla-externa`.
   - Matricula en Moodle solo si el SIU no lo hace (capacidad `enrolsInClassroom`).
   - Una sola comisión vigente por materia: con una inscripción aceptada o
     pendiente a una comisión de un período que no terminó, inscribirse a otra
     de la misma materia devuelve `ya-inscripto`.
   - La baja es el camino inverso: desmatricula y después da de baja en el SIU;
     si el SIU la rechaza, vuelve a matricular.
   - Inscribirse y darse de baja es de alumnos: un docente recibe
     `solo-alumnos` sin que se toque el SIU ni el aula.
   - Si el SIU no deja inscribir por API, devuelve `requiere-autogestion` con el
     enlace: es un paso más, no un error.
   - Las lecturas toleran caídas: devuelven lo último leído, marcado como
     desactualizado (`Fresh`). La oferta y las constancias también; la ventana
     de inscripción de la oferta se mira con el reloj de ahora.
   - Las materias no llevan faltas: la tarjeta de la materia no las muestra.
     `absencesOf` da, por materia actual del alumno, el detalle de sus
     inasistencias (por ahora solo del SIU; #108 suma las de HackAI). Un docente
     recibe una lista vacía. Si el SIU no responde, devuelve lo último leído.
   - Con Moodle caído y el SIU arriba, las materias salen al día del SIU, sin
     enlaces al aula ni tareas, y con `classroomUnavailable`.

   - Materias y comisiones: un alumno ve las de sus inscripciones aceptadas o
     pendientes, y nunca las de otra facultad; un docente, las que dicta. Son
     actuales las de un período lectivo que no terminó (el que está en curso y
     los que ya tienen inscriptos, como el de verano) y archivadas las de
     períodos que ya terminaron.
   - Cada materia lleva el enlace a su aula de Moodle y, si es actual, sus tareas
     con fecha por orden de fecha (las sin fecha no se muestran). Si el aula
     declara que no tiene tareas, salen vacías sin error.

   - Próximos (`upcoming`): parciales, recuperatorios y TP del cronograma de sus
     materias actuales y los finales de las mesas de su facultad a las que está
     inscripto (el docente: las que integra), desde que empezó su período
     lectivo actual, todo por fecha y con los pasados marcados según el reloj.
     Cada final lleva su turno de examen y, si el SIU lo da, dónde se rinde. Salen solo del SIU, así que una caída
     de Moodle no los toca: las tareas con fecha vienen con `subjectsOf` y las
     suma Hoy. Sin cronograma en el SIU (la API real) salen solo los finales.
   - Oferta (`offer`): comisiones o mesas con cupo, horario y docentes, y si
     su inscripción todavía no abrió, está abierta o ya cerró según el reloj.
     Una mesa dice si para rendir le falta regularizar la cursada (no la tiene
     regular ni aprobada); no lo bloquea.
   - Inscripciones abiertas (`openEnrollments`), las que cierran antes primero,
     una por materia. Qué le sirve al alumno es una hipótesis, sin confirmar
     con el equipo (docs/product/preguntas-abiertas.md, pregunta 16):
     - cursada: comisiones de su facultad con la inscripción del período
       abierta, de materias que no cursa en ninguna facultad (una sola
       comisión vigente por materia, como en `enroll`), no tiene regulares ni
       aprobó;
     - examen: mesas de su facultad con la inscripción abierta, de materias
       que no aprobó y tiene regulares o está cursando (puede regularizar
       antes de la mesa, y entonces se marca `needsRegularity`), si no está
       inscripto ya a una mesa de esa materia.
     Una cursada de una actividad que da créditos sale como `actividad`, con sus
     créditos. Salen tengan o no cupo, con los lugares que quedan entre todas las
     comisiones (o mesas) abiertas de la materia, sin tope si alguna no lo
     tiene, y los días que faltan para que cierre, contados con el reloj de
     cada llamada aunque sea lo último que se leyó.
     Se muestran aunque el SIU no deje inscribir por API: se completan en la
     Autogestión. Un docente no tiene.
   - Notas: las de parciales, recuperatorios y TP salen juntas, vengan de la
     historia (renglones `evaluacion`) o de actuación provisoria, cada una con
     su origen y la más reciente primero. Sin cronograma en el SIU (la API
     real), salen igual con el nombre «Evaluación».
   - Finales pendientes (`pendingFinals`): materias que tiene regulares y no
     aprobó (un final desaprobado sigue pendiente), con la próxima mesa de su
     facultad: aquella en la que está inscripto o, si no, la primera cuya
     inscripción todavía no cerró. Un docente no tiene.
   - Historia: solo las materias aprobadas (promoción, final o equivalencia) y
     su promedio. Las cursadas regulares y las evaluaciones no entran.
   - Comisiones por carrera: una comisión puede abrirse solo para algunas
     propuestas. Un alumno puede inscribirse a las de sus propuestas activas y
     a las abiertas a todas, y solo esas salen en sus inscripciones abiertas.
     La oferta trae todas las de la facultad y marca las de otra carrera
     (`otherProgram`), porque Espacios la usa para el material de la materia.
   - Carrera (`career`): cada materia de su plan de estudios, y las que cursó
     fuera de él, con su estado, sus notas y el final al que está inscripto, y
     el avance de la carrera. Las reglas están en career.ts. El plan es el de
     su primera propuesta activa: una pasiva, como la de aspirante, no cuenta.
   - Constancias: si cumple las condiciones lo dice el SIU. Si no cumple,
     Cursada deduce el motivo con lo que la API real también da (propuesta
     activa, inscripción vigente, finales rendidos); si no lo encuentra, no
     inventa uno.

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import { type AbsenceRecord, absencesFrom, type MyAbsencesDetail, maxAbsences } from '@/lib/core/studies/absences'
import {
  type Approved as ApprovedInCareer,
  buildCareer,
  type Career,
  EMPTY_CAREER,
  type LoadedGrade,
  type TakenSection
} from '@/lib/core/studies/career'
import { requirementsOf } from '@/lib/core/studies/requirements'
import {
  createSectionStudents,
  type SectionStudent,
  type SectionStudentsError
} from '@/lib/core/studies/section-students'
import { daysBetween } from '@/lib/dates'
import type { Fresh } from '@/lib/fresh'
import type { ClassroomAssignment, ClassroomCourse, ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type {
  SiuAssessment,
  SiuCertificateRequest,
  SiuCertificateType,
  SiuCourseEnrollment,
  SiuEnrollmentStatus,
  SiuExamBoard,
  SiuExamEnrollment,
  SiuHistoryEntry,
  SiuNewCertificateRequest,
  SiuOfficialDocument,
  SiuOfficialDocumentKind,
  SiuPerson,
  SiuPort,
  SiuProvisionalResult,
  SiuReadError,
  SiuRequestOutcome,
  SiuSchedule,
  SiuSection,
  SiuStudyPlan,
  SiuSubject,
  SiuTerm
} from '@/lib/ports/siu'
import { all, type ExternalFailure, fail, type NotImplemented, ok, type Result } from '@/lib/result'

export type {
  AbsenceRecord,
  AbsenceSource,
  AbsenceWarning,
  MyAbsences,
  MyAbsencesDetail,
  SubjectAbsences
} from '@/lib/core/studies/absences'
export type {
  Career,
  CareerProgress,
  PlanKind,
  SubjectAssessment,
  SubjectStanding,
  SubjectStatus
} from '@/lib/core/studies/career'

/** Una lectura con la hora en que se hizo. `stale` si el sistema de origen no
    respondió y es lo último que se leyó. */
export type { Fresh, SectionStudent, SectionStudentsError }

/** Una comisión (cursada) o una mesa (examen). */
export type Target = { kind: 'comision'; sectionId: string } | { kind: 'mesa'; examBoardId: string }

/** Qué oferta se busca: comisiones para cursar o mesas para rendir una materia. */
export type OfferQuery = { kind: 'cursada' | 'examen'; subjectId: string }

export type CertificateType = SiuCertificateType

export type Teacher = { personId: PersonId | null; name: string }

/** Aula de la materia en el Campus Virtual: el curso de Moodle y el enlace para entrar. */
export type MyClassroom = { courseId: string; name: string; url: string }

/** Tarea con fecha límite de un curso de Moodle. `past` si la fecha ya pasó según el reloj. */
export type MyAssignment = { id: string; name: string; dueDate: string; source: 'moodle'; past: boolean }

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
  /** Inicio y fin del período lectivo: entre esas fechas hay clases. */
  termStart: string
  termEnd: string
  /** Días y horarios de clase de la comisión. */
  schedule: SiuSchedule[]
  location: string
  modality: SiuSection['modality']
  role: Role
  /** Cursos de Moodle vinculados a la comisión, con el enlace a cada aula. */
  classrooms: MyClassroom[]
  /** Tareas con fecha de esos cursos, por fecha. Solo las de materias actuales; las archivadas, vacío. */
  assignments: MyAssignment[]
}

export type MySubjects = {
  current: MySubject[]
  archived: MySubject[]
  /** Moodle no respondió: las materias salen del SIU, sin enlaces al aula ni tareas. */
  classroomUnavailable: boolean
}

export type MySection = {
  sectionId: string
  name: string
  subjectId: string
  subjectCode: string
  subjectName: string
  schoolId: string
  termId: string
  termName: string
  /** De un período lectivo que no terminó; si no, archivada. */
  current: boolean
  role: Role
  teachers: Teacher[]
}

/** La ventana de inscripción de una comisión o una mesa según el reloj: todavía no abrió, está abierta o ya cerró. */
export type EnrollmentWindow = 'no-abrio' | 'abierta' | 'cerrada'

export type OfferItem = {
  target: Target
  subjectId: string
  subjectName: string
  name: string
  /** Comisión: el período lectivo. Mesa: el turno de examen. */
  period: string
  /** Comisión: horarios. Mesa: vacío. */
  schedule: SiuSchedule[]
  /** Mesa: fecha del examen. Comisión: `null`. */
  date: string | null
  location: string
  /** Comisión: presencial, virtual o híbrida. Mesa: `null`. */
  modality: SiuSection['modality'] | null
  /** Comisión: si se puede promocionar o se aprueba con final. Mesa: `null`. */
  instance: SiuSection['instance'] | null
  /** Comisión: inicio y fin de la cursada (el período lectivo). Mesa: `null`. */
  start: string | null
  end: string | null
  /** Observaciones de la comisión o la mesa. */
  notes: string | null
  teachers: Teacher[]
  /** Cupo. `null` es «sin definir»: no se llena. */
  capacity: number | null
  enrolled: number
  /** Lugares que quedan. `0` es sin cupo; `null`, sin tope. */
  spotsLeft: number | null
  /** `null` si el SIU no informa la fecha. */
  enrollmentStart: string | null
  enrollmentEnd: string | null
  /** Si la inscripción todavía no abrió, está abierta o ya cerró, según el reloj (o lo que dice el SIU hoy). */
  enrollmentWindow: EnrollmentWindow
  alreadyEnrolled: boolean
  /** Comisión: el nombre de otra comisión de la materia en la que ya está
      inscripto, que le impide inscribirse en esta. Mesa: `null`. */
  enrolledElsewhere: string | null
  /** Mesa: no tiene la materia regular (ni aprobada), así que para rendir el
      final antes tiene que regularizar la cursada. Comisión: `false`. */
  needsRegularity: boolean
  /** Comisión: se abre solo para otras carreras, así que no se puede inscribir.
      Inscripciones no la muestra; Espacios igual la usa para juntar el material
      de toda la materia. Mesa: `false`. */
  otherProgram: boolean
}

export type Receipt = { transactionNumber: string; date: string; target: Target }

export type EnrollOutcome =
  | { kind: 'inscripto'; receipt: Receipt; classroomCourseIds: string[] }
  | { kind: 'requiere-autogestion'; url: string }

export type DropOutcome = { kind: 'baja'; receipt: Receipt } | { kind: 'requiere-autogestion'; url: string }

/** Errores de inscribir o dar de baja que no son del SIU:
    - `sin-cuenta-del-aula`: la persona no tiene usuario de Moodle, así que no
      se la puede matricular ni desmatricular. Reintentar no sirve.
    - `a-medias`: un paso falló y el que lo deshacía también. El SIU quedó
      distinto del aula y alguien tiene que mirarlo. */
export type TwoSystemsError = 'sin-cuenta-del-aula' | 'a-medias'

/** Inscribirse y darse de baja es de alumnos: un docente no tiene cursadas ni finales propios. */
export type StudentsOnly = 'solo-alumnos'

export type EnrollError =
  | 'sin-cupo'
  | 'fuera-de-periodo'
  | 'ya-inscripto'
  | 'objetivo-desconocido'
  | StudentsOnly
  | TwoSystemsError
  | ExternalFailure
export type DropError =
  | 'no-inscripto'
  | 'fuera-de-periodo'
  | 'objetivo-desconocido'
  | StudentsOnly
  | TwoSystemsError
  | ExternalFailure

/** Parcial o final del SIU, o, como complemento, una entrega con fecha de Moodle (esas las suma Hoy). */
export type UpcomingItem = {
  /** Único entre los próximos: el tipo de origen y su id (`evaluacion:…`, `mesa:…`, `tarea:…`). */
  id: string
  kind: 'parcial' | 'recuperatorio' | 'tp' | 'final' | 'entrega'
  source: 'siu' | 'moodle'
  subjectId: string
  /** La sigla de la materia, para el calendario. */
  subjectCode: string
  subjectName: string
  name: string
  date: string
  past: boolean
  /** Final: el turno de examen. El resto, `null`. */
  examPeriod: string | null
  /** Dónde se rinde, si el SIU lo da (hoy, solo en las mesas). Si no, `null`. */
  location: string | null
  /** Si la persona tiene (o tuvo) una comisión de la materia, y por eso su espacio. Un final de una
      materia que rinde libre o que nunca cursó en HackAI, no. */
  hasSection: boolean
}

/** El orden de los próximos: por fecha; el mismo día, por materia y por nombre. Lo usa también Hoy al sumarles las entregas. */
export const compareUpcoming = (a: UpcomingItem, b: UpcomingItem) =>
  a.date.localeCompare(b.date) || a.subjectName.localeCompare(b.subjectName, 'es') || a.name.localeCompare(b.name, 'es')

export type OpenEnrollment = {
  /** `actividad`: la cursada de una actividad que da créditos. Se inscribe igual que una cursada. */
  kind: 'cursada' | 'actividad' | 'examen'
  subjectId: string
  subjectName: string
  /** `null` si el SIU no informa cuándo abre o cierra. */
  opensAt: string | null
  closesAt: string | null
  /** Días de calendario en Buenos Aires que faltan para que cierre, según el reloj de cada llamada: `0` si cierra hoy.
      `null` si no se sabe cuándo cierra. */
  closesInDays: number | null
  /** Lugares que quedan entre todas las comisiones (o mesas) de la materia con la
      inscripción abierta: `0` si están todas llenas, `null` si alguna no tiene tope. */
  spotsLeft: number | null
  /** Examen de una materia que está cursando y todavía no tiene regular: necesita regularizarla antes de la mesa. */
  needsRegularity: boolean
  /** Créditos que da una actividad; en una cursada o un examen, `null`. */
  credits: number | null
}

/** Cómo está la inscripción a la próxima mesa de un final pendiente. */
export type PendingFinalStatus = 'inscripto' | 'abierta' | 'sin-cupo' | 'no-abrio'

/** Materia regular sin aprobar, con su próxima mesa (`null` si no hay ninguna a la que se pueda anotar). */
export type PendingFinal = {
  subjectId: string
  subjectName: string
  /** Fecha de la cursada regular más reciente. */
  regularSince: string
  next: {
    examBoardId: string
    examPeriod: string
    date: string
    location: string
    enrollmentStart: string
    enrollmentEnd: string
    status: PendingFinalStatus
  } | null
}

/** Nota de un parcial, venga de la historia académica o de la actuación provisoria. */
export type AssessmentGrade = {
  /** `null` si el SIU no dice de qué materia es (una comisión que ya no encuentra). */
  subjectId: string | null
  subjectName: string
  assessmentName: string
  grade: number | null
  /** Fecha de la evaluación. */
  date: string
  /** Cuándo se cargó la nota, si el SIU lo dice; si no, `null`. */
  loadedAt: string | null
  source: 'historia' | 'actuacion-provisoria'
}

/** Cómo se aprobó una materia: promoción, final o equivalencia. */
export type Approval = 'promocion' | 'examen' | 'equivalencia'

/** Materia aprobada de la historia académica. */
export type HistoryItem = {
  subjectId: string
  subjectName: string
  date: string
  grade: number | null
  approval: Approval
}

export type AcademicRecord = {
  /** Notas de parciales, recuperatorios y TP, la más reciente primero. */
  grades: AssessmentGrade[]
  /** Materias aprobadas, la más reciente primero. */
  history: HistoryItem[]
  /** Promedio de las materias aprobadas con nota, a dos decimales. */
  average: number | null
}

/** Por qué no cumple las condiciones de una constancia, según lo que Cursada
    puede deducir del SIU. La API real solo dice si cumple, sin el motivo. */
export type CertificateReason = 'sin-propuesta-activa' | 'sin-inscripcion-vigente' | 'sin-examenes-rendidos'

/** Si cumple las condiciones de una constancia y dónde pedirla en la
    Autogestión del SIU. `reasons` vacío cuando cumple, o cuando no cumple y
    Cursada no sabe por qué. */
export type CertificateStatus = {
  type: CertificateType
  meetsConditions: boolean
  reasons: CertificateReason[]
  url: string
}

/** Por qué una lectura de Cursada no pudo responder. */
export type StudiesReadError = 'persona-desconocida' | ExternalFailure | NotImplemented
type ReadError = StudiesReadError

export type Studies = {
  /** Materias del período lectivo actual y archivadas. */
  subjectsOf(personId: PersonId): Promise<Result<Fresh<MySubjects>, ReadError>>
  /** Las inasistencias del alumno por materia actual, con cada falta. Un docente recibe una lista vacía. */
  absencesOf(personId: PersonId): Promise<Result<Fresh<MyAbsencesDetail>, ReadError>>
  /** Sus comisiones, como alumno o como docente. */
  sectionsOf(personId: PersonId): Promise<Result<Fresh<MySection[]>, ReadError>>
  /** Los alumnos de una comisión (legajo, nombre y mail), solo para un docente de esa comisión: un alumno o un docente
      de otra recibe `sin-acceso`. */
  sectionStudents(
    personId: PersonId,
    sectionId: string
  ): Promise<Result<Fresh<SectionStudent[]>, ReadError | SectionStudentsError>>
  /** Comisiones o mesas de examen con cupo, horario y docentes. */
  offer(personId: PersonId, query: OfferQuery): Promise<Result<Fresh<OfferItem[]>, ReadError>>
  /** Inscribe en el SIU y matricula en Moodle, todo o nada. */
  enroll(
    personId: PersonId,
    target: Target
  ): Promise<Result<EnrollOutcome, EnrollError | 'persona-desconocida' | NotImplemented>>
  /** Baja en el SIU y desmatriculación en Moodle. */
  drop(
    personId: PersonId,
    target: Target
  ): Promise<Result<DropOutcome, DropError | 'persona-desconocida' | NotImplemented>>
  /** Parciales y finales de todas sus materias, ordenados por fecha, con los pasados marcados. */
  upcoming(personId: PersonId): Promise<Result<Fresh<UpcomingItem[]>, ReadError>>
  /** Inscripciones abiertas que le sirven. */
  openEnrollments(personId: PersonId): Promise<Result<Fresh<OpenEnrollment[]>, ReadError>>
  /** Materias regulares sin aprobar, con la próxima mesa y el estado de su inscripción. */
  pendingFinals(personId: PersonId): Promise<Result<Fresh<PendingFinal[]>, ReadError>>
  /** Notas de parciales unificadas e historia académica. */
  record(personId: PersonId): Promise<Result<Fresh<AcademicRecord>, ReadError>>
  /** Notas de evaluaciones (parciales, recuperatorios y TP, como en `record`) con número, cargadas en los
      últimos 7 días y después de `seenAt` (cuando vio sus notas por última vez, o `null`), la más nueva
      primero. Sin fecha de carga, cuenta la de la evaluación. Con el SIU caído, salen de lo último leído de
      `record`, marcadas como desactualizadas. */
  newGrades(personId: PersonId, seenAt: string | null): Promise<Result<Fresh<AssessmentGrade[]>, ReadError>>
  /** Si cumple las condiciones de la constancia y el enlace a la Autogestión del SIU. */
  certificate(personId: PersonId, type: CertificateType): Promise<Result<Fresh<CertificateStatus>, ReadError>>
  /** Su plan de estudios con el estado y las notas de cada materia, y el avance de la carrera. */
  career(personId: PersonId): Promise<Result<Fresh<Career>, ReadError>>
  /** Sus solicitudes de constancias en la Autogestión. `no-soportado` si el SIU no las da por API: entonces
      Trámites muestra lo de la demo. */
  certificateRequests(personId: PersonId): Promise<Result<SiuCertificateRequest[], ReadError | 'no-soportado'>>
  /** Pide una constancia en el SIU. `no-soportado` si se pide en la Autogestión. */
  requestCertificate(
    personId: PersonId,
    request: SiuNewCertificateRequest
  ): Promise<Result<SiuRequestOutcome, ReadError | 'no-soportado'>>
  /** Un documento oficial (historia académica, plan de estudios) como lo genera el SIU. */
  officialDocument(
    personId: PersonId,
    kind: SiuOfficialDocumentKind
  ): Promise<Result<SiuOfficialDocument, ReadError | 'no-soportado'>>
}

export type StudiesDeps = {
  people: People
  siu: SiuPort
  classroom: ClassroomPort
  clock: ClockPort
}

/** La persona en el SIU con el id que le da Personas: su id, su facultad y sus datos (rol incluido). */
type SiuPersonRef = { siuId: string; schoolId: string; person: SiuPerson }

/** Lo que hace falta del aula para inscribir o dar de baja. Sin `moodleId`,
    HackAI no toca el aula (el SIU matricula solo, o es una mesa). */
type ClassroomPlan = { courseIds: string[]; moodleId: string | null }

/** Una comisión de la persona con su materia y su período lectivo. */
type SectionInTerm = { section: SiuSection; subject: SiuSubject; term: SiuTerm; current: boolean }

type MySectionsInTerms = { role: Role; sections: SectionInTerm[] }

/** Las mesas de su facultad, con cuántos inscriptos tienen, y los ids de aquellas en las que la persona tiene una inscripción vigente. */
type ExamBoardsOf = { boards: (SiuExamBoard & { enrolled: number })[]; enrolledIn: Set<string> }

const isActive = (status: SiuEnrollmentStatus) => status === 'aceptada' || status === 'pendiente'

/** Las propuestas activas de la persona. */
const activePrograms = (person: SiuPerson) => person.programs.filter((p) => p.status === 'activa')

/** Si la comisión es para alguna de sus carreras: abierta a todas o a una de sus propuestas activas. */
function isForPrograms(section: Pick<SiuSection, 'programIds'>, person: SiuPerson): boolean {
  if (!section.programIds.length) return true
  return activePrograms(person).some((p) => section.programIds.includes(p.id))
}

const unique = (values: string[]) => [...new Set(values)]

/** Los campos de la materia que lleva cada próximo. */
const subjectRef = (subject: SiuSubject) => ({
  subjectId: subject.id,
  subjectCode: subject.code,
  subjectName: subject.name
})

/** Cómo viene el alumno en cada materia, por id: la está cursando (o ya se
    inscribió en un período que no terminó), la tiene regular o la aprobó. */
type SubjectProgress = { taking: Set<string>; regular: Set<string>; approved: Set<string> }

/** Una inscripción abierta antes de ponerle el nombre a la materia y contar los días que faltan para que cierre. */
type Opening = Omit<OpenEnrollment, 'subjectName' | 'closesInDays' | 'credits'>

/** Una inscripción abierta tal como se lee del SIU: los días para el cierre se cuentan al devolverla. */
type NamedOpening = Omit<OpenEnrollment, 'closesInDays'>

const isRegular = (h: SiuHistoryEntry) => h.type === 'cursada' && h.result === 'regular'

const isApproved = (h: SiuHistoryEntry) => approvalOf(h) !== null

/** En qué momento de la ventana está la inscripción. Si el SIU no da las fechas, manda lo que dice hoy (`open`);
    sin fechas ni eso, cerrada. */
function windowAt(at: string, start: string | null, end: string | null, open?: boolean): EnrollmentWindow {
  if (open !== undefined) return open ? 'abierta' : 'cerrada'
  if (start === null || end === null) return 'cerrada'
  if (at < start) return 'no-abrio'
  return at <= end ? 'abierta' : 'cerrada'
}

const isOpenAt = (at: string, start: string | null, end: string | null, open?: boolean) =>
  windowAt(at, start, end, open) === 'abierta'

/** Le sirve cursarla si no la está cursando, no la tiene regular y no la aprobó. */
const needsCourseAttempt = (subjectId: string, p: SubjectProgress) =>
  !p.taking.has(subjectId) && !p.regular.has(subjectId) && !p.approved.has(subjectId)

/** Para rendirla le falta la regularidad: no la tiene regular ni la aprobó. */
const needsRegularity = (subjectId: string, p: SubjectProgress) =>
  !p.regular.has(subjectId) && !p.approved.has(subjectId)

/** Le sirve rendirla si no la aprobó y la tiene regular o la está cursando (puede regularizarla antes de la mesa). */
const needsExam = (subjectId: string, p: SubjectProgress) =>
  !p.approved.has(subjectId) && (p.regular.has(subjectId) || p.taking.has(subjectId))

/** Lugares que quedan con un cupo y sus inscriptos: `null` es sin tope. */
const spotsLeft = (capacity: number | null, enrolled: number) =>
  capacity === null ? null : Math.max(capacity - enrolled, 0)

/** Los lugares de dos comisiones o mesas juntas: sin tope si alguna no lo tiene. */
const addSpots = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b)

/** La que cierra antes primero; el mismo día, por materia. */
const byClosing = (a: NamedOpening, b: NamedOpening) =>
  // Las que no dicen cuándo cierran, al final.
  (a.closesAt ?? '~').localeCompare(b.closesAt ?? '~') ||
  a.subjectName.localeCompare(b.subjectName, 'es') ||
  a.kind.localeCompare(b.kind)

/** Una por materia y tipo: la que cierra antes, con los lugares de todas. Espera la lista ya ordenada. */
function onePerSubject(items: NamedOpening[]): NamedOpening[] {
  const bySubject = new Map<string, NamedOpening>()
  for (const item of items) {
    const key = `${item.kind}:${item.subjectId}`
    const kept = bySubject.get(key)
    if (kept) kept.spotsLeft = addSpots(kept.spotsLeft, item.spotsLeft)
    else bySubject.set(key, { ...item })
  }
  return [...bySubject.values()]
}

/** La mesa en la que está inscripto o, si no, la primera cuya inscripción no cerró, entre las que no se tomaron. */
function nextBoardFor(subjectId: string, { boards, enrolledIn }: ExamBoardsOf, at: string): PendingFinal['next'] {
  const upcoming = boards
    .filter((b) => b.subjectId === subjectId && b.date >= at)
    .sort((a, b) => a.date.localeCompare(b.date))
  const enrolled = upcoming.find((b) => enrolledIn.has(b.id))
  const board = enrolled ?? upcoming.find((b) => at <= b.enrollmentEnd)
  if (!board) return null
  let status: PendingFinalStatus = 'abierta'
  if (enrolled) status = 'inscripto'
  else if (at < board.enrollmentStart) status = 'no-abrio'
  else if (spotsLeft(board.capacity, board.enrolled) === 0) status = 'sin-cupo'
  const { id, examPeriod, date, location, enrollmentStart, enrollmentEnd } = board
  return { examBoardId: id, examPeriod, date, location, enrollmentStart, enrollmentEnd, status }
}

/** Las materias regulares sin aprobar, cada una con la fecha de su cursada regular más reciente. */
function regularNotApproved(history: SiuHistoryEntry[]): Map<string, string> {
  const approved = new Set(history.filter(isApproved).map((h) => h.subjectId))
  const since = new Map<string, string>()
  for (const h of history.filter((e) => isRegular(e) && !approved.has(e.subjectId))) {
    if (h.date > (since.get(h.subjectId) ?? '')) since.set(h.subjectId, h.date)
  }
  return since
}

/** Primero las que tienen mesa, por fecha; el resto, por materia. */
function byNextBoard(a: PendingFinal, b: PendingFinal): number {
  if (a.next && b.next)
    return a.next.date.localeCompare(b.next.date) || a.subjectName.localeCompare(b.subjectName, 'es')
  if (a.next || b.next) return a.next ? -1 : 1
  return a.subjectName.localeCompare(b.subjectName, 'es')
}

/** Actuales primero (por inicio del período) y archivadas después (la más reciente primero), cada grupo por materia. */
function inTermOrder(placed: SectionInTerm[]): SectionInTerm[] {
  const byName = (a: SectionInTerm, b: SectionInTerm) =>
    a.subject.name.localeCompare(b.subject.name, 'es') || a.section.name.localeCompare(b.section.name, 'es')
  const current = placed
    .filter((p) => p.current)
    .sort((a, b) => a.term.start.localeCompare(b.term.start) || byName(a, b))
  const archived = placed.filter((p) => !p.current).sort((a, b) => b.term.end.localeCompare(a.term.end) || byName(a, b))
  return [...current, ...archived]
}

/** Una nota de evaluación tal como la da el SIU, antes de ponerle nombres. */
type RawGrade = {
  sectionId: string
  assessmentId: string
  /** La historia la trae; la actuación provisoria no, sale de la comisión. */
  subjectId: string | null
  grade: number | null
  date: string
  loadedAt: string | null
  source: AssessmentGrade['source']
}

/** Nombre de una evaluación cuando el SIU no expone el cronograma (la API real). */
const GENERIC_ASSESSMENT = 'Evaluación'
/** Nombre de una materia que el SIU no devolvió. */
const UNKNOWN_SUBJECT = 'Materia'

/** Forma de aprobación de un renglón de la historia, o `null` si no aprueba la
    materia: una cursada regular, una evaluación o un examen desaprobado. */
function approvalOf(entry: SiuHistoryEntry): Approval | null {
  if (entry.type === 'promocion' && entry.result === 'promocionado') return 'promocion'
  if (entry.type === 'examen' && entry.result === 'aprobado') return 'examen'
  if (entry.type === 'equivalencia' && (entry.result === 'aprobado' || entry.result === 'promocionado'))
    return 'equivalencia'
  return null
}

type Approved = { entry: SiuHistoryEntry; approval: Approval }

/** Un renglón aprobado por materia. Si hay más de uno (por ejemplo, un acta
    rectificada), vale el más reciente, así la materia sale y cuenta una vez. */
function approvedSubjects(history: SiuHistoryEntry[]): Approved[] {
  const bySubject = new Map<string, Approved>()
  for (const entry of history) {
    const approval = approvalOf(entry)
    const kept = bySubject.get(entry.subjectId)
    if (approval && (!kept || entry.date > kept.entry.date)) bySubject.set(entry.subjectId, { entry, approval })
  }
  return [...bySubject.values()]
}

function averageOf(items: HistoryItem[]): number | null {
  const grades = items.flatMap((i) => (i.grade === null ? [] : [i.grade]))
  if (grades.length === 0) return null
  return Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100
}

/** Las notas de evaluaciones de la historia y de actuación provisoria, sin nombres todavía. */
function rawGrades(history: SiuHistoryEntry[], provisional: SiuProvisionalResult[]): RawGrade[] {
  const fromHistory = history.flatMap((h): RawGrade[] =>
    h.type === 'evaluacion' && h.sectionId && h.assessmentId
      ? [
          {
            sectionId: h.sectionId,
            assessmentId: h.assessmentId,
            subjectId: h.subjectId,
            grade: h.grade,
            date: h.date,
            loadedAt: h.loadedAt,
            source: 'historia'
          }
        ]
      : []
  )
  const fromProvisional = provisional.map(
    (r): RawGrade => ({
      sectionId: r.sectionId,
      assessmentId: r.assessmentId,
      subjectId: null,
      grade: r.grade,
      date: r.date,
      loadedAt: r.loadedAt,
      source: 'actuacion-provisoria'
    })
  )
  return [...fromHistory, ...fromProvisional]
}

/** Cuántos días es nueva una nota desde que se cargó. */
const NEW_GRADE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** Las notas con número cargadas en los últimos 7 días, después de `seenAt` y no después de ahora, la más nueva
    primero. Sin fecha de carga, cuenta la de la evaluación. Un ausente no es una nota que llega. */
function newGradesOf(grades: AssessmentGrade[], now: string, seenAt: string | null): AssessmentGrade[] {
  const weekAgo = new Date(new Date(now).getTime() - NEW_GRADE_DAYS * DAY_MS).toISOString()
  const since = seenAt && seenAt > weekAgo ? seenAt : weekAgo
  const loaded = (g: AssessmentGrade) => g.loadedAt ?? g.date
  return grades
    .filter((g) => g.grade !== null && loaded(g) > since && loaded(g) <= now)
    .sort((a, b) => loaded(b).localeCompare(loaded(a)))
}

/** La más reciente primero y, a igual fecha, por materia. */
const newestFirst = (a: { date: string; subjectName: string }, b: { date: string; subjectName: string }) =>
  b.date.localeCompare(a.date) || a.subjectName.localeCompare(b.subjectName, 'es')

/** Un id del SIU o un vínculo que no existe es una persona que Cursada no conoce. */
function asUnknownPerson<E extends string>(
  error: E | 'no-encontrado' | 'sin-cuenta'
): Exclude<E, 'no-encontrado' | 'sin-cuenta'> | 'persona-desconocida' {
  return error === 'no-encontrado' || error === 'sin-cuenta'
    ? 'persona-desconocida'
    : (error as Exclude<E, 'no-encontrado' | 'sin-cuenta'>)
}

export function createStudies({ people, siu, classroom, clock }: StudiesDeps): Studies {
  const sectionStudents = createSectionStudents({ people, siu })

  /** Lo último que se leyó de cada operación y persona, para cuando el sistema de origen no responde. */
  const lastRead = new Map<string, Fresh<unknown>>()

  /** Lee y guarda la lectura como lo último leído. Una lectura incompleta (`complete` da `false`, como las materias
      sin el aula de Moodle) se devuelve igual, pero no pisa una completa: si después se cae el SIU, vuelve la
      completa. */
  async function fresh<T, E extends string = never>(
    key: string,
    read: () => Promise<Result<T, ReadError | E>>,
    complete: (value: T) => boolean = () => true
  ): Promise<Result<Fresh<T>, ReadError | E>> {
    const result = await read()
    if (result.ok) {
      const value: Fresh<T> = { data: result.value, readAt: clock.now().toISOString(), stale: false }
      if (complete(result.value) || !lastRead.has(key)) lastRead.set(key, value)
      return ok(value)
    }
    const last = lastRead.get(key) as Fresh<T> | undefined
    if (result.error === 'falla-externa' && last) return ok({ ...last, stale: true })
    return result
  }

  /** La persona en el SIU, con su rol y su facultad, por el id que da Personas. */
  async function siuPersonOf(personId: PersonId): Promise<Result<SiuPersonRef, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const person = await siu.person(siuId.value)
    if (!person.ok) return fail(asUnknownPerson(person.error))
    return ok({ siuId: siuId.value, schoolId: person.value.school.id, person: person.value })
  }

  /** Materias del SIU por id. Una que el SIU no encuentra se saltea; si no responde, falla. */
  async function subjectsById(ids: string[]): Promise<Result<Map<string, SiuSubject>, ExternalFailure>> {
    const found = await siu.subjects(unique(ids))
    return found.ok ? ok(new Map(found.value.map((subject) => [subject.id, subject]))) : found
  }

  /** Las comisiones que dicta un docente, o las de las inscripciones aceptadas o
      pendientes (de cualquier período) de un alumno, solo de su facultad. */
  async function siuSectionsOf({ siuId, person }: SiuPersonRef): Promise<Result<SiuSection[], ReadError>> {
    if (person.role === 'profesor') {
      const taught = await siu.teacherSections(siuId)
      return taught.ok ? ok(taught.value) : fail(asUnknownPerson(taught.error))
    }
    const enrollments = await siu.courseEnrollments(siuId, { historic: true })
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const ids = unique(enrollments.value.filter((e) => isActive(e.status)).map((e) => e.sectionId))
    const found = await Promise.all(ids.map((id) => siu.section(id)))
    if (found.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')
    return ok(found.flatMap((r) => (r.ok ? [r.value] : [])).filter((s) => s.schoolId === person.school.id))
  }

  /** Sus comisiones con su materia y su período, en el orden de `inTermOrder`. */
  async function sectionsInTermsOf(who: SiuPersonRef): Promise<Result<MySectionsInTerms, ReadError>> {
    const sections = await siuSectionsOf(who)
    if (!sections.ok) return sections
    const [terms, subjects] = await Promise.all([siu.terms(), subjectsById(sections.value.map((s) => s.subjectId))])
    if (!terms.ok) return terms
    if (!subjects.ok) return subjects

    const at = clock.now().toISOString()
    const placed = sections.value.flatMap((section): SectionInTerm[] => {
      const term = terms.value.find((t) => t.id === section.termId)
      const subject = subjects.value.get(section.subjectId)
      if (!term || !subject) return []
      return [{ section, subject, term, current: term.end >= at }]
    })
    return ok({ role: who.person.role, sections: inTermOrder(placed) })
  }

  /** Tareas con fecha de los cursos, por fecha. Que el aula no tenga tareas (o no
      tenga el curso) no es un error; que no responda, sí. */
  async function assignmentsOf(
    courses: ClassroomCourse[],
    at: string
  ): Promise<Result<MyAssignment[], ExternalFailure>> {
    if (!classroom.capabilities.hasAssignments) return ok([])
    const found = await Promise.all(courses.map((c) => classroom.assignments(c.id)))
    const lists: ClassroomAssignment[][] = []
    for (const result of found) {
      if (result.ok) lists.push(result.value)
      else if (result.error === 'falla-externa') return fail('falla-externa')
    }
    return ok(
      lists
        .flat()
        .flatMap((a) => (a.dueDate === null ? [] : [{ id: a.id, name: a.name, dueDate: a.dueDate }]))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name, 'es'))
        .map((a): MyAssignment => ({ ...a, source: 'moodle', past: a.dueDate < at }))
    )
  }

  /** Los cursos de Moodle de cada comisión y, de las actuales, sus tareas con
      fecha. Si Moodle no responde, todas van vacías y `unavailable`: las
      materias salen igual, porque son del SIU. */
  async function classroomsOf(
    sections: SectionInTerm[]
  ): Promise<{ courses: ClassroomCourse[][]; assignments: MyAssignment[][]; unavailable: boolean }> {
    const down = { courses: sections.map(() => []), assignments: sections.map(() => []), unavailable: true }
    const courses = all(await Promise.all(sections.map((p) => classroom.coursesForSection(p.section.id))))
    if (!courses.ok) return down
    const at = clock.now().toISOString()
    const assignments = all(
      await Promise.all(
        sections.map((p, i) =>
          p.current ? assignmentsOf(courses.value[i], at) : Promise.resolve(ok<MyAssignment[]>([]))
        )
      )
    )
    if (!assignments.ok) return down
    return { courses: courses.value, assignments: assignments.value, unavailable: false }
  }

  async function subjectsOf(personId: PersonId): Promise<Result<MySubjects, ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    const mine = await sectionsInTermsOf(who.value)
    if (!mine.ok) return mine
    const classrooms = await classroomsOf(mine.value.sections)
    const subjects = mine.value.sections.map(({ section, subject, term, current }, i) => {
      const item: MySubject = {
        subjectId: subject.id,
        code: subject.code,
        name: subject.name,
        schoolId: section.schoolId,
        termId: term.id,
        termName: term.name,
        sectionId: section.id,
        sectionName: section.name,
        termStart: term.start,
        termEnd: term.end,
        schedule: section.schedule,
        location: section.location,
        modality: section.modality,
        role: mine.value.role,
        classrooms: classrooms.courses[i].map((c) => ({
          courseId: c.id,
          name: c.fullName,
          url: classroom.courseUrl(c.id)
        })),
        assignments: classrooms.assignments[i]
      }
      return { item, current }
    })
    return ok({
      current: subjects.filter((s) => s.current).map((s) => s.item),
      archived: subjects.filter((s) => !s.current).map((s) => s.item),
      classroomUnavailable: classrooms.unavailable
    })
  }

  /** Las faltas de las materias actuales del alumno en las que tiene alguna. El máximo es el que da el SIU o,
      si no lo da, el que sale de la asistencia que pide la facultad y las clases de la comisión. Sin las del SIU
      no hay cuenta que valga: falla, y `fresh` devuelve lo último leído. */
  async function absencesOf(personId: PersonId): Promise<Result<MyAbsencesDetail, ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    if (who.value.person.role !== 'alumno') return ok({ subjects: [] })
    const [mine, report] = await Promise.all([sectionsInTermsOf(who.value), siu.absences(who.value.siuId)])
    if (!mine.ok) return mine
    if (!report.ok) return fail(asUnknownPerson(report.error))
    // Por ahora la única fuente es el SIU; la toma de lista (#108) suma la de HackAI.
    const records: AbsenceRecord[] = report.value.absences
      .map((a) => ({
        id: a.id,
        sectionId: a.sectionId,
        date: a.date,
        justified: a.justified,
        amount: a.amount ?? 1,
        source: 'siu' as const
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const rules = requirementsOf(activePrograms(who.value.person)[0]?.id ?? null)
    return ok({
      subjects: mine.value.sections
        .filter((s) => s.current && records.some((a) => a.sectionId === s.section.id))
        .map(({ section, subject }) => {
          const mineHere = records.filter((a) => a.sectionId === section.id)
          const fromSiu = report.value.limits.find((l) => l.sectionId === section.id)?.max ?? null
          const classes = fromSiu === null && section.classCount ? section.classCount : null
          const max = fromSiu ?? (classes ? maxAbsences(classes, rules.attendanceRequired) : null)
          return {
            ...absencesFrom(mineHere, max, classes),
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            sectionId: section.id,
            sectionName: section.name,
            absences: mineHere
          }
        })
    })
  }

  /** Lee cada id con `read` y arma un mapa de los que existen. Que uno no exista
      (o que el SIU no lo soporte) no es un error; que el SIU no responda, sí. */
  async function lookup<T>(
    ids: string[],
    read: (id: string) => Promise<Result<T, SiuReadError | 'no-soportado'>>
  ): Promise<Result<Map<string, T>, ExternalFailure>> {
    const found = await Promise.all(ids.map((id) => read(id)))
    const map = new Map<string, T>()
    for (const [i, result] of found.entries()) {
      if (result.ok) map.set(ids[i], result.value)
      else if (result.error === 'falla-externa') return fail('falla-externa')
    }
    return ok(map)
  }

  /** Los nombres de materias y evaluaciones que hacen falta para mostrar la
      historia y las notas, con lo que el SIU sepa. Las notas de actuación
      provisoria no traen la materia: sale de su comisión. Si el SIU no responde
      estas lecturas, falla todo `record` (y se ve lo último leído), como en
      `subjectsOf`: una nota sin materia ni evaluación no le sirve al alumno. */
  async function namesFor(raw: RawGrade[], subjectIds: string[]) {
    const sections = await lookup(unique(raw.filter((r) => r.subjectId === null).map((r) => r.sectionId)), (id) =>
      siu.section(id)
    )
    if (!sections.ok) return sections
    const schedules = siu.capabilities.hasAssessmentSchedule
      ? await lookup(unique(raw.map((r) => r.sectionId)), (id) => siu.assessments(id))
      : ok(new Map<string, SiuAssessment[]>())
    if (!schedules.ok) return schedules
    const subjectOf = (r: RawGrade) => r.subjectId ?? sections.value.get(r.sectionId)?.subjectId ?? null
    const subjects = await subjectsById([...subjectIds, ...raw.flatMap((r) => subjectOf(r) ?? [])])
    if (!subjects.ok) return subjects
    return ok({
      subjectOf,
      subjectName: (id: string | null) => (id && subjects.value.get(id)?.name) || UNKNOWN_SUBJECT,
      assessmentName: (r: RawGrade) =>
        schedules.value.get(r.sectionId)?.find((a) => a.id === r.assessmentId)?.name ?? GENERIC_ASSESSMENT
    })
  }

  /** Notas de parciales de la historia y de actuación provisoria, y materias aprobadas con su promedio. */
  async function record(personId: PersonId): Promise<Result<AcademicRecord, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const [history, provisional] = await Promise.all([siu.history(siuId.value), siu.provisionalResults(siuId.value)])
    if (!history.ok) return fail(asUnknownPerson(history.error))
    if (!provisional.ok) return fail(asUnknownPerson(provisional.error))

    const raw = rawGrades(history.value, provisional.value)
    const approved = approvedSubjects(history.value)
    const names = await namesFor(
      raw,
      approved.map((a) => a.entry.subjectId)
    )
    if (!names.ok) return names

    const grades = raw
      .map((r): AssessmentGrade => {
        const subjectId = names.value.subjectOf(r)
        return {
          subjectId,
          subjectName: names.value.subjectName(subjectId),
          assessmentName: names.value.assessmentName(r),
          grade: r.grade,
          date: r.date,
          loadedAt: r.loadedAt,
          source: r.source
        }
      })
      .sort((a, b) => newestFirst(a, b) || a.assessmentName.localeCompare(b.assessmentName, 'es'))
    const items = approved
      .map(
        ({ entry, approval }): HistoryItem => ({
          subjectId: entry.subjectId,
          subjectName: names.value.subjectName(entry.subjectId),
          date: entry.date,
          grade: entry.grade,
          approval
        })
      )
      .sort(newestFirst)
    return ok({ grades, history: items, average: averageOf(items) })
  }

  /** Por qué no cumple la de alumno regular: sin propuesta activa o sin
      inscripción a cursada vigente (aceptada o pendiente, como en `subjectsOf`). */
  async function regularStudentReasons(siuId: string, person: SiuPerson): Promise<CertificateReason[]> {
    const reasons: CertificateReason[] = []
    if (!person.programs.some((p) => p.status === 'activa')) reasons.push('sin-propuesta-activa')
    const enrollments = await siu.courseEnrollments(siuId)
    if (enrollments.ok && !enrollments.value.some((e) => isActive(e.status))) reasons.push('sin-inscripcion-vigente')
    return reasons
  }

  /** Por qué no cumple, con lo que la API real del SIU también da: propuestas,
      inscripciones vigentes e historia. Los motivos son de alumno: a un docente
      no se le deduce ninguno. Si una lectura falla, ese motivo no se dice: el
      veredicto ya lo dio el SIU. */
  async function reasonsWhy(siuId: string, type: CertificateType): Promise<CertificateReason[]> {
    const person = await siu.person(siuId)
    if (!person.ok || person.value.role !== 'alumno') return []
    if (type === 'alumno-regular') return regularStudentReasons(siuId, person.value)
    const history = await siu.history(siuId)
    if (!history.ok) return []
    return history.value.some((h) => h.type === 'examen' && h.result !== 'ausente') ? [] : ['sin-examenes-rendidos']
  }

  async function certificate(personId: PersonId, type: CertificateType): Promise<Result<CertificateStatus, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const meets = await siu.meetsCertificateConditions(siuId.value, type)
    if (!meets.ok) return fail(asUnknownPerson(meets.error))
    return ok({
      type,
      meetsConditions: meets.value,
      reasons: meets.value ? [] : await reasonsWhy(siuId.value, type),
      url: siu.selfServiceUrl({ kind: 'constancia', type }, siuId.value)
    })
  }

  /** Lo que el SIU hace con la cuenta del alumno en Trámites: si no lo sabe hacer, `no-soportado`. */
  async function withSiuAccount<T>(
    personId: PersonId,
    run: (siuId: string) => Promise<Result<T, string>> | undefined
  ): Promise<Result<T, ReadError | 'no-soportado'>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const done = await run(siuId.value)
    if (!done) return fail('no-soportado')
    if (done.ok) return done
    if (done.error === 'no-soportado') return fail('no-soportado')
    return fail(done.error === 'no-encontrado' ? 'persona-desconocida' : 'falla-externa')
  }

  /** Docentes de una comisión, con su persona de HackAI si la tienen. */
  async function teachersOf(section: {
    teacherIds: string[]
  }): Promise<Result<Teacher[], ExternalFailure | NotImplemented>> {
    const teachers: Teacher[] = []
    for (const siuId of section.teacherIds) {
      const [person, owner] = await Promise.all([siu.person(siuId), people.byExternalAccount('siu', siuId)])
      if (!person.ok && person.error === 'falla-externa') return fail('falla-externa')
      if (!owner.ok) return owner
      if (person.ok) teachers.push({ personId: owner.value, name: `${person.value.names} ${person.value.surname}` })
    }
    return ok(teachers)
  }

  async function sectionsOf(personId: PersonId): Promise<Result<MySection[], ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    const mine = await sectionsInTermsOf(who.value)
    if (!mine.ok) return mine
    const teachers = all(await Promise.all(mine.value.sections.map((p) => teachersOf(p.section))))
    if (!teachers.ok) return teachers

    return ok(
      mine.value.sections.map(({ section, subject, term, current }, i) => ({
        sectionId: section.id,
        name: section.name,
        subjectId: section.subjectId,
        subjectCode: subject.code,
        subjectName: subject.name,
        schoolId: section.schoolId,
        termId: section.termId,
        termName: term.name,
        current,
        role: mine.value.role,
        teachers: teachers.value[i]
      }))
    )
  }

  /** Lo que una comisión y una mesa de la oferta tienen en común. */
  type OfferCommon = Pick<
    OfferItem,
    | 'subjectId'
    | 'subjectName'
    | 'teachers'
    | 'capacity'
    | 'enrolled'
    | 'spotsLeft'
    | 'enrollmentStart'
    | 'enrollmentEnd'
    | 'enrollmentWindow'
  >

  function offerCommon(
    subject: SiuSubject,
    teachers: Teacher[],
    seats: { capacity: number | null; enrolled: number },
    window: { enrollmentStart: string | null; enrollmentEnd: string | null; enrollmentOpen?: boolean }
  ): OfferCommon {
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      teachers,
      capacity: seats.capacity,
      enrolled: seats.enrolled,
      spotsLeft: spotsLeft(seats.capacity, seats.enrolled),
      enrollmentStart: window.enrollmentStart,
      enrollmentEnd: window.enrollmentEnd,
      enrollmentWindow: windowAt(
        clock.now().toISOString(),
        window.enrollmentStart,
        window.enrollmentEnd,
        window.enrollmentOpen
      )
    }
  }

  /** Sus inscripciones vigentes a cursada, con el error en el vocabulario de Cursada. */
  async function courseEnrollmentsOf(siuId: string): Promise<Result<SiuCourseEnrollment[], ReadError>> {
    const enrollments = await siu.courseEnrollments(siuId)
    return enrollments.ok ? enrollments : fail(asUnknownPerson(enrollments.error))
  }

  /** Sus inscripciones vigentes a examen, con el error en el vocabulario de Cursada. */
  async function examEnrollmentsOf(siuId: string): Promise<Result<SiuExamEnrollment[], ReadError>> {
    const enrollments = await siu.examEnrollments(siuId)
    return enrollments.ok ? enrollments : fail(asUnknownPerson(enrollments.error))
  }

  /** Comisiones de sus inscripciones vigentes a cursada (aceptadas o pendientes,
      de períodos que no terminaron), de cualquier facultad. */
  async function sectionsInCourse(siuId: string): Promise<Result<SiuSection[], ReadError>> {
    const enrollments = await courseEnrollmentsOf(siuId)
    if (!enrollments.ok) return enrollments
    const sections = await Promise.all(enrollments.value.map((e) => siu.section(e.sectionId)))
    if (sections.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')
    return ok(sections.flatMap((r) => (r.ok ? [r.value] : [])))
  }

  /** Materias de sus inscripciones vigentes a cursada: una sola comisión vigente por materia. */
  async function subjectsInCourse(siuId: string): Promise<Result<Set<string>, ReadError>> {
    const sections = await sectionsInCourse(siuId)
    if (!sections.ok) return sections
    return ok(new Set(sections.value.map((s) => s.subjectId)))
  }

  /** Comisiones de la materia en la facultad, de períodos que no terminaron. Cada
      una dice si ya está inscripto y si lo está en otra comisión de la materia,
      con el mismo criterio que la inscripción. */
  async function sectionOffer(person: SiuPersonRef, subject: SiuSubject): Promise<Result<OfferItem[], ReadError>> {
    const at = clock.now().toISOString()
    const [terms, sections, enrolledSections] = await Promise.all([
      siu.terms(),
      siu.sections({ subjectId: subject.id, schoolId: person.schoolId }),
      sectionsInCourse(person.siuId)
    ])
    if (!terms.ok) return terms
    if (!sections.ok) return sections
    if (!enrolledSections.ok) return enrolledSections
    const currentSections = sections.value
      .flatMap((section) => {
        const term = terms.value.find((t) => t.id === section.termId)
        return term && term.end >= at ? [{ section, term }] : []
      })
      .sort((a, b) => a.term.start.localeCompare(b.term.start) || a.section.name.localeCompare(b.section.name, 'es'))
    const teachers = all(await Promise.all(currentSections.map((p) => teachersOf(p.section))))
    if (!teachers.ok) return teachers
    const sameSubject = enrolledSections.value.filter((s) => s.subjectId === subject.id)
    return ok(
      currentSections.map(
        ({ section, term }, i): OfferItem => ({
          ...offerCommon(subject, teachers.value[i], section, term),
          target: { kind: 'comision', sectionId: section.id },
          name: section.name,
          period: term.name,
          schedule: section.schedule,
          date: null,
          location: section.location,
          modality: section.modality,
          instance: section.instance,
          start: term.start,
          end: term.end,
          notes: section.notes,
          otherProgram: !isForPrograms(section, person.person),
          alreadyEnrolled: sameSubject.some((s) => s.id === section.id),
          enrolledElsewhere: sameSubject.find((s) => s.id !== section.id)?.name ?? null,
          needsRegularity: false
        })
      )
    )
  }

  /** Mesas de la materia en la facultad que todavía no se tomaron, y si para rendirla le falta la regularidad.
      La regularidad es solo un aviso: si la historia no se pudo leer, las mesas salen igual, sin él. */
  async function boardOffer(person: SiuPersonRef, subject: SiuSubject): Promise<Result<OfferItem[], ReadError>> {
    const at = clock.now().toISOString()
    const [boards, enrollments, progress] = await Promise.all([
      siu.examBoards({ subjectId: subject.id, schoolId: person.schoolId }),
      examEnrollmentsOf(person.siuId),
      progressOf(person)
    ])
    if (!boards.ok) return boards
    if (!enrollments.ok) return enrollments
    const known = progress.ok ? progress.value : null
    const upcoming = boards.value.filter((b) => b.date >= at).sort((a, b) => a.date.localeCompare(b.date))
    const teachers = all(await Promise.all(upcoming.map((b) => teachersOf(b))))
    if (!teachers.ok) return teachers
    return ok(
      upcoming.map(
        (board, i): OfferItem => ({
          ...offerCommon(subject, teachers.value[i], board, board),
          target: { kind: 'mesa', examBoardId: board.id },
          name: board.examPeriod,
          period: board.examPeriod,
          schedule: [],
          date: board.date,
          location: board.location,
          modality: null,
          instance: null,
          start: null,
          end: null,
          notes: board.notes,
          otherProgram: false,
          alreadyEnrolled: enrollments.value.some((e) => e.examBoardId === board.id),
          enrolledElsewhere: null,
          needsRegularity: known ? needsRegularity(subject.id, known) : false
        })
      )
    )
  }

  /** Comisiones de la materia en la facultad de la persona, de períodos que no
      terminaron; o mesas de la materia en su facultad que todavía no se tomaron. */
  async function offer(personId: PersonId, query: OfferQuery): Promise<Result<OfferItem[], ReadError>> {
    const siuPerson = await siuPersonOf(personId)
    if (!siuPerson.ok) return siuPerson
    const subject = await siu.subject(query.subjectId)
    if (!subject.ok) return subject.error === 'no-encontrado' ? ok([]) : fail(subject.error)
    return query.kind === 'cursada'
      ? sectionOffer(siuPerson.value, subject.value)
      : boardOffer(siuPerson.value, subject.value)
  }

  type TargetError = 'objetivo-desconocido' | ExternalFailure

  /** La materia de una comisión o una mesa y su ventana de inscripción. */
  type TargetInfo = {
    subjectId: string
    enrollmentStart: string | null
    enrollmentEnd: string | null
    enrollmentOpen?: boolean
  }

  /** La mesa, si existe y es de la facultad. */
  async function boardInfo(examBoardId: string, schoolId: string): Promise<Result<TargetInfo, TargetError>> {
    const boards = await siu.examBoards({ schoolId })
    if (!boards.ok) return boards
    const found = boards.value.find((b) => b.id === examBoardId)
    return found ? ok(found) : fail('objetivo-desconocido')
  }

  /** La comisión, si existe y es de su facultad y de su carrera, con la ventana de su período lectivo. */
  async function sectionInfo(sectionId: string, who: SiuPersonRef): Promise<Result<TargetInfo, TargetError>> {
    const [section, terms] = await Promise.all([siu.section(sectionId), siu.terms()])
    if (!section.ok) return fail(section.error === 'no-encontrado' ? 'objetivo-desconocido' : section.error)
    if (!terms.ok) return terms
    const term = terms.value.find((t) => t.id === section.value.termId)
    const mine = section.value.schoolId === who.schoolId && isForPrograms(section.value, who.person)
    if (!mine || !term) return fail('objetivo-desconocido')
    const { enrollmentStart, enrollmentEnd, enrollmentOpen } = term
    return ok({ subjectId: section.value.subjectId, enrollmentStart, enrollmentEnd, enrollmentOpen })
  }

  /** La persona en el SIU, que tiene que ser alumno, y el objetivo, que tiene que existir y ser de su facultad. */
  async function resolveTarget(
    personId: PersonId,
    target: Target
  ): Promise<Result<{ siuId: string } & TargetInfo, ReadError | TargetError | StudentsOnly>> {
    const siuPerson = await siuPersonOf(personId)
    if (!siuPerson.ok) return siuPerson
    if (siuPerson.value.person.role !== 'alumno') return fail('solo-alumnos')
    const { schoolId } = siuPerson.value
    const info =
      target.kind === 'mesa'
        ? await boardInfo(target.examBoardId, schoolId)
        : await sectionInfo(target.sectionId, siuPerson.value)
    if (!info.ok) return info
    return ok({ siuId: siuPerson.value.siuId, ...info.value })
  }

  /** Cursos del aula de una comisión, para devolver en el comprobante. Que no respondan no es un error. */
  async function sectionCourseIds(sectionId: string): Promise<string[]> {
    const courses = await classroom.coursesForSection(sectionId)
    return courses.ok ? courses.value.map((c) => c.id) : []
  }

  /** Lo que hace falta del aula para inscribir en una comisión o dar de baja:
      sus cursos y, si HackAI tiene que matricular, el id de Moodle de la
      persona. Se lee antes de tocar el SIU, así un Moodle caído o una persona
      sin usuario de Moodle no dejan nada a medias. */
  async function classroomPlan(
    personId: PersonId,
    target: Target
  ): Promise<Result<ClassroomPlan, 'sin-cuenta-del-aula' | ExternalFailure>> {
    if (target.kind !== 'comision') return ok({ courseIds: [], moodleId: null })
    // Si el SIU matricula solo, la persona queda en las aulas sin que HackAI las toque.
    if (siu.capabilities.enrolsInClassroom) {
      return ok({ courseIds: await sectionCourseIds(target.sectionId), moodleId: null })
    }
    // Si nadie puede matricular por API, se inscribe en el SIU y no queda en ningún aula.
    if (!classroom.capabilities.canEnrol) return ok({ courseIds: [], moodleId: null })
    const courses = await classroom.coursesForSection(target.sectionId)
    if (!courses.ok) return courses
    if (!courses.value.length) return ok({ courseIds: [], moodleId: null })
    const moodleId = await people.accountIn(personId, 'moodle')
    if (!moodleId.ok) return fail(moodleId.error === 'falla-externa' ? 'falla-externa' : 'sin-cuenta-del-aula')
    return ok({ courseIds: courses.value.map((c) => c.id), moodleId: moodleId.value })
  }

  type CourseStep = (moodleId: string, courseId: string) => Promise<Result<unknown, string>>
  const enrolIn: CourseStep = (moodleId, courseId) => classroom.enrol(moodleId, courseId, 'student')
  const unenrolFrom: CourseStep = (moodleId, courseId) => classroom.unenrol(moodleId, courseId)

  /** Aplica `step` a cada curso. Si uno falla, aplica `undo` a los que ya
      pasaron, del último al primero: todo o nada en el aula. */
  async function eachCourse(
    plan: ClassroomPlan,
    step: CourseStep,
    undo: CourseStep
  ): Promise<Result<null, ExternalFailure | 'a-medias'>> {
    const { moodleId, courseIds } = plan
    if (!moodleId) return ok(null)
    const done: string[] = []
    for (const courseId of courseIds) {
      const result = await step(moodleId, courseId)
      if (!result.ok) return undoAll(moodleId, done, undo)
      done.push(courseId)
    }
    return ok(null)
  }

  /** Deshace los cursos que ya pasaron, del último al primero. Si alguno no se
      deja deshacer, el aula quedó distinta de como estaba: `a-medias`. */
  async function undoAll(
    moodleId: string,
    done: string[],
    undo: CourseStep
  ): Promise<Result<never, ExternalFailure | 'a-medias'>> {
    const stuck: string[] = []
    for (const courseId of [...done].reverse()) {
      const result = await undo(moodleId, courseId)
      if (!result.ok) stuck.push(courseId)
    }
    if (!stuck.length) return fail('falla-externa')
    console.error('aula: no se pudo deshacer la matrícula de algunos cursos', { courses: stuck })
    return fail('a-medias')
  }

  const selfService = (target: Target) => ok({ kind: 'requiere-autogestion' as const, url: siu.selfServiceUrl(target) })

  /** Un error del SIU al inscribir o dar de baja, en el vocabulario de Cursada. */
  function siuFailure<E extends string>(
    error: E | 'no-encontrado'
  ): Exclude<E, 'no-encontrado'> | 'objetivo-desconocido' {
    return error === 'no-encontrado' ? 'objetivo-desconocido' : (error as Exclude<E, 'no-encontrado'>)
  }

  /** El id del SIU con el que se pide la inscripción, si se puede pedir: el
      objetivo existe, es de su facultad y, si es una comisión, no tiene otra
      vigente de la misma materia. */
  async function siuIdToEnroll(personId: PersonId, target: Target): Promise<Result<string, EnrollError | ReadError>> {
    const resolved = await resolveTarget(personId, target)
    if (!resolved.ok) return resolved
    const { siuId, subjectId } = resolved.value
    if (target.kind !== 'comision') return ok(siuId)
    const subjectsTaken = await subjectsInCourse(siuId)
    if (!subjectsTaken.ok) return subjectsTaken
    return subjectsTaken.value.has(subjectId) ? fail('ya-inscripto') : ok(siuId)
  }

  /** Inscribe en el SIU y matricula en el aula. Si el aula falla, deshace la
      del SIU; si eso también falla, devuelve `a-medias`. */
  async function enrollBoth(
    siuId: string,
    target: Target,
    plan: ClassroomPlan
  ): Promise<Result<EnrollOutcome, EnrollError>> {
    const receipt = await siu.enroll(siuId, target)
    if (!receipt.ok) return receipt.error === 'no-soportado' ? selfService(target) : fail(siuFailure(receipt.error))
    const enrolled = await eachCourse(plan, enrolIn, unenrolFrom)
    if (enrolled.ok) return ok({ kind: 'inscripto', receipt: receipt.value, classroomCourseIds: plan.courseIds })
    // El aula quedó a medias: se deja la inscripción del SIU, que es lo que el alumno quiso hacer.
    if (enrolled.error === 'a-medias') return enrolled
    const undone = await siu.drop(siuId, target)
    if (undone.ok) return enrolled
    console.error('enroll: no se pudo deshacer la inscripción del SIU', {
      transaction: receipt.value.transactionNumber,
      error: undone.error
    })
    return fail('a-medias')
  }

  async function enroll(
    personId: PersonId,
    target: Target
  ): Promise<Result<EnrollOutcome, EnrollError | 'persona-desconocida' | NotImplemented>> {
    const siuId = await siuIdToEnroll(personId, target)
    if (!siuId.ok) return siuId
    if (!siu.capabilities.canEnroll) return selfService(target)
    const plan = await classroomPlan(personId, target)
    if (!plan.ok) return plan
    return enrollBoth(siuId.value, target, plan.value)
  }

  /** Si la persona tiene una inscripción vigente a la comisión o la mesa. */
  async function isEnrolledIn(siuId: string, target: Target): Promise<Result<boolean, ReadError>> {
    if (target.kind === 'mesa') {
      const enrollments = await examEnrollmentsOf(siuId)
      return enrollments.ok ? ok(enrollments.value.some((e) => e.examBoardId === target.examBoardId)) : enrollments
    }
    const enrollments = await courseEnrollmentsOf(siuId)
    return enrollments.ok ? ok(enrollments.value.some((e) => e.sectionId === target.sectionId)) : enrollments
  }

  /** El id del SIU con el que se pide la baja, si se puede pedir: el objetivo
      existe, es de su facultad, está inscripto y la ventana de inscripción está
      abierta. La ventana se mira antes de tocar el aula, porque desmatricular y
      volver a matricular en Moodle puede perder entregas y notas. */
  async function siuIdToDrop(personId: PersonId, target: Target): Promise<Result<string, DropError | ReadError>> {
    const resolved = await resolveTarget(personId, target)
    if (!resolved.ok) return resolved
    const { siuId, enrollmentStart, enrollmentEnd, enrollmentOpen } = resolved.value
    const enrolled = await isEnrolledIn(siuId, target)
    if (!enrolled.ok) return enrolled
    if (!enrolled.value) return fail('no-inscripto')
    return isOpenAt(clock.now().toISOString(), enrollmentStart, enrollmentEnd, enrollmentOpen)
      ? ok(siuId)
      : fail('fuera-de-periodo')
  }

  /** Desmatricula del aula y da de baja en el SIU. Si el SIU la rechaza, vuelve
      a matricular; si eso también falla, devuelve `a-medias`. */
  async function dropBoth(siuId: string, target: Target, plan: ClassroomPlan): Promise<Result<DropOutcome, DropError>> {
    const unenrolled = await eachCourse(plan, unenrolFrom, enrolIn)
    if (!unenrolled.ok) return unenrolled
    const receipt = await siu.drop(siuId, target)
    if (receipt.ok) return ok({ kind: 'baja', receipt: receipt.value })
    const restored = await eachCourse(plan, enrolIn, unenrolFrom)
    if (!restored.ok) {
      console.error('drop: no se pudo volver a matricular después de que el SIU rechazó la baja', {
        error: receipt.error
      })
      return fail('a-medias')
    }
    return receipt.error === 'no-soportado' ? selfService(target) : fail(siuFailure(receipt.error))
  }

  /** El camino inverso de `enroll`: primero desmatricula del aula y después da
      de baja en el SIU. Si el SIU rechaza la baja, vuelve a matricular: lo que
      se deshace sin riesgo es la matrícula, no la inscripción. Si el SIU no deja
      dar de baja por API, devuelve el enlace solo si está inscripto. */
  async function drop(
    personId: PersonId,
    target: Target
  ): Promise<Result<DropOutcome, DropError | 'persona-desconocida' | NotImplemented>> {
    const siuId = await siuIdToDrop(personId, target)
    if (!siuId.ok) return siuId
    if (!siu.capabilities.canEnroll) return selfService(target)
    const plan = await classroomPlan(personId, target)
    if (!plan.ok) return plan
    return dropBoth(siuId.value, target, plan.value)
  }

  /** Parciales, recuperatorios y TP del cronograma de sus comisiones. Sin
      cronograma en el SIU (la API real) no hay, y no es un error. */
  async function assessmentsOf(
    sections: SectionInTerm[],
    at: string
  ): Promise<Result<UpcomingItem[], ExternalFailure>> {
    if (!siu.capabilities.hasAssessmentSchedule) return ok([])
    const found = await Promise.all(sections.map((s) => siu.assessments(s.section.id)))
    const items: UpcomingItem[] = []
    for (const [i, result] of found.entries()) {
      if (!result.ok && result.error === 'falla-externa') return fail('falla-externa')
      if (!result.ok) continue
      for (const a of result.value) {
        items.push({
          id: `evaluacion:${a.id}`,
          kind: a.kind,
          source: 'siu',
          ...subjectRef(sections[i].subject),
          name: a.name,
          date: a.date,
          past: a.date < at,
          examPeriod: null,
          location: null,
          hasSection: true
        })
      }
    }
    return ok(items)
  }

  /** Las mesas de su facultad y en cuáles está inscripto. Con `historic`, cuentan también las inscripciones a mesas que ya se tomaron. */
  async function examBoardsOf(
    { siuId, person }: SiuPersonRef,
    historic: boolean
  ): Promise<Result<ExamBoardsOf, ReadError>> {
    const [boards, enrollments] = await Promise.all([
      siu.examBoards({ schoolId: person.school.id }),
      siu.examEnrollments(siuId, { historic })
    ])
    if (!boards.ok) return boards
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    return ok({
      boards: boards.value,
      enrolledIn: new Set(enrollments.value.filter((e) => isActive(e.status)).map((e) => e.examBoardId))
    })
  }

  /** Las mesas de su facultad que le tocan: las que integra el docente, o aquellas a las que el alumno está inscripto. */
  async function boardsFor(who: SiuPersonRef): Promise<Result<SiuExamBoard[], ReadError>> {
    if (who.person.role === 'profesor') {
      const boards = await siu.examBoards({ schoolId: who.schoolId })
      return boards.ok ? ok(boards.value.filter((b) => b.teacherIds.includes(who.siuId))) : boards
    }
    const exams = await examBoardsOf(who, true)
    if (!exams.ok) return exams
    return ok(exams.value.boards.filter((b) => exams.value.enrolledIn.has(b.id)))
  }

  /** Finales: las mesas que le tocan, desde `since` (el inicio de su período actual), con su turno y su lugar. */
  async function finalsOf(
    who: SiuPersonRef,
    since: string,
    at: string,
    withSection: Set<string>
  ): Promise<Result<UpcomingItem[], ReadError>> {
    const boards = await boardsFor(who)
    if (!boards.ok) return boards
    const mine = boards.value.filter((b) => b.date >= since)
    const subjects = await subjectsById(mine.map((b) => b.subjectId))
    if (!subjects.ok) return subjects
    return ok(
      mine.flatMap((board): UpcomingItem[] => {
        const subject = subjects.value.get(board.subjectId)
        if (!subject) return []
        return [
          {
            id: `mesa:${board.id}`,
            kind: 'final',
            source: 'siu',
            ...subjectRef(subject),
            name: 'Final',
            date: board.date,
            past: board.date < at,
            examPeriod: board.examPeriod,
            location: board.location.trim() || null,
            hasSection: withSection.has(board.subjectId)
          }
        ]
      })
    )
  }

  async function upcoming(personId: PersonId): Promise<Result<UpcomingItem[], ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    const mine = await sectionsInTermsOf(who.value)
    if (!mine.ok) return mine
    const at = clock.now().toISOString()
    const current = mine.value.sections.filter((s) => s.current)
    // Lo que ya pasó cuenta desde que empezó su período actual. Un período que todavía
    // no empezó (el de verano) o no tener materias actuales no esconde nada de lo que viene.
    const since = [at, ...current.map((s) => s.term.start)].sort()[0]
    const [assessments, finals] = await Promise.all([
      assessmentsOf(current, at),
      finalsOf(who.value, since, at, new Set(mine.value.sections.map((s) => s.subject.id)))
    ])
    if (!assessments.ok) return assessments
    if (!finals.ok) return finals
    return ok([...assessments.value, ...finals.value].sort(compareUpcoming))
  }

  /** Qué cursa (con el mismo criterio que la inscripción: una comisión vigente en cualquier facultad), qué tiene regular y qué aprobó. */
  async function progressOf(who: SiuPersonRef): Promise<Result<SubjectProgress, ReadError>> {
    const [taking, history] = await Promise.all([subjectsInCourse(who.siuId), siu.history(who.siuId)])
    if (!taking.ok) return taking
    if (!history.ok) return fail(asUnknownPerson(history.error))
    return ok({
      taking: taking.value,
      regular: new Set(history.value.filter(isRegular).map((h) => h.subjectId)),
      approved: new Set(history.value.filter(isApproved).map((h) => h.subjectId))
    })
  }

  /** Materias regulares sin aprobar, con su próxima mesa: la regla está en el encabezado. */
  async function pendingFinals(personId: PersonId): Promise<Result<PendingFinal[], ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    if (who.value.person.role === 'profesor') return ok([])
    const [history, exams] = await Promise.all([siu.history(who.value.siuId), examBoardsOf(who.value, false)])
    if (!history.ok) return fail(asUnknownPerson(history.error))
    if (!exams.ok) return exams
    const regularSince = regularNotApproved(history.value)
    const subjects = await subjectsById([...regularSince.keys()])
    if (!subjects.ok) return subjects
    const at = clock.now().toISOString()
    const items = [...regularSince].flatMap(([subjectId, since]): PendingFinal[] => {
      const subject = subjects.value.get(subjectId)
      if (!subject) return []
      return [
        { subjectId, subjectName: subject.name, regularSince: since, next: nextBoardFor(subjectId, exams.value, at) }
      ]
    })
    return ok(items.sort(byNextBoard))
  }

  /** Comisiones de su facultad con la inscripción del período abierta, de materias que le falta cursar. Tengan o no cupo: lo dice la oferta. */
  async function openCourseEnrollments(
    who: SiuPersonRef,
    progress: SubjectProgress,
    at: string
  ): Promise<Result<Opening[], ExternalFailure>> {
    const terms = await siu.terms()
    if (!terms.ok) return terms
    const open = terms.value.filter((t) => isOpenAt(at, t.enrollmentStart, t.enrollmentEnd, t.enrollmentOpen))
    const found = all(await Promise.all(open.map((t) => siu.sections({ schoolId: who.schoolId, termId: t.id }))))
    if (!found.ok) return found
    return ok(
      found.value.flatMap((sections, i) =>
        sections
          .filter((s) => isForPrograms(s, who.person) && needsCourseAttempt(s.subjectId, progress))
          .map(
            (s): Opening => ({
              kind: 'cursada',
              subjectId: s.subjectId,
              opensAt: open[i].enrollmentStart,
              closesAt: open[i].enrollmentEnd,
              spotsLeft: spotsLeft(s.capacity, s.enrolled),
              needsRegularity: false
            })
          )
      )
    )
  }

  /** Mesas de su facultad con la inscripción abierta, de materias que le sirve rendir y en las que no está inscripto. Tengan o no cupo. */
  async function openExamEnrollments(
    who: SiuPersonRef,
    progress: SubjectProgress,
    at: string
  ): Promise<Result<Opening[], ReadError>> {
    const exams = await examBoardsOf(who, false)
    if (!exams.ok) return exams
    const { boards, enrolledIn } = exams.value
    const enrolledSubjects = new Set(boards.filter((b) => enrolledIn.has(b.id)).map((b) => b.subjectId))
    return ok(
      boards
        .filter(
          (b) =>
            isOpenAt(at, b.enrollmentStart, b.enrollmentEnd) &&
            !enrolledSubjects.has(b.subjectId) &&
            needsExam(b.subjectId, progress)
        )
        .map(
          (b): Opening => ({
            kind: 'examen',
            subjectId: b.subjectId,
            opensAt: b.enrollmentStart,
            closesAt: b.enrollmentEnd,
            spotsLeft: spotsLeft(b.capacity, b.enrolled),
            needsRegularity: needsRegularity(b.subjectId, progress)
          })
        )
    )
  }

  /** Inscripciones abiertas que le sirven, a cursada y a examen: la regla está en el encabezado. */
  async function openEnrollments(personId: PersonId): Promise<Result<NamedOpening[], ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    if (who.value.person.role === 'profesor') return ok([])
    const progress = await progressOf(who.value)
    if (!progress.ok) return progress
    const at = clock.now().toISOString()
    const [courses, exams] = await Promise.all([
      openCourseEnrollments(who.value, progress.value, at),
      openExamEnrollments(who.value, progress.value, at)
    ])
    if (!courses.ok) return courses
    if (!exams.ok) return exams
    const openings = [...courses.value, ...exams.value]
    const subjects = await subjectsById(openings.map((o) => o.subjectId))
    if (!subjects.ok) return subjects
    const named = openings.flatMap((o): NamedOpening[] => {
      const subject = subjects.value.get(o.subjectId)
      if (!subject) return []
      const activity = o.kind === 'cursada' && subject.credits !== null
      return [
        {
          ...o,
          kind: activity ? 'actividad' : o.kind,
          subjectName: subject.name,
          credits: activity ? subject.credits : null
        }
      ]
    })
    return ok(onePerSubject(named.sort(byClosing)))
  }

  /** El plan de su primera propuesta activa. Sin propuesta activa o sin plan en el SIU, `null`; que el SIU no responda, sí es un error. */
  async function planOf(person: SiuPerson): Promise<Result<SiuStudyPlan | null, ExternalFailure>> {
    const program = activePrograms(person)[0]
    if (!program) return ok(null)
    const plan = await siu.studyPlan(program.id)
    if (plan.ok) return plan
    return plan.error === 'falla-externa' ? fail('falla-externa') : ok(null)
  }

  /** Las mesas a las que está inscripto y todavía no se tomaron: la fecha, por materia. */
  async function examDatesOf(who: SiuPersonRef, at: string): Promise<Result<Map<string, string>, ReadError>> {
    const exams = await examBoardsOf(who, false)
    if (!exams.ok) return exams
    const mine = exams.value.boards.filter((b) => exams.value.enrolledIn.has(b.id) && b.date >= at)
    return ok(new Map(mine.map((b) => [b.subjectId, b.date])))
  }

  /** Lo que la historia y la actuación provisoria dicen de la persona: notas y materias aprobadas. */
  async function gradesOf(siuId: string) {
    const [history, provisional] = await Promise.all([siu.history(siuId), siu.provisionalResults(siuId)])
    if (!history.ok) return fail(asUnknownPerson(history.error))
    if (!provisional.ok) return fail(asUnknownPerson(provisional.error))
    const grades: LoadedGrade[] = rawGrades(history.value, provisional.value)
    const approved = new Map<string, ApprovedInCareer>(
      approvedSubjects(history.value).map(({ entry, approval }) => [
        entry.subjectId,
        { date: entry.date, grade: entry.grade, approval }
      ])
    )
    return ok({ history: history.value, grades, approved })
  }

  /** Todo lo que se lee del SIU para armar la carrera, o el primer error. */
  async function careerReads(who: SiuPersonRef, at: string) {
    const [plan, mine, loaded, exams] = await Promise.all([
      planOf(who.person),
      sectionsInTermsOf(who),
      gradesOf(who.siuId),
      examDatesOf(who, at)
    ])
    if (!plan.ok) return plan
    if (!mine.ok) return mine
    if (!loaded.ok) return loaded
    if (!exams.ok) return exams
    const sections = mine.value.sections
    const schedules = siu.capabilities.hasAssessmentSchedule
      ? await lookup(unique(sections.map((s) => s.section.id)), (id) => siu.assessments(id))
      : ok(new Map<string, SiuAssessment[]>())
    if (!schedules.ok) return schedules
    const subjects = await subjectsById([
      ...(plan.value?.subjects.map((s) => s.subjectId) ?? []),
      ...sections.map((s) => s.subject.id),
      ...loaded.value.history.map((h) => h.subjectId)
    ])
    if (!subjects.ok) return subjects
    return ok({
      plan: plan.value,
      sections,
      ...loaded.value,
      exams: exams.value,
      schedules: schedules.value,
      subjects: subjects.value
    })
  }

  async function career(personId: PersonId): Promise<Result<Career, ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    if (who.value.person.role === 'profesor') return ok(EMPTY_CAREER)
    const at = clock.now().toISOString()
    const read = await careerReads(who.value, at)
    if (!read.ok) return read
    const program = activePrograms(who.value.person)[0] ?? null
    return ok(
      buildCareer({
        now: at,
        program: program && { id: program.id, name: program.name, progressPercent: program.progressPercent ?? null },
        plan: read.value.plan,
        subjects: read.value.subjects,
        sections: read.value.sections.map(
          ({ section, subject, term, current }): TakenSection => ({
            subjectId: subject.id,
            sectionId: section.id,
            sectionName: section.name,
            termName: term.name,
            termStart: term.start,
            current
          })
        ),
        history: read.value.history,
        approved: read.value.approved,
        grades: read.value.grades,
        schedules: read.value.schedules,
        exams: read.value.exams,
        genericName: GENERIC_ASSESSMENT
      })
    )
  }

  /** Las inscripciones abiertas con los días que faltan para que cierren, contados con el reloj de ahora y no
      con el de la lectura: lo último que se leyó puede ser de otro día. */
  async function openEnrollmentsNow(personId: PersonId): Promise<Result<Fresh<OpenEnrollment[]>, ReadError>> {
    const read = await fresh(`openEnrollments:${personId}`, () => openEnrollments(personId))
    if (!read.ok) return read
    const at = clock.now().toISOString()
    return ok({
      ...read.value,
      data: read.value.data.map((o) => ({
        ...o,
        closesInDays: o.closesAt === null ? null : daysBetween(at, o.closesAt)
      }))
    })
  }

  const recordFresh = (personId: PersonId) => fresh(`record:${personId}`, () => record(personId))

  /** Las notas nuevas, miradas con el reloj de ahora: una nota de lo último que se leyó puede haber dejado de ser
      nueva. */
  async function newGradesNow(
    personId: PersonId,
    seenAt: string | null
  ): Promise<Result<Fresh<AssessmentGrade[]>, ReadError>> {
    const read = await recordFresh(personId)
    if (!read.ok) return read
    return ok({ ...read.value, data: newGradesOf(read.value.data.grades, clock.now().toISOString(), seenAt) })
  }

  /** La oferta, con la ventana de inscripción mirada con el reloj de ahora: lo último que se leyó puede ser de antes
      de que abriera o cerrara. */
  async function offerNow(personId: PersonId, query: OfferQuery): Promise<Result<Fresh<OfferItem[]>, ReadError>> {
    const read = await fresh(`offer:${personId}:${query.kind}:${query.subjectId}`, () => offer(personId, query))
    if (!read.ok) return read
    const at = clock.now().toISOString()
    return ok({
      ...read.value,
      // Sin fechas, la ventana es lo que dijo el SIU en la lectura: el reloj no la mueve.
      data: read.value.data.map((o) =>
        o.enrollmentStart === null || o.enrollmentEnd === null
          ? o
          : { ...o, enrollmentWindow: windowAt(at, o.enrollmentStart, o.enrollmentEnd) }
      )
    })
  }

  return {
    subjectsOf: (personId) =>
      fresh(
        `subjectsOf:${personId}`,
        () => subjectsOf(personId),
        (s) => !s.classroomUnavailable
      ),
    absencesOf: (personId) => fresh(`absencesOf:${personId}`, () => absencesOf(personId)),
    sectionsOf: (personId) => fresh(`sectionsOf:${personId}`, () => sectionsOf(personId)),
    sectionStudents: (personId, sectionId) =>
      fresh(`sectionStudents:${personId}:${sectionId}`, () => sectionStudents(personId, sectionId)),
    offer: offerNow,
    enroll,
    drop,
    upcoming: (personId) => fresh(`upcoming:${personId}`, () => upcoming(personId)),
    openEnrollments: openEnrollmentsNow,
    pendingFinals: (personId) => fresh(`pendingFinals:${personId}`, () => pendingFinals(personId)),
    record: recordFresh,
    newGrades: newGradesNow,
    certificate: (personId, type) => fresh(`certificate:${personId}:${type}`, () => certificate(personId, type)),
    career: (personId) => fresh(`career:${personId}`, () => career(personId)),
    certificateRequests: (personId) => withSiuAccount(personId, (id) => siu.certificateRequests?.(id)),
    requestCertificate: (personId, request) => withSiuAccount(personId, (id) => siu.requestCertificate?.(id, request)),
    officialDocument: (personId, kind) => withSiuAccount(personId, (id) => siu.officialDocument?.(id, kind))
  }
}
