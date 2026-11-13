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
     las optativas y las actividades de vida universitaria.
   - Además, lo que pide la carrera en otras unidades (requirements.ts): los
     créditos de las actividades de vida universitaria aprobadas y las horas de
     las optativas aprobadas. */
import { requirementsOf } from '@/lib/core/studies/requirements'
import type { SiuAssessment, SiuHistoryEntry, SiuPlanSubjectKind, SiuStudyPlan } from '@/lib/ports/siu'

/** Cómo cuenta una materia: obligatoria, optativa, de vida universitaria o, si no está en su plan, fuera del plan. */
export type PlanKind = SiuPlanSubjectKind | 'fuera-del-plan'

export type SubjectStatus = 'promocionada' | 'aprobada' | 'regular' | 'en-curso' | 'pendiente'

/** Una evaluación de la materia con su nota, si ya está cargada. */
export type SubjectAssessment = {
  /** El id de la evaluación en el cronograma del SIU, o de la tarea de HackAI. Es null si el SIU no lo dice. */
  id: string | null
  name: string
  /** `null` si el SIU no expone el cronograma y no se sabe qué fue. */
  kind: SiuAssessment['kind'] | null
  date: string
  grade: number | null
  /** La nota está cargada. Cargada y sin nota es un ausente. */
  graded: boolean
  past: boolean
  /** De dónde viene la nota: Cursada solo da las del SIU; 'hackai' es de una nota publicada en Seguimiento. */
  source: 'historia' | 'actuacion-provisoria' | 'hackai' | null
  /** El comentario del docente, entero. Cursada no lo tiene: solo viene de las notas de HackAI. */
  comment: string | null
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
  /** La comisión más reciente de la materia, la de las notas; es null si nunca la cursó. */
  sectionId: string | null
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
  /** Créditos de vida universitaria: los de las actividades aprobadas, sobre los que pide la carrera. */
  universityLifeCredits: CareerProgress
  /** Horas de optativas y seminarios aprobadas, sobre las que pide la carrera. */
  electiveHours: CareerProgress
  /** Cuánto de la carrera está aprobado, de 0 a 100. */
  percent: number
  /** Si `percent` es el del SIU; si no, una estimación de HackAI con las materias del plan. */
  percentFromSiu: boolean
}

export const EMPTY_CAREER: Career = {
  program: null,
  subjects: [],
  average: null,
  required: { approved: 0, total: 0 },
  electives: { approved: 0, total: 0 },
  universityLife: { approved: 0, total: 0 },
  universityLifeCredits: { approved: 0, total: 0 },
  electiveHours: { approved: 0, total: 0 },
  percent: 0,
  percentFromSiu: false
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
  program: { id: string; name: string; progressPercent?: number | null } | null
  plan: SiuStudyPlan | null
  /** `credits`: los que da una actividad de vida universitaria, o las horas de una optativa; `null` o sin dato
      en una materia obligatoria. */
  subjects: Map<string, { code: string; name: string; credits?: number | null }>
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
      id: a.id,
      name: a.name,
      kind: a.kind,
      date: a.date,
      grade: found?.grade ?? null,
      graded: Boolean(found),
      past: a.date < input.now,
      source: found?.source ?? null,
      comment: null
    }
  })
  const loose = loaded
    .filter((g) => !schedule.some((a) => a.id === g.assessmentId))
    .map(
      (g): SubjectAssessment => ({
        id: g.assessmentId,
        name: input.genericName,
        kind: null,
        date: g.date,
        grade: g.grade,
        graded: true,
        past: true,
        source: g.source,
        comment: null
      })
    )
  return [...scheduled, ...loose].sort((a, b) => a.date.localeCompare(b.date))
}

/** El año de un período lectivo: el que dice su nombre («Anual - 2026») y, si no trae, el de su inicio. El
    SIU publica el anual con inicio en diciembre del año anterior, así que la fecha sola lo corre un año.
    Los períodos que el SIU publica hoy traen un solo año; si un nombre trajera dos, vale el más alto. */
function termYearOf(section: TakenSection | undefined): number | null {
  if (!section) return null
  const named = [...section.termName.matchAll(/\b20\d{2}\b/g)].map((m) => Number(m[0]))
  if (named.length) return Math.max(...named)
  return section.termStart ? yearOf(section.termStart) : null
}

/** El año de lo último: la aprobación, la comisión o la cursada regular. */
function academicYearOf(
  approved: Approved | undefined,
  section: TakenSection | undefined,
  regular: SiuHistoryEntry | null
): number | null {
  const years = [approved?.date, regular?.date].filter((d): d is string => Boolean(d)).map(yearOf)
  const termYear = termYearOf(section)
  if (termYear !== null) years.push(termYear)
  return years.length ? Math.max(...years) : null
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
    sectionId: section?.sectionId ?? null,
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

/** Créditos de las actividades de vida universitaria aprobadas y horas de las optativas aprobadas, sobre lo que
    pide la carrera. */
function unitsOf(
  subjects: SubjectStanding[],
  input: CareerInput
): Pick<Career, 'universityLifeCredits' | 'electiveHours'> {
  const rules = requirementsOf(input.program?.id ?? null)
  const approvedOf = (kind: PlanKind) => subjects.filter((s) => s.kind === kind && isApproved(s))
  const credits = approvedOf('vida-universitaria').reduce(
    (sum, s) => sum + (input.subjects.get(s.subjectId)?.credits ?? 0),
    0
  )
  // Las horas de cada optativa, si el SIU las da (en `credits`); si no, las de una optativa típica.
  const hours = approvedOf('optativa').reduce(
    (sum, s) => sum + (input.subjects.get(s.subjectId)?.credits ?? rules.hoursPerElective),
    0
  )
  const requiredHours =
    input.plan?.electiveHoursRequired ?? (input.plan?.electivesRequired ?? 0) * rules.hoursPerElective
  return {
    universityLifeCredits: {
      approved: credits,
      total: input.plan?.universityLifeCreditsRequired ?? rules.universityLifeCredits
    },
    electiveHours: { approved: hours, total: requiredHours }
  }
}

/** El avance del SIU, si lo da; si no, la estimación con las materias del plan. */
function percentOf(input: CareerInput, estimate: number): Pick<Career, 'percent' | 'percentFromSiu'> {
  const fromSiu = input.program?.progressPercent
  return typeof fromSiu === 'number'
    ? { percent: Math.round(fromSiu), percentFromSiu: true }
    : { percent: estimate, percentFromSiu: false }
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
    ...unitsOf(subjects, input),
    ...percentOf(input, total ? Math.round((done / total) * 100) : 0)
  }
}
