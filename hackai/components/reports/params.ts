/* Los filtros de Reportes viven en la URL, así un reporte se comparte copiando
   el enlace y el botón de atrás vuelve al anterior. Este archivo traduce entre
   los parámetros (en español: `anio`, `facultad=fi,fce`, `ingreso=2021-2024`…)
   y los filtros del módulo. Qué valores existen lo decide Reportes
   (`normalizeFilters`): acá solo se leen y se escriben. */
import {
  LIST_STATUSES,
  type ListStatus,
  type ReportFilters,
  type ReportFiltersInput,
  RISKS,
  type RiskKind,
  STUDENT_SORTS,
  type StudentQuery,
  type StudentSort
} from '@/lib/core/reports'

export type SearchParams = Record<string, string | string[] | undefined>

/** Lo que el listado suma a los filtros: búsqueda, orden y página. */
export type ListParams = { search: string; sort: StudentSort; order: 'asc' | 'desc'; page: number }

const P = {
  year: 'anio',
  schools: 'facultad',
  programs: 'carrera',
  campuses: 'sede',
  cohorts: 'ingreso',
  statuses: 'estado',
  risks: 'indicador',
  creditsMin: 'creditos-desde',
  creditsMax: 'creditos-hasta',
  progressMin: 'avance-desde',
  progressMax: 'avance-hasta',
  search: 'buscar',
  sort: 'orden',
  order: 'sentido',
  page: 'pagina'
} as const

/** Todos los valores de un parámetro: repetido (`?sede=Pilar&sede=Rosario`) o separado por comas. */
function values(params: SearchParams, name: string): string[] {
  const raw = params[name]
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]
  return list
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}

function single(params: SearchParams, name: string): string | undefined {
  return values(params, name)[0]
}

/** El texto tal cual, sin separar por comas: la búsqueda puede tener comas. */
function textOf(params: SearchParams, name: string): string {
  const raw = params[name]
  return (Array.isArray(raw) ? raw[0] : raw) ?? ''
}

function numberOf(params: SearchParams, name: string): number | null {
  const value = single(params, name)
  if (value === undefined || !/^\d{1,4}$/.test(value)) return null
  return Number(value)
}

/** Años de ingreso: `2019,2021` o rangos `2018-2022`. Un rango de más de 40 años no se expande. */
export function cohortsOf(list: string[]): number[] {
  const years = list.flatMap((value) => {
    const range = value.match(/^(\d{4})-(\d{4})$/)
    if (!range) return /^\d{4}$/.test(value) ? [Number(value)] : []
    const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b)
    if (to - from > 40) return []
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  })
  return [...new Set(years)].sort((a, b) => a - b)
}

/** Los años de ingreso como los escribe la URL: los consecutivos como rango. */
export function cohortsText(cohorts: number[]): string {
  const sorted = [...new Set(cohorts)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(','))
    i = j
  }
  return parts.join(',')
}

export function filtersFromParams(params: SearchParams): ReportFiltersInput {
  const year = numberOf(params, P.year)
  return {
    year: year ?? undefined,
    schools: values(params, P.schools),
    programs: values(params, P.programs),
    campuses: values(params, P.campuses),
    cohorts: cohortsOf(values(params, P.cohorts)),
    statuses: values(params, P.statuses).filter((s): s is ListStatus => LIST_STATUSES.includes(s as ListStatus)),
    risks: values(params, P.risks).filter((r): r is RiskKind => RISKS.includes(r as RiskKind)),
    creditsMin: numberOf(params, P.creditsMin),
    creditsMax: numberOf(params, P.creditsMax),
    progressMin: numberOf(params, P.progressMin),
    progressMax: numberOf(params, P.progressMax)
  }
}

export function listFromParams(params: SearchParams): ListParams {
  const sort = single(params, P.sort)
  const page = numberOf(params, P.page)
  return {
    search: textOf(params, P.search).trim().slice(0, 80),
    sort: STUDENT_SORTS.includes(sort as StudentSort) ? (sort as StudentSort) : 'nombre',
    order: single(params, P.order) === 'desc' ? 'desc' : 'asc',
    page: page && page > 0 ? page : 1
  }
}

export const queryOf = (list: ListParams): StudentQuery => ({ ...list, pageSize: 25 })

type Writable = Partial<Omit<ReportFilters, 'followed'>> & Partial<ListParams>

/** Los parámetros de unos filtros, sin los vacíos: así la URL queda corta y se puede leer. */
export function paramsOf(filters: Writable): URLSearchParams {
  const params = new URLSearchParams()
  const set = (name: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== '') params.set(name, String(value))
  }
  const list = (name: string, items: readonly (string | number)[] | undefined) => set(name, items?.join(','))
  set(P.year, filters.year)
  list(P.schools, filters.schools)
  list(P.programs, filters.programs)
  list(P.campuses, filters.campuses)
  set(P.cohorts, filters.cohorts ? cohortsText(filters.cohorts) : undefined)
  list(P.statuses, filters.statuses)
  list(P.risks, filters.risks)
  set(P.creditsMin, filters.creditsMin)
  set(P.creditsMax, filters.creditsMax)
  set(P.progressMin, filters.progressMin)
  set(P.progressMax, filters.progressMax)
  set(P.search, filters.search)
  if (filters.sort && filters.sort !== 'nombre') set(P.sort, filters.sort)
  if (filters.order === 'desc') set(P.order, 'desc')
  if (filters.page && filters.page > 1) set(P.page, filters.page)
  return params
}

/** Una ruta con esos filtros: `/reportes/alumnos?anio=2026&estado=baja`. */
export function hrefOf(path: string, filters: Writable): string {
  const query = paramsOf(filters).toString()
  return query ? `${path}?${query}` : path
}

/** Solo los filtros que comparten las tres vistas (tablero, alumnos y seguimiento): sin estado, indicador, búsqueda,
    orden ni página. Es lo que viaja al cambiar de vista. */
export const sharedFilters = (f: ReportFilters): Writable => ({
  year: f.year,
  schools: f.schools,
  programs: f.programs,
  campuses: f.campuses,
  cohorts: f.cohorts,
  creditsMin: f.creditsMin,
  creditsMax: f.creditsMax,
  progressMin: f.progressMin,
  progressMax: f.progressMax
})

/** Cuántos filtros de perfil (facultad, carrera, sede, ingreso, créditos, avance) hay elegidos, para el botón
    «Filtros» del celular. */
export function activeCount(f: ReportFilters): number {
  const ranges = [f.creditsMin ?? f.creditsMax, f.progressMin ?? f.progressMax].filter((v) => v !== null).length
  return [f.schools, f.programs, f.campuses, f.cohorts].filter((l) => l.length > 0).length + ranges
}
