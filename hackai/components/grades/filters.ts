/* Los filtros de Notas: año lectivo, tipo de materia, año de la carrera y
   estado. Viven en la URL (?lectivo=2025&tipo=optativa&anio=1&estado=en-curso)
   para que una vista filtrada se pueda compartir. También cómo se agrupan las
   materias: por año lectivo, el más reciente primero (de entrada), o por año
   de la carrera (`?agrupar=carrera`). Solo filtran y agrupan lo que da
   Cursada: no deciden el estado de nada. */
import { groupName } from '@/components/grades/status'
import type { SubjectStanding } from '@/lib/core/studies'

export const KINDS = ['todas', 'obligatoria', 'optativa', 'vida-universitaria'] as const
export const STATES = ['todos', 'en-curso', 'aprobadas', 'final-pendiente'] as const

export type GradeFilters = {
  /** Año lectivo, como «2025», o «todos». */
  lectivo: string
  tipo: (typeof KINDS)[number]
  /** Año de la carrera, como «1», o «todos». */
  anio: string
  estado: (typeof STATES)[number]
}

export const DEFAULT_FILTERS: GradeFilters = { lectivo: 'todos', tipo: 'todas', anio: 'todos', estado: 'todos' }

type Params = Record<string, string | string[] | undefined>

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

const digits = (value: unknown) => (typeof value === 'string' && /^\d{1,4}$/.test(value) ? value : 'todos')

export function filtersFrom(params: Params): GradeFilters {
  return {
    lectivo: digits(params.lectivo),
    tipo: pick(params.tipo, KINDS, 'todas'),
    anio: digits(params.anio),
    estado: pick(params.estado, STATES, 'todos')
  }
}

/** La query de la URL, sin los filtros que están en «todos». */
export function filtersQuery(filters: GradeFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== DEFAULT_FILTERS[key as keyof GradeFilters]) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function matchesState(subject: SubjectStanding, estado: GradeFilters['estado']): boolean {
  if (estado === 'en-curso') return subject.status === 'en-curso'
  if (estado === 'aprobadas') return subject.status === 'aprobada' || subject.status === 'promocionada'
  if (estado === 'final-pendiente') return subject.status === 'regular'
  return true
}

export function applyFilters(subjects: SubjectStanding[], filters: GradeFilters): SubjectStanding[] {
  return subjects.filter(
    (s) =>
      (filters.lectivo === 'todos' || String(s.academicYear) === filters.lectivo) &&
      (filters.tipo === 'todas' || s.kind === filters.tipo) &&
      (filters.anio === 'todos' || String(s.year) === filters.anio) &&
      matchesState(s, filters.estado)
  )
}

/** Las materias por grupo, en el orden en que vienen (Cursada ya las ordena por año de la carrera). */
export function byGroup(subjects: SubjectStanding[]): { name: string; items: SubjectStanding[] }[] {
  const groups: { name: string; items: SubjectStanding[] }[] = []
  for (const subject of subjects) {
    const name = groupName(subject)
    const group = groups.find((g) => g.name === name)
    if (group) group.items.push(subject)
    else groups.push({ name, items: [subject] })
  }
  return groups
}

/** Cómo se agrupan las materias: por año lectivo (de entrada) o por año de la carrera. */
export type Grouping = 'lectivo' | 'carrera'

export const groupingFrom = (params: Params): Grouping => (params.agrupar === 'carrera' ? 'carrera' : 'lectivo')

/** Las materias que no tienen año lectivo: las aprobadas sin una cursada en el SIU, como una equivalencia. */
export const NO_ACADEMIC_YEAR = 'Sin cursada en el SIU'

/** Por año lectivo, el más reciente primero; las que no tienen, al final. Adentro, en el orden en que vienen. */
export function byAcademicYear(subjects: SubjectStanding[]): { name: string; items: SubjectStanding[] }[] {
  const years = [...new Set(subjects.map((s) => s.academicYear))].sort((a, b) => (b ?? -1) - (a ?? -1))
  return years.map((year) => ({
    name: year === null ? NO_ACADEMIC_YEAR : String(year),
    items: subjects.filter((s) => s.academicYear === year)
  }))
}

/** Dentro de un grupo, primero lo que todavía se está haciendo: las en curso, después las que deben el final y
    al final las aprobadas. Entre las del mismo estado, en el orden en que vienen. */
const STATUS_ORDER: Record<SubjectStanding['status'], number> = {
  'en-curso': 0,
  regular: 1,
  pendiente: 2,
  promocionada: 3,
  aprobada: 3
}

export function groupsOf(subjects: SubjectStanding[], grouping: Grouping) {
  const groups = grouping === 'carrera' ? byGroup(subjects) : byAcademicYear(subjects)
  return groups.map((g) => ({
    ...g,
    items: g.items.toSorted((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  }))
}
