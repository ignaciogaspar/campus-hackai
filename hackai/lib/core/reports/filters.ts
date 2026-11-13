/* Los filtros de los reportes: qué alumnos entran en un reporte y al cierre de
   qué año. Se pueden elegir varias facultades, carreras, sedes y años de ingreso
   a la vez, y acotar por créditos de Vida Universitaria y por avance: lo que el
   SIU no deja hacer (un reporte por carrera y por año de ingreso). */
import type { RecordsProgram, RecordsStudent } from '@/lib/ports/academic-records'

/** El primer año que se puede pedir como año del reporte: antes hay pocas cohortes en el padrón. */
export const FIRST_REPORT_YEAR = 2016

export type RiskKind = 'atrasado' | 'aplazos' | 'sin-inscripciones' | 'inhabilitado' | 'vida-universitaria'

export const RISKS: readonly RiskKind[] = [
  'atrasado',
  'aplazos',
  'sin-inscripciones',
  'inhabilitado',
  'vida-universitaria'
]

/** Cómo entra un alumno en el año del reporte: activo al cierre, o ingresó, se recibió o se dio de baja ese año. */
export type ListStatus = 'activo' | 'ingresante' | 'graduado' | 'baja'

export const LIST_STATUSES: readonly ListStatus[] = ['activo', 'ingresante', 'graduado', 'baja']

export type ReportFilters = {
  /** El año del reporte: el tablero se arma al cierre de ese año (o a hoy, si es el actual). */
  year: number
  schools: string[]
  programs: string[]
  campuses: string[]
  /** Años de ingreso. Vacío es todos. */
  cohorts: number[]
  /** Solo para el listado. Vacío es activos. */
  statuses: ListStatus[]
  /** Solo para el listado: alumnos con alguno de estos indicadores. */
  risks: RiskKind[]
  creditsMin: number | null
  creditsMax: number | null
  /** Porcentaje de avance, de 0 a 100. */
  progressMin: number | null
  progressMax: number | null
  /** Solo para el listado: solo los alumnos en seguimiento, en cualquier estado. */
  followed: boolean
}

export type ReportFiltersInput = Partial<ReportFilters>

const unique = <T>(values: T[]) => [...new Set(values)]

function bounded(value: number | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Deja los filtros en valores que existen: el año entre el primero y el actual, solo facultades, carreras, sedes
    y cohortes conocidas, y los rangos en orden. */
export function normalizeFilters(
  input: ReportFiltersInput,
  known: { currentYear: number; schools: string[]; programs: string[]; campuses: string[]; firstCohort: number }
): ReportFilters {
  const year = bounded(input.year, FIRST_REPORT_YEAR, known.currentYear) ?? known.currentYear
  const among = (values: string[] | undefined, allowed: string[]) =>
    unique((values ?? []).filter((v) => allowed.includes(v)))
  const cohorts = unique(
    (input.cohorts ?? []).filter((c) => Number.isInteger(c) && c >= known.firstCohort && c <= year)
  )
  const creditsMin = bounded(input.creditsMin, 0, 99)
  const creditsMax = bounded(input.creditsMax, 0, 99)
  const progressMin = bounded(input.progressMin, 0, 100)
  const progressMax = bounded(input.progressMax, 0, 100)
  const ordered = (min: number | null, max: number | null) =>
    min !== null && max !== null && min > max ? [max, min] : [min, max]
  const [cMin, cMax] = ordered(creditsMin, creditsMax)
  const [pMin, pMax] = ordered(progressMin, progressMax)
  return {
    year,
    schools: among(input.schools, known.schools),
    programs: among(input.programs, known.programs),
    campuses: among(input.campuses, known.campuses),
    cohorts: cohorts.sort((a, b) => a - b),
    statuses: unique((input.statuses ?? []).filter((s) => LIST_STATUSES.includes(s))),
    risks: unique((input.risks ?? []).filter((r) => RISKS.includes(r))),
    creditsMin: cMin,
    creditsMax: cMax,
    progressMin: pMin,
    progressMax: pMax,
    followed: input.followed === true
  }
}

/** Lo que no cambia con el año del reporte: facultad, carrera, sede y año de ingreso. */
export function matchesProfile(student: RecordsStudent, program: RecordsProgram, filters: ReportFilters): boolean {
  if (filters.schools.length > 0 && !filters.schools.includes(program.schoolId)) return false
  if (filters.programs.length > 0 && !filters.programs.includes(student.programId)) return false
  if (filters.campuses.length > 0 && !filters.campuses.includes(student.campus)) return false
  return filters.cohorts.length === 0 || filters.cohorts.includes(student.cohort)
}

const within = (value: number, min: number | null, max: number | null) =>
  (min === null || value >= min) && (max === null || value <= max)

/** Créditos y avance, al cierre del año del reporte. */
export function matchesRanges(standing: { credits: number; progress: number }, filters: ReportFilters): boolean {
  return (
    within(standing.credits, filters.creditsMin, filters.creditsMax) &&
    within(standing.progress, filters.progressMin, filters.progressMax)
  )
}
