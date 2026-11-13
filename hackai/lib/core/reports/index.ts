/* Reportes (reports): la visualización de datos de alumnos que pidió la
   Dirección de Estudios (docs/entrevistas/Gestión Académica Y Docente). En el
   SIU cada reporte sale por carrera y por año de ingreso, uno por vez, y los
   reportes no se vinculan entre sí: acá se cruzan todos los alumnos de grado con
   filtros libres (varias facultades, carreras, sedes y cohortes, créditos y
   avance), al cierre de cualquier año, y cada número lleva al listado y cada
   alumno a una ficha con todo junto: lo del SIU, su plan con lo que le falta,
   su Vida Universitaria y cuándo se dictan las materias que le faltan.

   Solo lo ve secretaría (rol `secretaria`). Usa Personas para el rol, Planning
   para los horarios, el puerto del padrón académico, el reloj y su almacén
   (los alumnos en seguimiento). Interfaz en hackai/docs/ARQUITECTURA.md. */
import type { People, PeopleError, PersonId } from '@/lib/core/people'
import type { Planning } from '@/lib/core/planning'
import { buildDashboard, type Dashboard, type Row } from '@/lib/core/reports/aggregate'
import {
  FIRST_REPORT_YEAR,
  matchesProfile,
  matchesRanges,
  normalizeFilters,
  type ReportFilters,
  type ReportFiltersInput,
  type RiskKind
} from '@/lib/core/reports/filters'
import { crossWithPlanning, type ScheduleCross } from '@/lib/core/reports/schedule'
import { cutoffOf, inStatuses, type ReportStatus, type Standing, standingOf } from '@/lib/core/reports/standing'
import type { ReportsStore } from '@/lib/core/reports/store'
import { type StudentDetail, studentDetail } from '@/lib/core/reports/student'
import { dayKey } from '@/lib/dates'
import type { AcademicRecordsPort, RecordsCatalog, RecordsProgram, RecordsStudent } from '@/lib/ports/academic-records'
import type { ClockPort } from '@/lib/ports/clock'
import { fail, ok, type Result } from '@/lib/result'

export type { Dashboard } from '@/lib/core/reports/aggregate'
export {
  FIRST_REPORT_YEAR,
  LIST_STATUSES,
  type ListStatus,
  type ReportFilters,
  type ReportFiltersInput,
  RISKS,
  type RiskKind
} from '@/lib/core/reports/filters'
export type { MissingSchedule, ScheduleClash, ScheduleCross, ScheduleSlot } from '@/lib/core/reports/schedule'
export type { ReportStatus, Standing } from '@/lib/core/reports/standing'
export type {
  EnrollmentLine,
  HistoryLine,
  PlanSubjectState,
  PlanSubjectStatus,
  StudentDetail,
  StudentProfile
} from '@/lib/core/reports/student'

export type ReportsError = 'solo-secretaria' | PeopleError

/** Un alumno marcado en seguimiento, con la nota de quien lo marcó. */
export type FollowUp = { studentId: string; note: string; by: PersonId; at: string }

/** Lo largo que puede ser la nota del seguimiento. */
export const FOLLOW_UP_NOTE_MAX = 280

export type ReportOptions = {
  /** Hoy, `AAAA-MM-DD`. */
  today: string
  currentYear: number
  /** El primer año del reporte que se puede pedir. */
  firstYear: number
  /** La primera cohorte del padrón. */
  firstCohort: number
  schools: { id: string; name: string; short: string }[]
  programs: { id: string; name: string; schoolId: string }[]
  campuses: string[]
  /** Los filtros pedidos, en valores que existen: lo que muestran los filtros de la pantalla. */
  filters: ReportFilters
}

export type DashboardView = Dashboard & {
  filters: ReportFilters
  /** El corte del reporte, `AAAA-MM-DD`. */
  cutoff: string
}

export type StudentRow = {
  id: string
  /** «Apellido, Nombres». */
  name: string
  email: string
  school: string
  programId: string
  program: string
  campus: string
  cohort: number
  status: ReportStatus
  /** Cuándo egresó o se dio de baja, si ya pasó al corte. */
  statusDate: string | null
  entrant: boolean
  progress: number
  credits: number
  creditsRequired: number
  failures: number
  average: number | null
  missing: number
  risks: RiskKind[]
  followUp: FollowUp | null
}

export type StudentSort = 'nombre' | 'ingreso' | 'avance' | 'creditos' | 'aplazos' | 'promedio' | 'faltan'

export const STUDENT_SORTS: readonly StudentSort[] = [
  'nombre',
  'ingreso',
  'avance',
  'creditos',
  'aplazos',
  'promedio',
  'faltan'
]

export type StudentQuery = {
  /** Por nombre, legajo, mail o carrera, sin distinguir mayúsculas ni tildes. */
  search?: string
  sort?: StudentSort
  order?: 'asc' | 'desc'
  /** Desde 1. */
  page?: number
  /** De 1 a 100; 25 si falta. */
  pageSize?: number
  /** Todos, sin paginar: para exportar. */
  all?: boolean
}

export type StudentPage = {
  filters: ReportFilters
  cutoff: string
  rows: StudentRow[]
  total: number
  page: number
  pages: number
  pageSize: number
}

export type StudentReport = StudentDetail & {
  year: number
  cutoff: string
  /** Las materias que le faltan cruzadas con el Planning, o `null` si el Planning no respondió. */
  schedule: ScheduleCross | null
  followUp: FollowUp | null
}

export type Reports = {
  /** Lo que se puede elegir en los filtros (facultades, carreras, sedes, años del reporte y cohortes) y los filtros
      pedidos, normalizados. */
  options(personId: PersonId, filters?: ReportFiltersInput): Promise<Result<ReportOptions, ReportsError>>
  /** El tablero: totales, por facultad, carrera, sede y cohorte, la evolución, el avance, los créditos y los
      indicadores de riesgo, con los filtros (los de estado, riesgo y seguimiento no cuentan acá). */
  dashboard(personId: PersonId, filters: ReportFiltersInput): Promise<Result<DashboardView, ReportsError>>
  /** El listado de alumnos con los filtros, buscado, ordenado y paginado. Sin estados, los activos al corte. */
  students(
    personId: PersonId,
    filters: ReportFiltersInput,
    query?: StudentQuery
  ): Promise<Result<StudentPage, ReportsError>>
  /** La ficha de un alumno al cierre del año (el actual si falta): todo junto. */
  student(
    personId: PersonId,
    studentId: string,
    year?: number
  ): Promise<Result<StudentReport, ReportsError | 'alumno-desconocido'>>
  /** Marca al alumno en seguimiento con una nota corta, o le cambia la nota. */
  follow(
    personId: PersonId,
    studentId: string,
    note: string
  ): Promise<Result<FollowUp, ReportsError | 'alumno-desconocido' | 'nota-invalida'>>
  /** Lo saca del seguimiento. Si no estaba, no pasa nada. */
  unfollow(personId: PersonId, studentId: string): Promise<Result<void, ReportsError>>
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Loaded = {
  catalog: RecordsCatalog
  students: RecordsStudent[]
  programs: Map<string, RecordsProgram>
  firstCohort: number
}

const SORT_KEYS: Record<StudentSort, (r: StudentRow) => number | string> = {
  nombre: (r) => fold(r.name),
  ingreso: (r) => r.cohort,
  avance: (r) => r.progress,
  creditos: (r) => r.credits,
  aplazos: (r) => r.failures,
  promedio: (r) => r.average ?? -1,
  faltan: (r) => r.missing
}

function compareBy(sort: StudentSort, order: 'asc' | 'desc') {
  const key = SORT_KEYS[sort]
  const sign = order === 'desc' ? -1 : 1
  return (a: StudentRow, b: StudentRow) => {
    const x = key(a)
    const y = key(b)
    const byKey = typeof x === 'string' ? x.localeCompare(y as string, 'es') : x - (y as number)
    return sign * byKey || fold(a.name).localeCompare(fold(b.name), 'es') || a.id.localeCompare(b.id)
  }
}

function rowOf(row: Row, school: string, followUp: FollowUp | null): StudentRow {
  const { student, program, standing } = row
  const statusDate =
    standing.status === 'graduado' ? student.graduatedOn : standing.status === 'baja' ? student.droppedOn : null
  return {
    id: student.id,
    name: `${student.surname}, ${student.names}`,
    email: student.email,
    school,
    programId: program.id,
    program: program.name,
    campus: student.campus,
    cohort: student.cohort,
    status: standing.status,
    statusDate,
    entrant: standing.entrant,
    progress: standing.progress,
    credits: standing.credits,
    creditsRequired: standing.creditsRequired,
    failures: standing.failures,
    average: standing.average,
    missing: standing.missing,
    risks: standing.risks,
    followUp
  }
}

function matchesSearch(row: StudentRow, search: string): boolean {
  const words = fold(search).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = fold(`${row.name} ${row.id} ${row.email} ${row.program}`)
  return words.every((w) => text.includes(w))
}

function listRow(row: Row, filters: ReportFilters, followed: boolean): boolean {
  if (filters.followed) return followed
  if (!inStatuses(row.standing, filters.statuses)) return false
  return filters.risks.length === 0 || filters.risks.some((r) => row.standing.risks.includes(r))
}

export function createReports({
  people,
  planning,
  records,
  store,
  clock
}: {
  people: People
  planning: Planning
  records: AcademicRecordsPort
  store: ReportsStore
  clock: ClockPort
}): Reports {
  const today = () => dayKey(clock.now().toISOString())

  async function secretary(personId: PersonId): Promise<Result<true, ReportsError>> {
    const person = await people.get(personId)
    if (!person.ok) return person
    return person.value.role === 'secretaria' ? ok(true) : fail('solo-secretaria')
  }

  async function load(personId: PersonId): Promise<Result<Loaded, ReportsError>> {
    const allowed = await secretary(personId)
    if (!allowed.ok) return allowed
    const [catalog, students] = await Promise.all([records.catalog(), records.students()])
    if (!catalog.ok) return catalog
    if (!students.ok) return students
    const firstCohort = students.value.reduce((min, s) => Math.min(min, s.cohort), Number(today().slice(0, 4)))
    const programs = new Map(catalog.value.programs.map((p) => [p.id, p]))
    return ok({ catalog: catalog.value, students: students.value, programs, firstCohort })
  }

  function filtersOf(data: Loaded, input: ReportFiltersInput): ReportFilters {
    return normalizeFilters(input, {
      currentYear: Number(today().slice(0, 4)),
      schools: data.catalog.schools.map((s) => s.id),
      programs: data.catalog.programs.map((p) => p.id),
      campuses: data.catalog.campuses,
      firstCohort: data.firstCohort
    })
  }

  /** Los alumnos del perfil pedido que ya habían ingresado al corte, con su foto a esa fecha. */
  function rowsOf(data: Loaded, filters: ReportFilters, cutoff: string, ranges = true): Row[] {
    const rows: Row[] = []
    for (const student of data.students) {
      const program = data.programs.get(student.programId)
      if (!program || student.cohort > filters.year || !matchesProfile(student, program, filters)) continue
      const standing: Standing = standingOf(student, program, filters.year, cutoff)
      if (!ranges || matchesRanges(standing, filters)) rows.push({ student, program, standing })
    }
    return rows
  }

  async function followUps(): Promise<Map<string, FollowUp>> {
    const found = await store.followUps()
    return new Map(found.ok ? found.value.map((f) => [f.studentId, f]) : [])
  }

  async function schedule(detail: StudentDetail): Promise<ScheduleCross | null> {
    const entries = await planning.entries()
    if (!entries.ok) return null
    const missing = detail.missing.map((m) => ({ subjectId: m.id, name: m.name, year: m.year }))
    return crossWithPlanning(missing, entries.value, detail.profile.school.short)
  }

  return {
    async options(personId, input = {}) {
      const data = await load(personId)
      if (!data.ok) return data
      const { catalog, firstCohort } = data.value
      return ok({
        today: today(),
        currentYear: Number(today().slice(0, 4)),
        firstYear: FIRST_REPORT_YEAR,
        firstCohort,
        schools: catalog.schools.map(({ id, name, short }) => ({ id, name, short })),
        programs: catalog.programs.map(({ id, name, schoolId }) => ({ id, name, schoolId })),
        campuses: catalog.campuses,
        filters: filtersOf(data.value, input)
      })
    },

    async dashboard(personId, input) {
      const data = await load(personId)
      if (!data.ok) return data
      const filters = filtersOf(data.value, input)
      const cutoff = cutoffOf(filters.year, today())
      const rows = rowsOf(data.value, filters, cutoff)
      const profileMatches = data.value.students.filter((s) => {
        const program = data.value.programs.get(s.programId)
        return program !== undefined && matchesProfile(s, program, filters)
      })
      const dashboard = buildDashboard(rows, data.value.catalog, {
        year: filters.year,
        cutoff,
        firstCohort: data.value.firstCohort,
        profileMatches
      })
      return ok({ ...dashboard, filters, cutoff })
    },

    async students(personId, input, query = {}) {
      const data = await load(personId)
      if (!data.ok) return data
      const filters = filtersOf(data.value, input)
      const cutoff = cutoffOf(filters.year, today())
      const follows = await followUps()
      const schools = new Map(data.value.catalog.schools.map((s) => [s.id, s.short]))
      const rows = rowsOf(data.value, filters, cutoff, !filters.followed)
        .filter((r) => listRow(r, filters, follows.has(r.student.id)))
        .map((r) => rowOf(r, schools.get(r.program.schoolId) ?? '', follows.get(r.student.id) ?? null))
        .filter((r) => matchesSearch(r, query.search ?? ''))
        .sort(compareBy(query.sort ?? 'nombre', query.order ?? 'asc'))
      const pageSize = query.all ? Math.max(1, rows.length) : Math.min(100, Math.max(1, query.pageSize ?? 25))
      const pages = Math.max(1, Math.ceil(rows.length / pageSize))
      const page = Math.min(pages, Math.max(1, Math.floor(query.page ?? 1)))
      return ok({
        filters,
        cutoff,
        rows: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pages,
        pageSize
      })
    },

    async student(personId, studentId, year) {
      const data = await load(personId)
      if (!data.ok) return data
      const filters = filtersOf(data.value, { year })
      const student = data.value.students.find((s) => s.id === studentId)
      const program = student && data.value.programs.get(student.programId)
      // Un alumno que todavía no había ingresado al cierre de ese año no tiene ficha en ese año.
      if (!student || !program || student.cohort > filters.year) return fail('alumno-desconocido')
      const cutoff = cutoffOf(filters.year, today())
      const standing = standingOf(student, program, filters.year, cutoff)
      const detail = studentDetail(student, program, data.value.catalog, standing, { year: filters.year, cutoff })
      const [cross, follows] = await Promise.all([schedule(detail), followUps()])
      return ok({ ...detail, year: filters.year, cutoff, schedule: cross, followUp: follows.get(student.id) ?? null })
    },

    async follow(personId, studentId, note) {
      const data = await load(personId)
      if (!data.ok) return data
      const text = note.trim()
      if (text.length > FOLLOW_UP_NOTE_MAX) return fail('nota-invalida')
      if (!data.value.students.some((s) => s.id === studentId)) return fail('alumno-desconocido')
      const followUp: FollowUp = { studentId, note: text, by: personId, at: clock.now().toISOString() }
      const saved = await store.saveFollowUp(followUp)
      return saved.ok ? ok(followUp) : saved
    },

    async unfollow(personId, studentId) {
      const allowed = await secretary(personId)
      if (!allowed.ok) return allowed
      const removed = await store.removeFollowUp(studentId)
      return removed.ok ? ok(undefined) : removed
    }
  }
}
