// Aula: tipos y constantes puras (sin I/O). Se pueden importar desde el cliente.

export interface CasePosture {
  id: string
  label: string
  description?: string
}

export interface CaseRow {
  id: string
  course_id: string
  class_session_id: string | null
  title: string
  protagonist: string | null
  summary: string | null
  body_md: string
  question: string
  postures: CasePosture[]
  teacher_notes: string | null
  is_fictional: boolean
  opens_at: string | null
  closes_at: string | null
}

/** Caso sin notas del docente (lo que ve el alumno). */
export type CaseForStudent = Omit<CaseRow, 'teacher_notes'>

export interface PostureCount {
  postureId: string
  label: string
  count: number
  /** 0-100, redondeado */
  pct: number
  /** Promedio de confianza (1-5) o null si no hay respuestas. */
  avgConfidence: number | null
}

/** Distribución anónima de posturas de un caso. */
export interface PostureDistribution {
  caseId: string
  question: string
  total: number
  /** Alumnos del curso (para mostrar "18 de 20"). */
  roster: number
  counts: PostureCount[]
}

export type CaseStatus = 'proximo' | 'abierto' | 'cerrado'

export function caseStatus(c: { opens_at: string | null; closes_at: string | null }, now = Date.now()): CaseStatus {
  if (c.opens_at && new Date(c.opens_at).getTime() > now) return 'proximo'
  if (c.closes_at && new Date(c.closes_at).getTime() <= now) return 'cerrado'
  return 'abierto'
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  proximo: 'Todavía no abrió',
  abierto: 'Abierto',
  cerrado: 'Cerrado',
}

/** Largo mínimo de la justificación de una postura. */
export const JUSTIFICATION_MIN = 60
export const JUSTIFICATION_MAX = 2000

export const CONFIDENCE_LABEL: Record<number, string> = {
  1: 'Muy poca',
  2: 'Poca',
  3: 'Media',
  4: 'Bastante',
  5: 'Total',
}

// ---------- participación ----------

export const PARTICIPATION_KINDS = ['intervencion', 'cold-call', 'pregunta', 'aporte', 'debate'] as const
export type ParticipationKind = (typeof PARTICIPATION_KINDS)[number]

export const PARTICIPATION_KIND_LABEL: Record<ParticipationKind, string> = {
  intervencion: 'Intervención',
  'cold-call': 'Cold call',
  pregunta: 'Pregunta',
  aporte: 'Aporte',
  debate: 'Debate',
}

export type ParticipationSource = 'manual' | 'randomizer' | 'agent'

export const QUALITY_LABEL: Record<number, string> = {
  1: 'Básica',
  2: 'Buena',
  3: 'Excelente',
}

export const DRAW_OUTCOMES = ['pendiente', 'participo', 'paso', 'ausente'] as const
export type DrawOutcome = (typeof DRAW_OUTCOMES)[number]

export const DRAW_OUTCOME_LABEL: Record<DrawOutcome, string> = {
  pendiente: 'Pendiente',
  participo: 'Participó',
  paso: 'Pasó',
  ausente: 'Ausente',
}

export function isParticipationKind(v: unknown): v is ParticipationKind {
  return typeof v === 'string' && (PARTICIPATION_KINDS as readonly string[]).includes(v)
}

export function isDrawOutcome(v: unknown): v is DrawOutcome {
  return typeof v === 'string' && (DRAW_OUTCOMES as readonly string[]).includes(v)
}

// ---------- marcas de slide ----------

export const MARK_KINDS = ['no-entendi', 'clave', 'pregunta', 'idea'] as const
export type MarkKind = (typeof MARK_KINDS)[number]

export const MARK_LABEL: Record<MarkKind, string> = {
  'no-entendi': 'No entendí',
  clave: 'Clave',
  pregunta: 'Pregunta',
  idea: 'Idea',
}
