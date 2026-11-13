/* Cómo estaba un alumno a una fecha de corte: su estado (activo, egresado o
   baja), su avance, sus créditos de Vida Universitaria, sus aplazos, su promedio
   y los indicadores de riesgo. Es lo que necesitan el tablero, el listado y la
   ficha: se calcula al leer, con solo lo que pasó hasta el corte, así un reporte
   de 2021 muestra al alumno como estaba al cierre de 2021. */
import type { ListStatus, RiskKind } from '@/lib/core/reports/filters'
import type { RecordsProgram, RecordsSanction, RecordsStudent } from '@/lib/ports/academic-records'

export type ReportStatus = 'activo' | 'graduado' | 'baja'

/** La fecha de corte de un año del reporte: el 31 de diciembre o, en el año actual, hoy. */
export function cutoffOf(year: number, today: string): string {
  const end = `${year}-12-31`
  return end < today ? end : today
}

export type Standing = {
  status: ReportStatus
  /** Ingresó el año del reporte. */
  entrant: boolean
  graduatedInYear: boolean
  droppedInYear: boolean
  /** Obligatorias y optativas (hasta lo que pide el plan) aprobadas, en porcentaje entero. */
  progress: number
  mandatoryApproved: number
  mandatoryTotal: number
  electivesApproved: number
  electivesRequired: number
  /** Cuántas materias le faltan: obligatorias sin aprobar y optativas que le quedan por elegir. */
  missing: number
  credits: number
  creditsRequired: number
  /** Finales desaprobados. */
  failures: number
  /** Promedio de las aprobadas, sin aplazos. */
  average: number | null
  /** Promedio con los aplazos. */
  averageWithFailures: number | null
  /** Con una inhabilitación administrativa vigente al corte. */
  disabled: boolean
  /** Rindió, cursó o se inscribió a algo el año del reporte. */
  activeInYear: boolean
  /** Años desde el ingreso hasta el corte, con fracción. */
  elapsed: number
  risks: RiskKind[]
}

/** Cuántos finales desaprobados ya son un riesgo. */
export const FAILURES_RISK = 3

const isApproval = (instance: string, result: string) =>
  instance === 'promocion' || instance === 'equivalencia' || (instance === 'examen' && result === 'aprobado')

function statusAt(student: RecordsStudent, cutoff: string): ReportStatus {
  if (student.graduatedOn && student.graduatedOn <= cutoff) return 'graduado'
  if (student.droppedOn && student.droppedOn <= cutoff) return 'baja'
  return 'activo'
}

/** Los años desde el ingreso (1 de marzo) hasta el corte. */
function elapsedYears(cohort: number, cutoff: string): number {
  const [y, m, d] = cutoff.split('-').map(Number)
  return y - cohort + (m - 3 + d / 31) / 12
}

export function sanctionActive(sanction: RecordsSanction, cutoff: string): boolean {
  return sanction.from <= cutoff && (sanction.to === null || sanction.to > cutoff)
}

const round2 = (n: number) => Math.round(n * 100) / 100
const average = (values: number[]) =>
  values.length === 0 ? null : round2(values.reduce((a, b) => a + b, 0) / values.length)

type HistoryTally = { approved: Set<string>; grades: number[]; failureGrades: number[]; activeInYear: boolean }

function tallyHistory(student: RecordsStudent, cutoff: string, year: number): HistoryTally {
  const tally: HistoryTally = { approved: new Set(), grades: [], failureGrades: [], activeInYear: false }
  const yearPrefix = `${year}-`
  for (const entry of student.history) {
    if (entry.date > cutoff) break
    if (entry.date.startsWith(yearPrefix)) tally.activeInYear = true
    if (isApproval(entry.instance, entry.result)) {
      tally.approved.add(entry.subjectId)
      if (entry.grade !== null) tally.grades.push(entry.grade)
    } else if (entry.instance === 'examen' && entry.result === 'desaprobado') {
      tally.failureGrades.push(entry.grade ?? 1)
    }
  }
  const enrolled = student.enrollments.some((e) => e.date <= cutoff && e.date.startsWith(yearPrefix))
  tally.activeInYear ||= enrolled
  return tally
}

function creditsAt(student: RecordsStudent, cutoff: string): number {
  let credits = 0
  for (const activity of student.activities) if (activity.date <= cutoff) credits += activity.credits
  return credits
}

function risksOf(standing: Omit<Standing, 'risks'>, years: number): RiskKind[] {
  if (standing.status !== 'activo') return []
  const expected = Math.min(1, Math.max(0, standing.elapsed) / years)
  const risks: RiskKind[] = []
  const overdue = standing.elapsed > years + 1
  if (standing.elapsed >= 1 && (overdue || standing.progress / 100 < expected - 0.25)) risks.push('atrasado')
  if (standing.failures >= FAILURES_RISK) risks.push('aplazos')
  if (!standing.activeInYear) risks.push('sin-inscripciones')
  if (standing.disabled) risks.push('inhabilitado')
  if (standing.elapsed >= 2 && standing.credits < (standing.creditsRequired * expected) / 2)
    risks.push('vida-universitaria')
  return risks
}

/** El alumno al corte del año del reporte. */
export function standingOf(student: RecordsStudent, program: RecordsProgram, year: number, cutoff: string): Standing {
  const tally = tallyHistory(student, cutoff, year)
  let mandatoryTotal = 0
  let mandatoryApproved = 0
  let electives = 0
  for (const subject of program.subjects) {
    const approved = tally.approved.has(subject.id)
    if (subject.kind === 'obligatoria') {
      mandatoryTotal++
      if (approved) mandatoryApproved++
    } else if (approved) electives++
  }
  const electivesApproved = Math.min(electives, program.electivesRequired)
  const done = mandatoryApproved + electivesApproved
  const total = mandatoryTotal + program.electivesRequired
  const status = statusAt(student, cutoff)
  const base = {
    status,
    entrant: student.cohort === year,
    graduatedInYear: status === 'graduado' && student.graduatedOn?.startsWith(`${year}-`) === true,
    droppedInYear: status === 'baja' && student.droppedOn?.startsWith(`${year}-`) === true,
    progress: total === 0 ? 0 : Math.floor((done / total) * 100),
    mandatoryApproved,
    mandatoryTotal,
    electivesApproved,
    electivesRequired: program.electivesRequired,
    missing: total - done,
    credits: creditsAt(student, cutoff),
    creditsRequired: program.creditsRequired,
    failures: tally.failureGrades.length,
    average: average(tally.grades),
    averageWithFailures: average([...tally.grades, ...tally.failureGrades]),
    disabled: student.sanctions.some((s) => s.kind === 'administrativa' && sanctionActive(s, cutoff)),
    activeInYear: tally.activeInYear,
    elapsed: elapsedYears(student.cohort, cutoff)
  }
  return { ...base, risks: risksOf(base, program.years) }
}

/** Si el alumno entra en alguno de los estados pedidos del año del reporte. Sin estados, solo los activos. */
export function inStatuses(standing: Standing, statuses: ListStatus[]): boolean {
  const wanted = statuses.length === 0 ? ['activo'] : statuses
  return wanted.some(
    (s) =>
      (s === 'activo' && standing.status === 'activo') ||
      (s === 'ingresante' && standing.entrant) ||
      (s === 'graduado' && standing.graduatedInYear) ||
      (s === 'baja' && standing.droppedInYear)
  )
}
