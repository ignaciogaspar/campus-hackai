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

   - Próximos (`upcoming`): parciales, recuperatorios y TP del cronograma de sus
     materias actuales, los finales de las mesas de su facultad a las que está
     inscripto y todavía no se tomaron, y como complemento las tareas con fecha
     de Moodle, todo por fecha y con los pasados marcados según el reloj. Sin
     cronograma en el SIU (la API real) salen solo finales y entregas.
   - Inscripciones abiertas (`openEnrollments`), las que cierran antes primero,
     una por materia. Qué le sirve al alumno es una hipótesis, sin confirmar
     con el equipo:
     - cursada: comisiones de su facultad con la inscripción del período
       abierta y cupo, de materias que no está cursando, no tiene regulares ni
       aprobó;
     - examen: mesas de su facultad con la inscripción abierta y cupo, de
       materias que no aprobó y tiene regulares o está cursando (puede
       regularizar antes de la mesa), si no está inscripto ya a una mesa de
       esa materia.
     Se muestran aunque el SIU no deje inscribir por API: se completan en la
     Autogestión. Un docente no tiene.

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import type { ClassroomAssignment, ClassroomCourse, ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type {
  SiuCertificateType,
  SiuEnrollmentStatus,
  SiuHistoryEntry,
  SiuPerson,
  SiuPort,
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
  /** La sigla de la materia, para el calendario. */
  subjectCode: string
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

type SiuPersonOf = { siuId: string; person: SiuPerson }

const isActive = (status: SiuEnrollmentStatus) => status === 'aceptada' || status === 'pendiente'

const unique = (values: string[]) => [...new Set(values)]

/** Por fecha; el mismo día, por materia y por nombre. */
const byDate = (a: UpcomingItem, b: UpcomingItem) =>
  a.date.localeCompare(b.date) || a.subjectName.localeCompare(b.subjectName, 'es') || a.name.localeCompare(b.name, 'es')

/** Qué tiene el alumno de cada materia, por id: la está cursando (o ya se
    inscribió en un período que no terminó), la tiene regular o la aprobó. */
type Standing = { taking: Set<string>; regular: Set<string>; approved: Set<string> }

/** Una inscripción abierta antes de ponerle el nombre a la materia. */
type Opening = Omit<OpenEnrollment, 'subjectName'>

const isRegular = (h: SiuHistoryEntry) => h.type === 'cursada' && h.result === 'regular'

const isApproved = (h: SiuHistoryEntry) =>
  (h.type === 'examen' && h.result === 'aprobado') ||
  (h.type === 'promocion' && h.result === 'promocionado') ||
  (h.type === 'equivalencia' && (h.result === 'aprobado' || h.result === 'promocionado'))

const hasRoom = (o: { capacity: number | null; enrolled: number }) => o.capacity === null || o.enrolled < o.capacity

const isOpenAt = (start: string, end: string, at: string) => start <= at && at <= end

/** Le sirve cursarla si no la está cursando, no la tiene regular y no la aprobó. */
const needsCourse = (subjectId: string, s: Standing) =>
  !s.taking.has(subjectId) && !s.regular.has(subjectId) && !s.approved.has(subjectId)

/** Le sirve rendirla si no la aprobó y la tiene regular o la está cursando (puede regularizarla antes de la mesa). */
const needsExam = (subjectId: string, s: Standing) =>
  !s.approved.has(subjectId) && (s.regular.has(subjectId) || s.taking.has(subjectId))

/** La que cierra antes primero; el mismo día, por materia. */
const byClosing = (a: OpenEnrollment, b: OpenEnrollment) =>
  a.closesAt.localeCompare(b.closesAt) ||
  a.subjectName.localeCompare(b.subjectName, 'es') ||
  a.kind.localeCompare(b.kind)

/** Una por materia y tipo: la que cierra antes. Espera la lista ya ordenada. */
function onePerSubject(items: OpenEnrollment[]): OpenEnrollment[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    const key = `${i.kind}:${i.subjectId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Las tareas con fecha de una materia, como entregas de Moodle. */
function deliveriesOf(subject: MySubject): UpcomingItem[] {
  return subject.assignments.map((a) => ({
    kind: 'entrega',
    source: 'moodle',
    subjectId: subject.subjectId,
    subjectCode: subject.code,
    subjectName: subject.name,
    name: a.name,
    date: a.dueDate,
    past: a.past
  }))
}

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

  /** La persona en el SIU, con su rol y su facultad, por el id que da Personas. */
  async function siuPersonOf(personId: PersonId): Promise<Result<SiuPersonOf, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const person = await siu.person(siuId.value)
    if (!person.ok) return fail(asUnknownPerson(person.error))
    return ok({ siuId: siuId.value, person: person.value })
  }

  /** Materias del SIU por id. Una que el SIU no encuentra se saltea; si no responde, falla. */
  async function subjectsById(ids: string[]): Promise<Result<Map<string, SiuSubject>, ExternalFailure>> {
    const found = await Promise.all(unique(ids).map((id) => siu.subject(id)))
    if (found.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')
    return ok(new Map(found.flatMap((r) => (r.ok ? [[r.value.id, r.value] as const] : []))))
  }

  /** Parciales, recuperatorios y TP del cronograma de sus materias. Sin
      cronograma en el SIU (la API real) no hay, y no es un error. */
  async function assessmentsOf(subjects: MySubject[], at: string): Promise<Result<UpcomingItem[], ExternalFailure>> {
    if (!siu.capabilities.hasAssessmentSchedule) return ok([])
    const found = await Promise.all(subjects.map((s) => siu.assessments(s.sectionId)))
    const items: UpcomingItem[] = []
    for (const [i, result] of found.entries()) {
      if (!result.ok && result.error === 'falla-externa') return fail('falla-externa')
      if (!result.ok) continue
      const subject = subjects[i]
      for (const a of result.value) {
        items.push({
          kind: a.kind,
          source: 'siu',
          subjectId: subject.subjectId,
          subjectCode: subject.code,
          subjectName: subject.name,
          name: a.name,
          date: a.date,
          past: a.date < at
        })
      }
    }
    return ok(items)
  }

  /** Finales: las mesas de su facultad a las que está inscripto y que todavía no se tomaron. */
  async function finalsOf({ siuId, person }: SiuPersonOf, at: string): Promise<Result<UpcomingItem[], ReadError>> {
    const enrollments = await siu.examEnrollments(siuId)
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const boardIds = new Set(enrollments.value.filter((e) => isActive(e.status)).map((e) => e.examBoardId))
    if (boardIds.size === 0) return ok([])
    const boards = await siu.examBoards({ schoolId: person.school.id })
    if (!boards.ok) return boards
    const mine = boards.value.filter((b) => boardIds.has(b.id))
    const subjects = await subjectsById(mine.map((b) => b.subjectId))
    if (!subjects.ok) return subjects
    return ok(
      mine.flatMap((board): UpcomingItem[] => {
        const subject = subjects.value.get(board.subjectId)
        if (!subject) return []
        return [
          {
            kind: 'final',
            source: 'siu',
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            name: 'Final',
            date: board.date,
            past: board.date < at
          }
        ]
      })
    )
  }

  async function upcoming(personId: PersonId): Promise<Result<UpcomingItem[], ReadError>> {
    const [who, mine] = await Promise.all([siuPersonOf(personId), subjectsOf(personId)])
    if (!who.ok) return who
    if (!mine.ok) return mine
    const at = clock.now().toISOString()
    const { current } = mine.value
    const [assessments, finals] = await Promise.all([assessmentsOf(current, at), finalsOf(who.value, at)])
    if (!assessments.ok) return assessments
    if (!finals.ok) return finals
    return ok([...assessments.value, ...finals.value, ...current.flatMap(deliveriesOf)].sort(byDate))
  }

  async function standingOf(personId: PersonId, siuId: string): Promise<Result<Standing, ReadError>> {
    const [mine, history] = await Promise.all([sectionsInTermsOf(personId), siu.history(siuId)])
    if (!mine.ok) return mine
    if (!history.ok) return fail(asUnknownPerson(history.error))
    return ok({
      taking: new Set(mine.value.sections.filter((s) => s.current).map((s) => s.subject.id)),
      regular: new Set(history.value.filter(isRegular).map((h) => h.subjectId)),
      approved: new Set(history.value.filter(isApproved).map((h) => h.subjectId))
    })
  }

  /** Comisiones de su facultad con la inscripción del período abierta y cupo, de materias que le falta cursar. */
  async function openCourses(
    schoolId: string,
    standing: Standing,
    at: string
  ): Promise<Result<Opening[], ExternalFailure>> {
    const terms = await siu.terms()
    if (!terms.ok) return terms
    const open = terms.value.filter((t) => isOpenAt(t.enrollmentStart, t.enrollmentEnd, at))
    const found = all(await Promise.all(open.map((t) => siu.sections({ schoolId, termId: t.id }))))
    if (!found.ok) return found
    return ok(
      found.value.flatMap((sections, i) =>
        sections
          .filter((s) => hasRoom(s) && needsCourse(s.subjectId, standing))
          .map(
            (s): Opening => ({
              kind: 'cursada',
              subjectId: s.subjectId,
              opensAt: open[i].enrollmentStart,
              closesAt: open[i].enrollmentEnd
            })
          )
      )
    )
  }

  /** Mesas de su facultad con la inscripción abierta y cupo, de materias que le sirve rendir y en las que no está inscripto. */
  async function openExams({ siuId, person }: SiuPersonOf, standing: Standing, at: string) {
    const [boards, enrollments] = await Promise.all([
      siu.examBoards({ schoolId: person.school.id }),
      siu.examEnrollments(siuId)
    ])
    if (!boards.ok) return boards
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const enrolled = new Set(enrollments.value.filter((e) => isActive(e.status)).map((e) => e.examBoardId))
    const enrolledSubjects = new Set(boards.value.filter((b) => enrolled.has(b.id)).map((b) => b.subjectId))
    return ok(
      boards.value
        .filter(
          (b) =>
            isOpenAt(b.enrollmentStart, b.enrollmentEnd, at) &&
            hasRoom(b) &&
            !enrolledSubjects.has(b.subjectId) &&
            needsExam(b.subjectId, standing)
        )
        .map(
          (b): Opening => ({
            kind: 'examen',
            subjectId: b.subjectId,
            opensAt: b.enrollmentStart,
            closesAt: b.enrollmentEnd
          })
        )
    )
  }

  async function openEnrollments(personId: PersonId): Promise<Result<OpenEnrollment[], ReadError>> {
    const who = await siuPersonOf(personId)
    if (!who.ok) return who
    if (who.value.person.role === 'profesor') return ok([])
    const standing = await standingOf(personId, who.value.siuId)
    if (!standing.ok) return standing
    const at = clock.now().toISOString()
    const [courses, exams] = await Promise.all([
      openCourses(who.value.person.school.id, standing.value, at),
      openExams(who.value, standing.value, at)
    ])
    if (!courses.ok) return courses
    if (!exams.ok) return exams
    const openings = [...courses.value, ...exams.value]
    const subjects = await subjectsById(openings.map((o) => o.subjectId))
    if (!subjects.ok) return subjects
    const named = openings.flatMap((o): OpenEnrollment[] => {
      const subject = subjects.value.get(o.subjectId)
      return subject ? [{ ...o, subjectName: subject.name }] : []
    })
    return ok(onePerSubject(named.sort(byClosing)))
  }

  return {
    subjectsOf: (personId) => fresh(`subjectsOf:${personId}`, () => subjectsOf(personId)),
    sectionsOf: (personId) => fresh(`sectionsOf:${personId}`, () => sectionsOf(personId)),
    offer: notImplemented,
    enroll: notImplemented,
    drop: notImplemented,
    upcoming: (personId) => fresh(`upcoming:${personId}`, () => upcoming(personId)),
    openEnrollments: (personId) => fresh(`openEnrollments:${personId}`, () => openEnrollments(personId)),
    record: notImplemented,
    certificate: notImplemented
  }
}
