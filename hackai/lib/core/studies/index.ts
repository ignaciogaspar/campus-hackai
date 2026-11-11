/* Cursada (studies): todo lo que viene del SIU y de Moodle sobre la vida
   académica del alumno. Interfaz e invariantes en hackai/docs/ARQUITECTURA.md.

   - `enroll` es todo o nada: si el SIU inscribe y Moodle falla, deshace la del
     SIU antes de devolver `falla-externa`.
   - Matricula en Moodle solo si el SIU no lo hace (capacidad `enrolsInClassroom`).
   - Si el SIU no deja inscribir por API, devuelve `requiere-autogestion` con el
     enlace: es un paso más, no un error.
   - Las lecturas toleran caídas: devuelven lo último leído, marcado como
     desactualizado (`Fresh`).

   - Materias y comisiones: un alumno ve las de sus inscripciones aceptadas o
     pendientes, y nunca las de otra facultad; un docente, las que dicta. Son
     actuales las de un período lectivo que no terminó (el que está en curso y
     los que ya tienen inscriptos, como el de verano) y archivadas las de
     períodos que ya terminaron.
   - Cada materia lleva el enlace a su aula de Moodle y, si es actual, sus tareas
     con fecha por orden de fecha (las sin fecha no se muestran). Si el aula
     declara que no tiene tareas, salen vacías sin error.

   - Notas: las de parciales, recuperatorios y TP salen juntas, vengan de la
     historia (renglones `evaluacion`) o de actuación provisoria, cada una con
     su origen y la más reciente primero. Sin cronograma en el SIU (la API
     real), salen igual con el nombre «Evaluación».
   - Historia: solo las materias aprobadas (promoción, final o equivalencia) y
     su promedio. Las cursadas regulares y las evaluaciones no entran.
   - Constancias: si cumple las condiciones lo dice el SIU. Si no cumple,
     Cursada deduce el motivo con lo que la API real también da (propuesta
     activa, inscripción vigente, finales rendidos); si no lo encuentra, no
     inventa uno.

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import type { ClassroomAssignment, ClassroomCourse, ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type {
  SiuAssessment,
  SiuCertificateType,
  SiuHistoryEntry,
  SiuPort,
  SiuProvisionalResult,
  SiuReadError,
  SiuSchedule,
  SiuSection,
  SiuSubject,
  SiuTerm
} from '@/lib/ports/siu'
import { all, type ExternalFailure, fail, type NotImplemented, notImplemented, ok, type Result } from '@/lib/result'

/** Una lectura con la hora en que se hizo. `stale` si el sistema de origen no
    respondió y es lo último que se leyó. */
export type Fresh<T> = { data: T; readAt: string; stale: boolean }

/** Una comisión (cursada) o una mesa (examen). */
export type Target = { kind: 'comision'; sectionId: string } | { kind: 'mesa'; examBoardId: string }

/** Qué oferta se busca: comisiones para cursar o mesas para rendir una materia. */
export type OfferQuery = { kind: 'cursada' | 'examen'; subjectId: string }

export type CertificateType = SiuCertificateType

export type Teacher = { personId: PersonId | null; name: string }

/** Aula de la materia en el Campus Virtual: el curso de Moodle y el enlace para entrar. */
export type MyClassroom = { courseId: string; name: string; url: string }

/** Tarea con fecha límite de un curso de Moodle. `past` si la fecha ya pasó según el reloj. */
export type MyAssignment = { name: string; dueDate: string; source: 'moodle'; past: boolean }

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
  /** Cursos de Moodle vinculados a la comisión, con el enlace a cada aula. */
  classrooms: MyClassroom[]
  /** Tareas con fecha de esos cursos, por fecha. Solo las de materias actuales; las archivadas, vacío. */
  assignments: MyAssignment[]
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

export type DropOutcome = { kind: 'baja'; receipt: Receipt } | { kind: 'requiere-autogestion'; url: string }

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
  /** Sus comisiones, como alumno o como docente. */
  sectionsOf(personId: PersonId): Promise<Result<Fresh<MySection[]>, ReadError>>
  /** Comisiones o mesas de examen con cupo, horario y docentes. */
  offer(personId: PersonId, query: OfferQuery): Promise<Result<OfferItem[], ReadError>>
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

/** Una comisión de la persona con su materia y su período lectivo. */
type SectionInTerm = { section: SiuSection; subject: SiuSubject; term: SiuTerm; current: boolean }

type MySectionsInTerms = { role: Role; sections: SectionInTerm[] }

/** Una nota de evaluación tal como la da el SIU, antes de ponerle nombres. */
type RawGrade = {
  sectionId: string
  assessmentId: string
  /** La historia la trae; la actuación provisoria no, sale de la comisión. */
  subjectId: string | null
  grade: number | null
  date: string
  source: AssessmentGrade['source']
}

/** Nombre de una evaluación cuando el SIU no expone el cronograma (la API real). */
const GENERIC_ASSESSMENT = 'Evaluación'
/** Nombre de una materia que el SIU no devolvió. */
const UNKNOWN_SUBJECT = 'Materia'

const unique = (values: string[]) => [...new Set(values)]

/** Forma de aprobación de un renglón de la historia, o `null` si no aprueba la
    materia: una cursada regular, una evaluación o un examen desaprobado. */
function approvalOf(entry: SiuHistoryEntry): Approval | null {
  if (entry.type === 'promocion' && entry.result === 'promocionado') return 'promocion'
  if (entry.type === 'examen' && entry.result === 'aprobado') return 'examen'
  if (entry.type === 'equivalencia' && (entry.result === 'aprobado' || entry.result === 'promocionado'))
    return 'equivalencia'
  return null
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
      source: 'actuacion-provisoria'
    })
  )
  return [...fromHistory, ...fromProvisional]
}

const newestFirst = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date)

/** Un id del SIU o un vínculo que no existe es una persona que Cursada no conoce. */
function asUnknownPerson<E extends string>(
  error: E | 'no-encontrado' | 'sin-cuenta'
): Exclude<E, 'no-encontrado' | 'sin-cuenta'> | 'persona-desconocida' {
  return error === 'no-encontrado' || error === 'sin-cuenta'
    ? 'persona-desconocida'
    : (error as Exclude<E, 'no-encontrado' | 'sin-cuenta'>)
}

export function createStudies({ people, siu, classroom, clock }: StudiesDeps): Studies {
  /** Lo último que se leyó de cada operación y persona, para cuando el sistema de origen no responde. */
  const lastRead = new Map<string, Fresh<unknown>>()

  async function fresh<T>(
    key: string,
    read: () => Promise<Result<T, ReadError>>
  ): Promise<Result<Fresh<T>, ReadError>> {
    const result = await read()
    if (result.ok) {
      const value: Fresh<T> = { data: result.value, readAt: clock.now().toISOString(), stale: false }
      lastRead.set(key, value)
      return ok(value)
    }
    const last = lastRead.get(key) as Fresh<T> | undefined
    if (result.error === 'falla-externa' && last) return ok({ ...last, stale: true })
    return result
  }

  /** Las comisiones de la persona, actuales primero (por inicio del período) y
      archivadas después (la más reciente primero), cada grupo por materia. El
      rol y la facultad salen del SIU, con el id que da Personas. */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 18 (máximo 15). Se refactoriza después de la demo (#30).
  async function sectionsInTermsOf(personId: PersonId): Promise<Result<MySectionsInTerms, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const person = await siu.person(siuId.value)
    if (!person.ok) return fail(asUnknownPerson(person.error))
    const { role, school } = person.value

    let sections: SiuSection[]
    if (role === 'profesor') {
      const taught = await siu.teacherSections(siuId.value)
      if (!taught.ok) return fail(asUnknownPerson(taught.error))
      sections = taught.value
    } else {
      const enrollments = await siu.courseEnrollments(siuId.value, { historic: true })
      if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
      const ids = [
        ...new Set(
          enrollments.value.filter((e) => e.status === 'aceptada' || e.status === 'pendiente').map((e) => e.sectionId)
        )
      ]
      const found = await Promise.all(ids.map((id) => siu.section(id)))
      if (found.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')
      sections = found.flatMap((r) => (r.ok ? [r.value] : [])).filter((s) => s.schoolId === school.id)
    }

    const terms = await siu.terms()
    if (!terms.ok) return terms
    const subjectIds = [...new Set(sections.map((s) => s.subjectId))]
    const subjects = await Promise.all(subjectIds.map((id) => siu.subject(id)))
    if (subjects.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')

    const at = clock.now().toISOString()
    const placed = sections.flatMap((section): SectionInTerm[] => {
      const term = terms.value.find((t) => t.id === section.termId)
      const subject = subjects.find((r) => r.ok && r.value.id === section.subjectId)
      if (!term || !subject?.ok) return []
      return [{ section, subject: subject.value, term, current: term.end >= at }]
    })
    const byName = (a: SectionInTerm, b: SectionInTerm) =>
      a.subject.name.localeCompare(b.subject.name, 'es') || a.section.name.localeCompare(b.section.name, 'es')
    const current = placed
      .filter((p) => p.current)
      .sort((a, b) => a.term.start.localeCompare(b.term.start) || byName(a, b))
    const archived = placed
      .filter((p) => !p.current)
      .sort((a, b) => b.term.end.localeCompare(a.term.end) || byName(a, b))
    return ok({ role, sections: [...current, ...archived] })
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
        .flatMap((a) => (a.dueDate === null ? [] : [{ name: a.name, dueDate: a.dueDate }]))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name, 'es'))
        .map((a): MyAssignment => ({ ...a, source: 'moodle', past: a.dueDate < at }))
    )
  }

  async function subjectsOf(personId: PersonId): Promise<Result<MySubjects, ReadError>> {
    const mine = await sectionsInTermsOf(personId)
    if (!mine.ok) return mine
    const courses = all(await Promise.all(mine.value.sections.map((p) => classroom.coursesForSection(p.section.id))))
    if (!courses.ok) return courses
    const at = clock.now().toISOString()
    const assignments = all(
      await Promise.all(
        mine.value.sections.map((p, i) =>
          p.current ? assignmentsOf(courses.value[i], at) : Promise.resolve(ok<MyAssignment[]>([]))
        )
      )
    )
    if (!assignments.ok) return assignments

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
        role: mine.value.role,
        classrooms: courses.value[i].map((c) => ({ courseId: c.id, name: c.fullName, url: classroom.courseUrl(c.id) })),
        assignments: assignments.value[i]
      }
      return { item, current }
    })
    return ok({
      current: subjects.filter((s) => s.current).map((s) => s.item),
      archived: subjects.filter((s) => !s.current).map((s) => s.item)
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
      provisoria no traen la materia: sale de su comisión. */
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
    const subjects = await lookup(unique([...subjectIds, ...raw.flatMap((r) => subjectOf(r) ?? [])]), (id) =>
      siu.subject(id)
    )
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
    const approved = history.value.flatMap((h) => {
      const approval = approvalOf(h)
      return approval ? [{ entry: h, approval }] : []
    })
    const names = await namesFor(
      raw,
      approved.map((a) => a.entry.subjectId)
    )
    if (!names.ok) return names

    const grades = raw
      .map((r): AssessmentGrade => {
        const subjectId = names.value.subjectOf(r)
        return {
          subjectId: subjectId ?? '',
          subjectName: names.value.subjectName(subjectId),
          assessmentName: names.value.assessmentName(r),
          grade: r.grade,
          date: r.date,
          source: r.source
        }
      })
      .sort(
        (a, b) =>
          newestFirst(a, b) ||
          a.subjectName.localeCompare(b.subjectName, 'es') ||
          a.assessmentName.localeCompare(b.assessmentName, 'es')
      )
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
      .sort((a, b) => newestFirst(a, b) || a.subjectName.localeCompare(b.subjectName, 'es'))
    return ok({ grades, history: items, average: averageOf(items) })
  }

  /** Por qué no cumple, con lo que la API real del SIU también da: propuestas,
      inscripciones vigentes e historia. Si una lectura falla, ese motivo no se
      dice: el veredicto ya lo dio el SIU. */
  async function reasonsWhy(siuId: string, type: CertificateType): Promise<CertificateReason[]> {
    if (type === 'examen-final') {
      const history = await siu.history(siuId)
      const tookAnExam = history.ok && history.value.some((h) => h.type === 'examen' && h.result !== 'ausente')
      return history.ok && !tookAnExam ? ['sin-examenes-rendidos'] : []
    }
    const [person, enrollments] = await Promise.all([siu.person(siuId), siu.courseEnrollments(siuId)])
    const reasons: CertificateReason[] = []
    if (person.ok && !person.value.programs.some((p) => p.status === 'activa')) reasons.push('sin-propuesta-activa')
    if (enrollments.ok && !enrollments.value.some((e) => e.status === 'aceptada'))
      reasons.push('sin-inscripcion-vigente')
    return reasons
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
      url: siu.selfServiceUrl({ kind: 'constancia', type })
    })
  }

  /** Docentes de una comisión, con su persona de HackAI si la tienen. */
  async function teachersOf(section: SiuSection): Promise<Result<Teacher[], ExternalFailure | NotImplemented>> {
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
    const mine = await sectionsInTermsOf(personId)
    if (!mine.ok) return mine
    const teachers = all(await Promise.all(mine.value.sections.map((p) => teachersOf(p.section))))
    if (!teachers.ok) return teachers

    return ok(
      mine.value.sections.map(({ section }, i) => ({
        sectionId: section.id,
        name: section.name,
        subjectId: section.subjectId,
        schoolId: section.schoolId,
        termId: section.termId,
        role: mine.value.role,
        teachers: teachers.value[i]
      }))
    )
  }

  return {
    subjectsOf: (personId) => fresh(`subjectsOf:${personId}`, () => subjectsOf(personId)),
    sectionsOf: (personId) => fresh(`sectionsOf:${personId}`, () => sectionsOf(personId)),
    offer: notImplemented,
    enroll: notImplemented,
    drop: notImplemented,
    upcoming: notImplemented,
    openEnrollments: notImplemented,
    record: (personId) => fresh(`record:${personId}`, () => record(personId)),
    certificate
  }
}
