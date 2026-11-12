/* La carrera del alumno: cada materia del plan (y las que cursó fuera de él)
   con su estado, sus notas y lo que le falta, y el avance de la carrera. Son
   cuentas sin lecturas: Cursada lee el SIU y le pasa lo leído a `buildCareer`.

   - Estado de una materia, en este orden: aprobada por promoción
     («promocionada») o por final o equivalencia («aprobada»); si no, «en
     curso» si tiene una comisión de un período que no terminó; si no,
     «regular» si tiene la cursada regular (le falta el final); si no,
     «pendiente».
   - Las notas de la materia son las de la comisión más reciente: cada
     evaluación del cronograma con su nota, si está cargada en la historia o en
     actuación provisoria. Sin cronograma (la API real), salen las notas
     cargadas con el nombre genérico.
   - El avance cuenta las obligatorias aprobadas y, hasta lo que pide el plan,
     las optativas y las actividades de vida universitaria. */
import type { SiuAssessment, SiuHistoryEntry, SiuPlanSubjectKind, SiuStudyPlan } from '@/lib/ports/siu'

/** Cómo cuenta una materia: obligatoria, optativa, de vida universitaria o, si no está en su plan, fuera del plan. */
export type PlanKind = SiuPlanSubjectKind | 'fuera-del-plan'

export type SubjectStatus = 'promocionada' | 'aprobada' | 'regular' | 'en-curso' | 'pendiente'

/** Una evaluación de la materia con su nota, si ya está cargada. */
export type SubjectAssessment = {
  name: string
  /** `null` si el SIU no expone el cronograma y no se sabe qué fue. */
  kind: SiuAssessment['kind'] | null
  date: string
  grade: number | null
  /** La nota está cargada. Cargada y sin nota es un ausente. */
  graded: boolean
  past: boolean
  source: 'historia' | 'actuacion-provisoria' | null
}

/** Cómo viene el alumno en una materia. */
export type SubjectStanding = {
  subjectId: string
  code: string
  name: string
  /** Año de la carrera según el plan. `null` si se hace en cualquier año o no está en el plan. */
  year: number | null
  kind: PlanKind
  status: SubjectStatus
  /** Año calendario de lo último que hizo en la materia: la aprobó, la cursó o la está cursando. `null` si nunca la cursó. */
  academicYear: number | null
  termName: string | null
  sectionName: string | null
  assessments: SubjectAssessment[]
  /** Nota de la cursada regular, si la tiene. */
  courseGrade: number | null
  /** Nota con la que la aprobó: final, promoción o equivalencia. */
  finalGrade: number | null
  approvedAt: string | null
  approval: 'promocion' | 'examen' | 'equivalencia' | null
  /** Fecha del final al que está inscripto y todavía no rindió. */
  examDate: string | null
}

export type CareerProgress = { approved: number; total: number }

export type Career = {
  program: { id: string; name: string; plan: string; years: number } | null
  /** Por año de la carrera; las de cualquier año y las de fuera del plan, al final. */
  subjects: SubjectStanding[]
  /** Promedio de las materias aprobadas con nota, a dos decimales. */
  average: number | null
  required: CareerProgress
  electives: CareerProgress
  universityLife: CareerProgress
  /** Cuánto de la carrera está aprobado, de 0 a 100. */
  percent: number
}

export const EMPTY_CAREER: Career = {
  program: null,
  subjects: [],
  average: null,
  required: { approved: 0, total: 0 },
  electives: { approved: 0, total: 0 },
  universityLife: { approved: 0, total: 0 },
  percent: 0
}

/** Una comisión que cursó o cursa, con lo que hace falta para la carrera. */
export type TakenSection = {
  subjectId: string
  sectionId: string
  sectionName: string
  termName: string
  termStart: string
  current: boolean
}

/** Una nota de evaluación ya leída, de la historia o de actuación provisoria. */
export type LoadedGrade = {
  sectionId: string
  assessmentId: string
  grade: number | null
  date: string
  source: 'historia' | 'actuacion-provisoria'
}

export type Approved = {
  date: string
  grade: number | null
  approval: 'promocion' | 'examen' | 'equivalencia'
}

export type CareerInput = {
  now: string
  program: { id: string; name: string } | null
  plan: SiuStudyPlan | null
  subjects: Map<string, { code: string; name: string }>
  /** Las comisiones de la más importante a la menos: actuales primero y después la más reciente. */
  sections: TakenSection[]
  history: SiuHistoryEntry[]
  approved: Map<string, Approved>
  grades: LoadedGrade[]
  /** Cronograma de cada comisión; sin la comisión, el SIU no lo expone. */
  schedules: Map<string, SiuAssessment[]>
  /** Fecha de la mesa a la que está inscripto, por materia. */
  exams: Map<string, string>
  genericName: string
}

const KIND_ORDER: PlanKind[] = ['obligatoria', 'optativa', 'vida-universitaria', 'fuera-del-plan']

const yearOf = (iso: string) => Number(iso.slice(0, 4))

/** La cursada regular más reciente de la materia. */
function latestRegular(history: SiuHistoryEntry[], subjectId: string): SiuHistoryEntry | null {
  return (
    history
      .filter((h) => h.subjectId === subjectId && h.type === 'cursada' && h.result === 'regular')
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  )
}

function statusOf(approved: Approved | undefined, section: TakenSection | undefined, regular: boolean): SubjectStatus {
  if (approved) return approved.approval === 'promocion' ? 'promocionada' : 'aprobada'
  if (section?.current) return 'en-curso'
  return regular ? 'regular' : 'pendiente'
}

/** Las evaluaciones de una comisión con sus notas: las del cronograma y, si falta, las cargadas sueltas. */
function assessmentsOf(section: TakenSection | undefined, input: CareerInput): SubjectAssessment[] {
  if (!section) return []
  const loaded = input.grades.filter((g) => g.sectionId === section.sectionId)
  const gradeOf = (assessmentId: string) =>
    loaded.filter((g) => g.assessmentId === assessmentId).sort((a, b) => b.date.localeCompare(a.date))[0]
  const schedule = input.schedules.get(section.sectionId) ?? []
  const scheduled = schedule.map((a): SubjectAssessment => {
    const found = gradeOf(a.id)
    return {
      name: a.name,
      kind: a.kind,
      date: a.date,
      grade: found?.grade ?? null,
      graded: Boolean(found),
      past: a.date < input.now,
      source: found?.source ?? null
    }
  })
  const loose = loaded
    .filter((g) => !schedule.some((a) => a.id === g.assessmentId))
    .map(
      (g): SubjectAssessment => ({
        name: input.genericName,
        kind: null,
        date: g.date,
        grade: g.grade,
        graded: true,
        past: true,
        source: g.source
      })
    )
  return [...scheduled, ...loose].sort((a, b) => a.date.localeCompare(b.date))
}

/** El año calendario de lo último: la aprobación, la comisión o la cursada regular. */
function academicYearOf(
  approved: Approved | undefined,
  section: TakenSection | undefined,
  regular: SiuHistoryEntry | null
): number | null {
  const dates = [approved?.date, section?.termStart, regular?.date].filter((d): d is string => Boolean(d))
  if (!dates.length) return null
  return yearOf(dates.sort().at(-1)!)
}

function standingOf(subjectId: string, input: CareerInput): SubjectStanding {
  const entry = input.plan?.subjects.find((s) => s.subjectId === subjectId)
  const subject = input.subjects.get(subjectId)
  const section = input.sections.find((s) => s.subjectId === subjectId)
  const approved = input.approved.get(subjectId)
  const regular = latestRegular(input.history, subjectId)
  return {
    subjectId,
    code: subject?.code ?? subjectId.toUpperCase(),
    name: subject?.name ?? input.genericName,
    year: entry?.year ?? null,
    kind: entry?.kind ?? 'fuera-del-plan',
    status: statusOf(approved, section, Boolean(regular)),
    academicYear: academicYearOf(approved, section, regular),
    termName: section?.termName ?? null,
    sectionName: section?.sectionName ?? null,
    assessments: assessmentsOf(section, input),
    courseGrade: regular?.grade ?? null,
    finalGrade: approved?.grade ?? null,
    approvedAt: approved?.date ?? null,
    approval: approved?.approval ?? null,
    examDate: input.exams.get(subjectId) ?? null
  }
}

const isApproved = (s: SubjectStanding) => s.status === 'promocionada' || s.status === 'aprobada'

function progressOf(subjects: SubjectStanding[], kind: PlanKind, required: number | null): CareerProgress {
  const ofKind = subjects.filter((s) => s.kind === kind)
  const total = required ?? ofKind.length
  return { approved: Math.min(ofKind.filter(isApproved).length, total), total }
}

const bySubjectOrder = (a: SubjectStanding, b: SubjectStanding) =>
  (a.year ?? 99) - (b.year ?? 99) ||
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
  a.name.localeCompare(b.name, 'es')

export function buildCareer(input: CareerInput): Career {
  const ids = new Set([
    ...(input.plan?.subjects.map((s) => s.subjectId) ?? []),
    ...input.sections.map((s) => s.subjectId),
    ...input.history.filter((h) => h.type !== 'evaluacion').map((h) => h.subjectId)
  ])
  const subjects = [...ids].map((id) => standingOf(id, input)).sort(bySubjectOrder)
  const required = progressOf(subjects, 'obligatoria', null)
  const electives = progressOf(subjects, 'optativa', input.plan?.electivesRequired ?? 0)
  const universityLife = progressOf(subjects, 'vida-universitaria', input.plan?.universityLifeRequired ?? 0)
  const total = required.total + electives.total + universityLife.total
  const done = required.approved + electives.approved + universityLife.approved
  const grades = subjects.flatMap((s) => (isApproved(s) && s.finalGrade !== null ? [s.finalGrade] : []))
  return {
    program:
      input.program && input.plan
        ? { id: input.program.id, name: input.program.name, plan: input.plan.name, years: input.plan.years }
        : null,
    subjects,
    average: grades.length ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100 : null,
    required,
    electives,
    universityLife,
    percent: total ? Math.round((done / total) * 100) : 0
  }
}
