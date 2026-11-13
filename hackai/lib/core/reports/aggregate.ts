/* Los números del tablero: activos, ingresantes, graduados y bajas del año del
   reporte, por facultad, por carrera, por sede y por cohorte, la evolución año
   por año y cómo se reparten el avance y los créditos. Todo sale de la misma
   foto (Standing) de cada alumno, así los números de un gráfico y los del
   listado al que lleva siempre coinciden. */

import type { RiskKind } from '@/lib/core/reports/filters'
import { RISKS } from '@/lib/core/reports/filters'
import { FAILURES_RISK, type Standing } from '@/lib/core/reports/standing'
import type { RecordsCatalog, RecordsProgram, RecordsStudent } from '@/lib/ports/academic-records'

export type Counts = { active: number; entrants: number; graduates: number; dropouts: number }

export type DashboardTotals = Counts & {
  /** Avance promedio de los activos, en porcentaje. */
  averageProgress: number | null
  /** Créditos promedio de Vida Universitaria de los activos. */
  averageCredits: number | null
  /** Porcentaje de activos al día con Vida Universitaria: con los créditos que le tocan por los años que lleva. */
  universityLifeOnTrack: number | null
}

export type YearPoint = Counts & { year: number }

export type Dashboard = {
  totals: DashboardTotals
  bySchool: (Counts & { id: string; name: string; short: string })[]
  byProgram: (Counts & { id: string; name: string; school: string; averageProgress: number | null })[]
  byCampus: (Counts & { campus: string })[]
  /** Activos al corte por año de ingreso. */
  byCohort: { cohort: number; active: number }[]
  /** Año por año, desde la primera cohorte hasta el año del reporte. */
  evolution: YearPoint[]
  /** Activos por tramo de avance, de a 10 puntos. */
  progressBins: { from: number; to: number; count: number }[]
  /** Activos por créditos de Vida Universitaria. El último tramo junta los de 8 o más. */
  creditBins: { credits: number; label: string; count: number }[]
  /** Cuántos activos tienen cada indicador de riesgo. */
  risks: { kind: RiskKind; count: number }[]
  /** Desde cuántos aplazos cuenta el indicador `aplazos`. Lo usa su texto. */
  failuresThreshold: number
}

export type Row = { student: RecordsStudent; program: RecordsProgram; standing: Standing }

const zero = (): Counts => ({ active: 0, entrants: 0, graduates: 0, dropouts: 0 })

function add(counts: Counts, s: Standing) {
  if (s.status === 'activo') counts.active++
  if (s.entrant) counts.entrants++
  if (s.graduatedInYear) counts.graduates++
  if (s.droppedInYear) counts.dropouts++
}

const mean = (values: number[]) =>
  values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10

function onTrack(s: Standing, years: number): boolean {
  const expected = Math.min(1, Math.max(0, s.elapsed) / years)
  return s.credits >= Math.floor(s.creditsRequired * expected)
}

function totalsOf(rows: Row[]): DashboardTotals {
  const counts = zero()
  for (const row of rows) add(counts, row.standing)
  const active = rows.filter((r) => r.standing.status === 'activo')
  const track = active.filter((r) => onTrack(r.standing, r.program.years)).length
  return {
    ...counts,
    averageProgress: mean(active.map((r) => r.standing.progress)),
    averageCredits: mean(active.map((r) => r.standing.credits)),
    universityLifeOnTrack: active.length === 0 ? null : Math.round((track / active.length) * 100)
  }
}

function groupCounts<K extends string>(rows: Row[], key: (row: Row) => K): Map<K, Counts> {
  const groups = new Map<K, Counts>()
  for (const row of rows) {
    const k = key(row)
    const counts = groups.get(k) ?? zero()
    add(counts, row.standing)
    groups.set(k, counts)
  }
  return groups
}

function byProgram(rows: Row[], catalog: RecordsCatalog): Dashboard['byProgram'] {
  const counts = groupCounts(rows, (r) => r.program.id)
  const short = new Map(catalog.schools.map((s) => [s.id, s.short]))
  return catalog.programs
    .filter((p) => counts.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      school: short.get(p.schoolId) ?? '',
      ...(counts.get(p.id) as Counts),
      averageProgress: mean(
        rows.filter((r) => r.program.id === p.id && r.standing.status === 'activo').map((r) => r.standing.progress)
      )
    }))
    .sort((a, b) => b.active - a.active)
}

function bins(rows: Row[]): Pick<Dashboard, 'progressBins' | 'creditBins'> {
  const progressBins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 9, count: 0 }))
  progressBins[9].to = 100
  const creditBins = Array.from({ length: 9 }, (_, i) => ({
    credits: i,
    label: i === 8 ? '8 o más' : String(i),
    count: 0
  }))
  for (const { standing } of rows) {
    if (standing.status !== 'activo') continue
    progressBins[Math.min(9, Math.floor(standing.progress / 10))].count++
    creditBins[Math.min(8, standing.credits)].count++
  }
  return { progressBins, creditBins }
}

/** El estado de cada alumno al cierre de cada año, solo con fechas: sirve para la evolución sin recalcular el
    avance año por año. */
function evolutionOf(students: Row['student'][], firstYear: number, year: number, cutoff: string): YearPoint[] {
  const points: YearPoint[] = []
  for (let y = firstYear; y <= year; y++) {
    const point: YearPoint = { year: y, ...zero() }
    const end = y === year ? cutoff : `${y}-12-31`
    for (const s of students) if (s.cohort <= y) countYear(point, s, end)
    points.push(point)
  }
  return points
}

/** Suma a un alumno ya ingresado en los números de un año que cierra en `end`. */
function countYear(point: YearPoint, s: Row['student'], end: string) {
  const inYear = (date: string | null) => (date ?? '').startsWith(`${point.year}-`) && (date ?? '') <= end
  const before = (date: string | null) => date !== null && date <= end
  if (s.cohort === point.year) point.entrants++
  if (inYear(s.graduatedOn)) point.graduates++
  if (inYear(s.droppedOn)) point.dropouts++
  if (!before(s.graduatedOn) && !before(s.droppedOn)) point.active++
}

export function buildDashboard(
  rows: Row[],
  catalog: RecordsCatalog,
  context: { year: number; cutoff: string; firstCohort: number; profileMatches: RecordsStudent[] }
): Dashboard {
  const schoolCounts = groupCounts(rows, (r) => r.program.schoolId)
  const campusCounts = groupCounts(rows, (r) => r.student.campus)
  const cohorts = new Map<number, number>()
  for (const { student, standing } of rows) {
    if (standing.status === 'activo') cohorts.set(student.cohort, (cohorts.get(student.cohort) ?? 0) + 1)
  }
  const active = rows.filter((r) => r.standing.status === 'activo')
  return {
    totals: totalsOf(rows),
    bySchool: catalog.schools.map((s) => ({
      id: s.id,
      name: s.name,
      short: s.short,
      ...(schoolCounts.get(s.id) ?? zero())
    })),
    byProgram: byProgram(rows, catalog),
    byCampus: catalog.campuses.map((campus) => ({ campus, ...(campusCounts.get(campus) ?? zero()) })),
    byCohort: Array.from({ length: context.year - context.firstCohort + 1 }, (_, i) => {
      const cohort = context.firstCohort + i
      return { cohort, active: cohorts.get(cohort) ?? 0 }
    }),
    evolution: evolutionOf(context.profileMatches, context.firstCohort, context.year, context.cutoff),
    ...bins(rows),
    risks: RISKS.map((kind) => ({ kind, count: active.filter((r) => r.standing.risks.includes(kind)).length })),
    failuresThreshold: FAILURES_RISK
  }
}
