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

   Usa Personas para traducir personas a ids del SIU y de Moodle, y los puertos
   del SIU, del aula virtual y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuCertificateType, SiuPort, SiuSchedule, SiuSection, SiuSubject, SiuTerm } from '@/lib/ports/siu'
import { fail, notImplemented, ok, type ExternalFailure, type NotImplemented, type Result } from '@/lib/result'

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

/** Una comisión de la persona con su materia y su período lectivo. */
type Placed = { section: SiuSection; subject: SiuSubject; term: SiuTerm; current: boolean }

type Placement = { role: Role; placed: Placed[] }

export function createStudies({ people, siu, classroom, clock }: StudiesDeps): Studies {
  /** Lo último que se leyó de cada operación y persona, para cuando el sistema de origen no responde. */
  const lastRead = new Map<string, Fresh<unknown>>()

  async function fresh<T>(key: string, read: () => Promise<Result<T, ReadError>>): Promise<Result<Fresh<T>, ReadError>> {
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
      archivadas después (la más reciente primero), cada grupo por materia. */
  async function placementOf(personId: PersonId): Promise<Result<Placement, ReadError>> {
    const person = await people.get(personId)
    if (!person.ok) return person
    const siuId = await people.accountIn(personId, 'siu')
    if (!siuId.ok) return fail(siuId.error === 'sin-cuenta' ? 'persona-desconocida' : siuId.error)
    const { role, school } = person.value

    let sections: SiuSection[]
    if (role === 'profesor') {
      const taught = await siu.teacherSections(siuId.value)
      if (!taught.ok) return fail(taught.error === 'no-encontrado' ? 'persona-desconocida' : taught.error)
      sections = taught.value
    } else {
      const enrollments = await siu.courseEnrollments(siuId.value, { historic: true })
      if (!enrollments.ok) return fail(enrollments.error === 'no-encontrado' ? 'persona-desconocida' : enrollments.error)
      const ids = [...new Set(enrollments.value
        .filter((e) => e.status === 'aceptada' || e.status === 'pendiente')
        .map((e) => e.sectionId))]
      const found = await Promise.all(ids.map((id) => siu.section(id)))
      const failed = found.find((r) => !r.ok && r.error === 'falla-externa')
      if (failed) return fail('falla-externa')
      sections = found.flatMap((r) => r.ok ? [r.value] : []).filter((s) => s.schoolId === school.id)
    }

    const terms = await siu.terms()
    if (!terms.ok) return terms
    const subjectIds = [...new Set(sections.map((s) => s.subjectId))]
    const subjects = await Promise.all(subjectIds.map((id) => siu.subject(id)))
    if (subjects.some((r) => !r.ok && r.error === 'falla-externa')) return fail('falla-externa')

    const at = clock.now().toISOString()
    const placed = sections.flatMap((section): Placed[] => {
      const term = terms.value.find((t) => t.id === section.termId)
      const subject = subjects.find((r) => r.ok && r.value.id === section.subjectId)
      if (!term || !subject?.ok) return []
      return [{ section, subject: subject.value, term, current: term.end >= at }]
    })
    const byName = (a: Placed, b: Placed) => a.subject.name.localeCompare(b.subject.name, 'es') || a.section.name.localeCompare(b.section.name, 'es')
    const current = placed.filter((p) => p.current).sort((a, b) => a.term.start.localeCompare(b.term.start) || byName(a, b))
    const archived = placed.filter((p) => !p.current).sort((a, b) => b.term.end.localeCompare(a.term.end) || byName(a, b))
    return ok({ role, placed: [...current, ...archived] })
  }

  async function subjectsOf(personId: PersonId): Promise<Result<MySubjects, ReadError>> {
    const placement = await placementOf(personId)
    if (!placement.ok) return placement
    const courses = await Promise.all(placement.value.placed.map((p) => classroom.coursesForSection(p.section.id)))
    const failed = courses.find((r) => !r.ok)
    if (failed && !failed.ok) return fail(failed.error)

    const subjects = placement.value.placed.map(({ section, subject, term, current }, i) => {
      const found = courses[i]
      const item: MySubject = {
        subjectId: subject.id,
        code: subject.code,
        name: subject.name,
        schoolId: section.schoolId,
        termId: term.id,
        termName: term.name,
        sectionId: section.id,
        sectionName: section.name,
        role: placement.value.role,
        classroomCourseIds: found.ok ? found.value.map((c) => c.id) : [],
      }
      return { item, current }
    })
    return ok({
      current: subjects.filter((s) => s.current).map((s) => s.item),
      archived: subjects.filter((s) => !s.current).map((s) => s.item),
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
    const placement = await placementOf(personId)
    if (!placement.ok) return placement
    const teachers = await Promise.all(placement.value.placed.map((p) => teachersOf(p.section)))
    const failed = teachers.find((r) => !r.ok)
    if (failed && !failed.ok) return fail(failed.error)

    return ok(placement.value.placed.map(({ section }, i) => {
      const found = teachers[i]
      return {
        sectionId: section.id,
        name: section.name,
        subjectId: section.subjectId,
        schoolId: section.schoolId,
        termId: section.termId,
        role: placement.value.role,
        teachers: found.ok ? found.value : [],
      }
    }))
  }

  return {
    subjectsOf: (personId) => fresh(`subjectsOf:${personId}`, () => subjectsOf(personId)),
    sectionsOf: (personId) => fresh(`sectionsOf:${personId}`, () => sectionsOf(personId)),
    offer: notImplemented,
    enroll: notImplemented,
    drop: notImplemented,
    upcoming: notImplemented,
    openEnrollments: notImplemented,
    record: notImplemented,
    certificate: notImplemented,
  }
}
