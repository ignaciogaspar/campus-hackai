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

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import type { ClassroomAssignment, ClassroomCourse, ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuCertificateType, SiuPort, SiuSchedule, SiuSection, SiuSubject, SiuTerm } from '@/lib/ports/siu'
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
  /** Comisión: el período lectivo. Mesa: el turno de examen. */
  period: string
  /** Comisión: horarios. Mesa: vacío. */
  schedule: SiuSchedule[]
  /** Mesa: fecha del examen. Comisión: `null`. */
  date: string | null
  location: string
  /** Comisión: presencial, virtual o híbrida. Mesa: `null`. */
  modality: SiuSection['modality'] | null
  teachers: Teacher[]
  /** Cupo. `null` es «sin definir»: no se llena. */
  capacity: number | null
  enrolled: number
  enrollmentStart: string
  enrollmentEnd: string
  /** La ventana de inscripción está abierta según el reloj. */
  enrollmentOpen: boolean
  alreadyEnrolled: boolean
  /** Comisión: el nombre de otra comisión de la materia en la que ya está
      inscripto, que le impide inscribirse en esta. Mesa: `null`. */
  enrolledElsewhere: string | null
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

  /** El id del SIU de la persona y su facultad. */
  async function siuPersonOf(personId: PersonId): Promise<Result<{ siuId: string; schoolId: string }, ReadError>> {
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(asUnknownPerson(siuId.error))
    const person = await siu.person(siuId.value)
    if (!person.ok) return fail(asUnknownPerson(person.error))
    return ok({ siuId: siuId.value, schoolId: person.value.school.id })
  }

  const isOpenAt = (at: string, start: string, end: string) => start <= at && at <= end

  /** Comisiones de la materia en la facultad, de períodos que no terminaron. */
  async function sectionOffer(
    siuId: string,
    schoolId: string,
    subject: SiuSubject
  ): Promise<Result<OfferItem[], ReadError>> {
    const at = clock.now().toISOString()
    const [terms, sections, enrollments] = await Promise.all([
      siu.terms(),
      siu.sections({ subjectId: subject.id, schoolId }),
      siu.courseEnrollments(siuId)
    ])
    if (!terms.ok) return terms
    if (!sections.ok) return sections
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const placed = sections.value
      .flatMap((section) => {
        const term = terms.value.find((t) => t.id === section.termId)
        return term && term.end >= at ? [{ section, term }] : []
      })
      .sort((a, b) => a.term.start.localeCompare(b.term.start) || a.section.name.localeCompare(b.section.name, 'es'))
    const teachers = all(await Promise.all(placed.map((p) => teachersOf(p.section))))
    if (!teachers.ok) return teachers
    const enrolledIds = new Set(enrollments.value.map((e) => e.sectionId))
    const enrolledElsewhere = (sectionId: string) =>
      placed.find((p) => p.section.id !== sectionId && enrolledIds.has(p.section.id))?.section.name ?? null
    return ok(
      placed.map(
        ({ section, term }, i): OfferItem => ({
          target: { kind: 'comision', sectionId: section.id },
          subjectId: subject.id,
          subjectName: subject.name,
          name: section.name,
          period: term.name,
          schedule: section.schedule,
          date: null,
          location: section.location,
          modality: section.modality,
          teachers: teachers.value[i],
          capacity: section.capacity,
          enrolled: section.enrolled,
          enrollmentStart: term.enrollmentStart,
          enrollmentEnd: term.enrollmentEnd,
          enrollmentOpen: isOpenAt(at, term.enrollmentStart, term.enrollmentEnd),
          alreadyEnrolled: enrolledIds.has(section.id),
          enrolledElsewhere: enrolledElsewhere(section.id)
        })
      )
    )
  }

  /** Mesas de la materia en la facultad que todavía no se tomaron. */
  async function boardOffer(
    siuId: string,
    schoolId: string,
    subject: SiuSubject
  ): Promise<Result<OfferItem[], ReadError>> {
    const at = clock.now().toISOString()
    const [boards, enrollments] = await Promise.all([
      siu.examBoards({ subjectId: subject.id, schoolId }),
      siu.examEnrollments(siuId)
    ])
    if (!boards.ok) return boards
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const upcoming = boards.value.filter((b) => b.date >= at).sort((a, b) => a.date.localeCompare(b.date))
    const teachers = all(await Promise.all(upcoming.map((b) => teachersOf(b))))
    if (!teachers.ok) return teachers
    return ok(
      upcoming.map(
        (board, i): OfferItem => ({
          target: { kind: 'mesa', examBoardId: board.id },
          subjectId: subject.id,
          subjectName: subject.name,
          name: board.examPeriod,
          period: board.examPeriod,
          schedule: [],
          date: board.date,
          location: board.location,
          modality: null,
          teachers: teachers.value[i],
          capacity: board.capacity,
          enrolled: board.enrolled,
          enrollmentStart: board.enrollmentStart,
          enrollmentEnd: board.enrollmentEnd,
          enrollmentOpen: isOpenAt(at, board.enrollmentStart, board.enrollmentEnd),
          alreadyEnrolled: enrollments.value.some((e) => e.examBoardId === board.id),
          enrolledElsewhere: null
        })
      )
    )
  }

  /** Comisiones de la materia en la facultad de la persona, de períodos que no
      terminaron; o mesas de la materia en su facultad que todavía no se tomaron. */
  async function offer(personId: PersonId, query: OfferQuery): Promise<Result<OfferItem[], ReadError>> {
    const mine = await siuPersonOf(personId)
    if (!mine.ok) return mine
    const subject = await siu.subject(query.subjectId)
    if (!subject.ok) return subject.error === 'no-encontrado' ? ok([]) : fail(subject.error)
    const { siuId, schoolId } = mine.value
    return query.kind === 'cursada'
      ? sectionOffer(siuId, schoolId, subject.value)
      : boardOffer(siuId, schoolId, subject.value)
  }

  type TargetError = 'objetivo-desconocido' | ExternalFailure

  /** La materia de una comisión, si existe y es de la facultad. */
  async function sectionSubject(sectionId: string, schoolId: string): Promise<Result<string, TargetError>> {
    const section = await siu.section(sectionId)
    if (!section.ok) return fail(section.error === 'no-encontrado' ? 'objetivo-desconocido' : section.error)
    return section.value.schoolId === schoolId ? ok(section.value.subjectId) : fail('objetivo-desconocido')
  }

  /** La materia de una mesa, si existe y es de la facultad. */
  async function boardSubject(examBoardId: string, schoolId: string): Promise<Result<string, TargetError>> {
    const boards = await siu.examBoards({ schoolId })
    if (!boards.ok) return boards
    const found = boards.value.find((b) => b.id === examBoardId)
    return found ? ok(found.subjectId) : fail('objetivo-desconocido')
  }

  /** Materias de sus inscripciones vigentes a cursada (aceptadas o pendientes,
      de períodos que no terminaron). */
  async function subjectsInCourse(
    siuId: string
  ): Promise<Result<Set<string>, 'persona-desconocida' | ExternalFailure>> {
    const enrollments = await siu.courseEnrollments(siuId)
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    const sections = await Promise.all(enrollments.value.map((e) => siu.section(e.sectionId)))
    if (sections.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')
    return ok(new Set(sections.flatMap((r) => (r.ok ? [r.value.subjectId] : []))))
  }

  /** La persona en el SIU y la materia del objetivo, que tiene que existir y ser de su facultad. */
  async function resolveTarget(
    personId: PersonId,
    target: Target
  ): Promise<Result<{ siuId: string; subjectId: string }, ReadError | TargetError>> {
    const mine = await siuPersonOf(personId)
    if (!mine.ok) return mine
    const { siuId, schoolId } = mine.value
    const subjectId =
      target.kind === 'comision'
        ? await sectionSubject(target.sectionId, schoolId)
        : await boardSubject(target.examBoardId, schoolId)
    if (!subjectId.ok) return subjectId
    return ok({ siuId, subjectId: subjectId.value })
  }

  /** Cursos del aula de una comisión, para devolver en el comprobante. Que no respondan no es un error. */
  async function sectionCourseIds(sectionId: string): Promise<string[]> {
    const courses = await classroom.coursesForSection(sectionId)
    return courses.ok ? courses.value.map((c) => c.id) : []
  }

  /** Lo que hace falta del aula para inscribir en una comisión: sus cursos y,
      si HackAI tiene que matricular, el id de Moodle de la persona. Se lee
      antes de tocar el SIU, así un Moodle caído no deja nada a medias. */
  async function classroomPlan(
    personId: PersonId,
    target: Target
  ): Promise<Result<{ courseIds: string[]; moodleId: string | null }, ExternalFailure>> {
    if (target.kind !== 'comision') return ok({ courseIds: [], moodleId: null })
    const mustEnrol = !siu.capabilities.enrolsInClassroom && classroom.capabilities.canEnrol
    if (!mustEnrol) return ok({ courseIds: await sectionCourseIds(target.sectionId), moodleId: null })
    const courses = await classroom.coursesForSection(target.sectionId)
    if (!courses.ok) return courses
    if (!courses.value.length) return ok({ courseIds: [], moodleId: null })
    // Sin cuenta de Moodle no se lo puede matricular, y sin matrícula no se inscribe: todo o nada.
    const moodleId = await people.accountIn(personId, 'moodle')
    if (!moodleId.ok) return fail('falla-externa')
    return ok({ courseIds: courses.value.map((c) => c.id), moodleId: moodleId.value })
  }

  /** Matricula en cada curso. Si uno falla, desmatricula los anteriores: todo o nada. */
  async function enrolAll(moodleId: string, courseIds: string[]): Promise<Result<null, ExternalFailure>> {
    const done: string[] = []
    for (const courseId of courseIds) {
      const result = await classroom.enrol(moodleId, courseId, 'student')
      if (!result.ok) {
        await Promise.all(done.map((id) => classroom.unenrol(moodleId, id)))
        return fail('falla-externa')
      }
      done.push(courseId)
    }
    return ok(null)
  }

  /** Desmatricula de cada curso. Si uno falla, vuelve a matricular los anteriores: todo o nada. */
  async function unenrolAll(moodleId: string, courseIds: string[]): Promise<Result<null, ExternalFailure>> {
    const done: string[] = []
    for (const courseId of courseIds) {
      const result = await classroom.unenrol(moodleId, courseId)
      if (!result.ok) {
        await Promise.all(done.map((id) => classroom.enrol(moodleId, id, 'student')))
        return fail('falla-externa')
      }
      done.push(courseId)
    }
    return ok(null)
  }

  const selfService = (target: Target) => ok({ kind: 'requiere-autogestion' as const, url: siu.selfServiceUrl(target) })

  /** Un error del SIU al inscribir o dar de baja, en el vocabulario de Cursada. */
  function siuFailure<E extends string>(
    error: E | 'no-encontrado'
  ): Exclude<E, 'no-encontrado'> | 'objetivo-desconocido' {
    return error === 'no-encontrado' ? 'objetivo-desconocido' : (error as Exclude<E, 'no-encontrado'>)
  }

  type Plan = { courseIds: string[]; moodleId: string | null }

  /** Si se puede pedir la inscripción: el objetivo existe, es de su facultad y,
      si es una comisión, no tiene otra vigente de la misma materia. Devuelve su id del SIU. */
  async function enrollable(personId: PersonId, target: Target): Promise<Result<string, EnrollError | ReadError>> {
    const resolved = await resolveTarget(personId, target)
    if (!resolved.ok) return resolved
    const { siuId, subjectId } = resolved.value
    if (target.kind !== 'comision') return ok(siuId)
    const taken = await subjectsInCourse(siuId)
    if (!taken.ok) return taken
    return taken.value.has(subjectId) ? fail('ya-inscripto') : ok(siuId)
  }

  /** Inscribe en el SIU y matricula en el aula. Si el aula falla, deshace la del SIU. */
  async function enrollBoth(siuId: string, target: Target, plan: Plan): Promise<Result<EnrollOutcome, EnrollError>> {
    const receipt = await siu.enroll(siuId, target)
    if (!receipt.ok) return receipt.error === 'no-soportado' ? selfService(target) : fail(siuFailure(receipt.error))
    const enrolled = plan.moodleId ? await enrolAll(plan.moodleId, plan.courseIds) : ok(null)
    if (enrolled.ok) return ok({ kind: 'inscripto', receipt: receipt.value, classroomCourseIds: plan.courseIds })
    // Todo o nada: el aula ya se deshizo; falta la inscripción del SIU.
    const undone = await siu.drop(siuId, target)
    if (!undone.ok) {
      console.error('enroll: no se pudo deshacer la inscripción del SIU', {
        transaction: receipt.value.transactionNumber,
        error: undone.error
      })
    }
    return enrolled
  }

  async function enroll(
    personId: PersonId,
    target: Target
  ): Promise<Result<EnrollOutcome, EnrollError | 'persona-desconocida' | NotImplemented>> {
    const siuId = await enrollable(personId, target)
    if (!siuId.ok) return siuId
    if (!siu.capabilities.canEnroll) return selfService(target)
    const plan = await classroomPlan(personId, target)
    if (!plan.ok) return plan
    return enrollBoth(siuId.value, target, plan.value)
  }

  /** Si la persona tiene una inscripción vigente a la comisión o la mesa. */
  async function isEnrolled(
    siuId: string,
    target: Target
  ): Promise<Result<boolean, 'persona-desconocida' | ExternalFailure>> {
    const enrollments =
      target.kind === 'comision' ? await siu.courseEnrollments(siuId) : await siu.examEnrollments(siuId)
    if (!enrollments.ok) return fail(asUnknownPerson(enrollments.error))
    return ok(
      enrollments.value.some((e) =>
        target.kind === 'comision'
          ? 'sectionId' in e && e.sectionId === target.sectionId
          : 'examBoardId' in e && e.examBoardId === target.examBoardId
      )
    )
  }

  /** Si se puede pedir la baja: el objetivo existe, es de su facultad y está inscripto. Devuelve su id del SIU. */
  async function droppable(personId: PersonId, target: Target): Promise<Result<string, DropError | ReadError>> {
    const resolved = await resolveTarget(personId, target)
    if (!resolved.ok) return resolved
    const enrolled = await isEnrolled(resolved.value.siuId, target)
    if (!enrolled.ok) return enrolled
    return enrolled.value ? ok(resolved.value.siuId) : fail('no-inscripto')
  }

  /** Desmatricula del aula y da de baja en el SIU. Si el SIU la rechaza, vuelve a matricular. */
  async function dropBoth(siuId: string, target: Target, plan: Plan): Promise<Result<DropOutcome, DropError>> {
    const { courseIds, moodleId } = plan
    const unenrolled = moodleId ? await unenrolAll(moodleId, courseIds) : ok(null)
    if (!unenrolled.ok) return unenrolled
    const receipt = await siu.drop(siuId, target)
    if (receipt.ok) return ok({ kind: 'baja', receipt: receipt.value })
    if (moodleId) await Promise.all(courseIds.map((id) => classroom.enrol(moodleId, id, 'student')))
    return receipt.error === 'no-soportado' ? selfService(target) : fail(siuFailure(receipt.error))
  }

  /** El camino inverso de `enroll`: primero desmatricula del aula y después da
      de baja en el SIU. Si el SIU rechaza la baja, vuelve a matricular: lo que
      se deshace sin riesgo es la matrícula, no la inscripción. */
  async function drop(
    personId: PersonId,
    target: Target
  ): Promise<Result<DropOutcome, DropError | 'persona-desconocida' | NotImplemented>> {
    if (!siu.capabilities.canEnroll) {
      const resolved = await resolveTarget(personId, target)
      return resolved.ok ? selfService(target) : resolved
    }
    const siuId = await droppable(personId, target)
    if (!siuId.ok) return siuId
    const plan = await classroomPlan(personId, target)
    if (!plan.ok) return plan
    return dropBoth(siuId.value, target, plan.value)
  }

  /** Materias de su facultad con comisiones en un período lectivo con la
      inscripción abierta, sin las que ya cursa: una sola comisión vigente por
      materia. Por ahora solo cursada: las mesas de examen que le sirven entran
      con la inscripción a finales (#20). */
  async function openEnrollments(personId: PersonId): Promise<Result<OpenEnrollment[], ReadError>> {
    const mine = await siuPersonOf(personId)
    if (!mine.ok) return mine
    const { siuId, schoolId } = mine.value
    const at = clock.now().toISOString()
    const [terms, taken] = await Promise.all([siu.terms(), subjectsInCourse(siuId)])
    if (!terms.ok) return terms
    if (!taken.ok) return taken
    const open = terms.value.filter((t) => t.enrollmentStart <= at && at <= t.enrollmentEnd)
    const offered = all(await Promise.all(open.map((t) => siu.sections({ schoolId, termId: t.id }))))
    if (!offered.ok) return offered

    const items: { term: SiuTerm; subjectId: string }[] = []
    open.forEach((term, i) => {
      const sections = offered.value[i]
      for (const subjectId of new Set(sections.map((s) => s.subjectId))) {
        if (!taken.value.has(subjectId)) items.push({ term, subjectId })
      }
    })
    const subjects = await Promise.all(items.map((item) => siu.subject(item.subjectId)))
    if (subjects.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')

    return ok(
      items
        .flatMap(({ term }, i): OpenEnrollment[] => {
          const subject = subjects[i]
          if (!subject.ok) return []
          return [
            {
              kind: 'cursada',
              subjectId: subject.value.id,
              subjectName: subject.value.name,
              opensAt: term.enrollmentStart,
              closesAt: term.enrollmentEnd
            }
          ]
        })
        .sort((a, b) => a.closesAt.localeCompare(b.closesAt) || a.subjectName.localeCompare(b.subjectName, 'es'))
    )
  }

  return {
    subjectsOf: (personId) => fresh(`subjectsOf:${personId}`, () => subjectsOf(personId)),
    sectionsOf: (personId) => fresh(`sectionsOf:${personId}`, () => sectionsOf(personId)),
    offer,
    enroll,
    drop,
    upcoming: notImplemented,
    openEnrollments: (personId) => fresh(`openEnrollments:${personId}`, () => openEnrollments(personId)),
    record: notImplemented,
    certificate: notImplemented
  }
}
