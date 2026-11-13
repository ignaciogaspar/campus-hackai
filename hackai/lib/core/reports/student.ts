/* La ficha de un alumno para la Dirección de Estudios: lo que en el SIU está en
   la ficha del alumno, el reporte de plan de estudios y el de créditos por
   alumno, junto y al corte del año del reporte. El plan va por año con el
   estado de cada materia y lo que le falta aparte, para verlo de un vistazo. */
import { type Standing, sanctionActive } from '@/lib/core/reports/standing'
import type {
  RecordsCatalog,
  RecordsHistoryEntry,
  RecordsPlanSubject,
  RecordsProgram,
  RecordsSanction,
  RecordsStudent
} from '@/lib/ports/academic-records'

export type PlanSubjectStatus = 'aprobada' | 'regular' | 'en-curso' | 'pendiente'

export type PlanSubjectState = {
  id: string
  name: string
  year: number
  term: 1 | 2
  kind: RecordsPlanSubject['kind']
  status: PlanSubjectStatus
  /** La nota con que la aprobó. */
  grade: number | null
  /** Cuándo la aprobó o regularizó. */
  date: string | null
}

export type HistoryLine = RecordsHistoryEntry & { subjectName: string }

/** Una inscripción del año del reporte: a una cursada o a un examen, con su resultado si ya lo tiene. */
export type EnrollmentLine = {
  subjectId: string
  subjectName: string
  kind: 'cursada' | 'examen'
  date: string
  /** El resultado, o `null` si está en curso o la mesa no se tomó. */
  result: RecordsHistoryEntry['result'] | null
  grade: number | null
}

export type StudentProfile = {
  id: string
  name: string
  email: string
  cohort: number
  campus: string
  school: { id: string; name: string; short: string }
  program: { id: string; name: string; planName: string; years: number }
  admittedOn: string
  graduatedOn: string | null
  droppedOn: string | null
  dropReason: string | null
  /** Las propuestas a las que está vinculado: el curso de ingreso y la carrera. */
  proposals: { name: string; state: string; date: string; grade: number | null }[]
}

export type StudentDetail = {
  profile: StudentProfile
  standing: Standing
  plan: { years: { year: number; subjects: PlanSubjectState[] }[]; electives: PlanSubjectState[] }
  /** Las obligatorias sin aprobar y, si le faltan optativas, las que puede elegir. */
  missing: PlanSubjectState[]
  history: HistoryLine[]
  enrollments: EnrollmentLine[]
  partialGrades: { subjectName: string; name: string; date: string; grade: number | null }[]
  sanctions: (RecordsSanction & { active: boolean })[]
  universityLife: {
    credits: number
    required: number
    activities: { name: string; credits: number; date: string; modality: 'presencial' | 'virtual' }[]
  }
}

function subjectNames(catalog: RecordsCatalog): Map<string, string> {
  const names = new Map<string, string>()
  for (const program of catalog.programs) for (const s of program.subjects) names.set(s.id, s.name)
  return names
}

type Tally = { approved: Map<string, RecordsHistoryEntry>; regular: Map<string, RecordsHistoryEntry> }

function tallyOf(history: RecordsHistoryEntry[]): Tally {
  const tally: Tally = { approved: new Map(), regular: new Map() }
  for (const e of history) {
    const approved =
      e.instance === 'promocion' ||
      e.instance === 'equivalencia' ||
      (e.instance === 'examen' && e.result === 'aprobado')
    if (approved) tally.approved.set(e.subjectId, e)
    else if (e.instance === 'cursada' && e.result === 'regular') tally.regular.set(e.subjectId, e)
  }
  return tally
}

function stateOf(subject: RecordsPlanSubject, tally: Tally, inCourse: Set<string>): PlanSubjectState {
  const approved = tally.approved.get(subject.id)
  const regular = tally.regular.get(subject.id)
  const base = { id: subject.id, name: subject.name, year: subject.year, term: subject.term, kind: subject.kind }
  if (approved) return { ...base, status: 'aprobada', grade: approved.grade, date: approved.date }
  if (regular) return { ...base, status: 'regular', grade: null, date: regular.date }
  if (inCourse.has(subject.id)) return { ...base, status: 'en-curso', grade: null, date: null }
  return { ...base, status: 'pendiente', grade: null, date: null }
}

function planOf(program: RecordsProgram, tally: Tally, inCourse: Set<string>): StudentDetail['plan'] {
  const states = program.subjects.map((s) => stateOf(s, tally, inCourse))
  const years = Array.from({ length: program.years }, (_, i) => ({
    year: i + 1,
    subjects: states.filter((s) => s.kind === 'obligatoria' && s.year === i + 1)
  }))
  return { years, electives: states.filter((s) => s.kind === 'optativa') }
}

function missingOf(plan: StudentDetail['plan'], electivesRequired: number): PlanSubjectState[] {
  const mandatory = plan.years.flatMap((y) => y.subjects).filter((s) => s.status !== 'aprobada')
  const approvedElectives = plan.electives.filter((s) => s.status === 'aprobada').length
  const electives = approvedElectives >= electivesRequired ? [] : plan.electives.filter((s) => s.status !== 'aprobada')
  return [...mandatory, ...electives]
}

function enrollmentsOf(
  student: RecordsStudent,
  history: RecordsHistoryEntry[],
  year: number,
  cutoff: string,
  name: (id: string) => string
): EnrollmentLine[] {
  const prefix = `${year}-`
  const done: EnrollmentLine[] = history
    .filter((e) => e.date.startsWith(prefix) && (e.instance === 'cursada' || e.instance === 'examen'))
    .map((e) => ({
      subjectId: e.subjectId,
      subjectName: name(e.subjectId),
      kind: e.instance === 'cursada' ? 'cursada' : 'examen',
      date: e.date,
      result: e.result,
      grade: e.grade
    }))
  const open: EnrollmentLine[] = student.enrollments
    .filter((e) => e.date.startsWith(prefix) && e.date <= cutoff)
    .map((e) => ({
      subjectId: e.subjectId,
      subjectName: name(e.subjectId),
      kind: e.kind,
      date: e.date,
      result: null,
      grade: null
    }))
  return [...open, ...done].sort((a, b) => b.date.localeCompare(a.date))
}

function profileOf(
  student: RecordsStudent,
  program: RecordsProgram,
  catalog: RecordsCatalog,
  cutoff: string
): StudentProfile {
  const school = catalog.schools.find((s) => s.id === program.schoolId) ?? {
    id: program.schoolId,
    name: program.schoolId,
    short: ''
  }
  const graduatedOn = student.graduatedOn && student.graduatedOn <= cutoff ? student.graduatedOn : null
  const droppedOn = student.droppedOn && student.droppedOn <= cutoff ? student.droppedOn : null
  const programState = graduatedOn ? 'Egresado' : droppedOn ? 'Baja' : 'Activa'
  return {
    id: student.id,
    name: `${student.surname}, ${student.names}`,
    email: student.email,
    cohort: student.cohort,
    campus: student.campus,
    school,
    program: { id: program.id, name: program.name, planName: program.planName, years: program.years },
    admittedOn: student.admittedOn,
    graduatedOn,
    droppedOn,
    dropReason: droppedOn ? student.dropReason : null,
    proposals: [
      { name: `${program.name} (${program.planName})`, state: programState, date: student.admittedOn, grade: null },
      {
        name: `Curso de ingreso: ${school.name}`,
        state: 'Aprobado',
        date: student.admissionCourse.date,
        grade: student.admissionCourse.grade
      }
    ]
  }
}

/** La ficha completa al corte. */
export function studentDetail(
  student: RecordsStudent,
  program: RecordsProgram,
  catalog: RecordsCatalog,
  standing: Standing,
  context: { year: number; cutoff: string }
): StudentDetail {
  const { year, cutoff } = context
  const names = subjectNames(catalog)
  const name = (id: string) => names.get(id) ?? id
  const history = student.history.filter((e) => e.date <= cutoff)
  const tally = tallyOf(history)
  const inCourse = new Set(
    student.enrollments
      .filter((e) => e.kind === 'cursada' && e.date <= cutoff && e.date.startsWith(`${year}-`))
      .map((e) => e.subjectId)
  )
  const plan = planOf(program, tally, standing.status === 'activo' ? inCourse : new Set())
  const activities = new Map(catalog.activities.map((a) => [a.id, a]))
  return {
    profile: profileOf(student, program, catalog, cutoff),
    standing,
    plan,
    missing: standing.status === 'graduado' ? [] : missingOf(plan, program.electivesRequired),
    history: history.map((e) => ({ ...e, subjectName: name(e.subjectId) })).reverse(),
    enrollments: enrollmentsOf(student, history, year, cutoff, name),
    partialGrades: student.partialGrades
      .filter((g) => g.date <= cutoff && g.date.startsWith(`${year}-`))
      .map((g) => ({ subjectName: name(g.subjectId), name: g.name, date: g.date, grade: g.grade })),
    sanctions: student.sanctions
      .filter((s) => s.from <= cutoff)
      .map((s) => ({ ...s, active: sanctionActive(s, cutoff) }))
      .sort((a, b) => b.from.localeCompare(a.from)),
    universityLife: {
      credits: standing.credits,
      required: program.creditsRequired,
      activities: student.activities
        .filter((a) => a.date <= cutoff)
        .map((a) => {
          const activity = activities.get(a.activityId)
          return {
            name: activity?.name ?? a.activityId,
            credits: a.credits,
            date: a.date,
            modality: activity?.modality ?? 'presencial'
          }
        })
        .reverse()
    }
  }
}
