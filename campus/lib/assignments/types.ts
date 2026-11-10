// Tipos de entregas, rúbricas y revisiones entre pares. Puro (sin I/O).

export interface RubricLevel {
  score: number
  label: string
  description: string
}

export interface RubricCriterion {
  id: string
  criterion: string
  /** Peso relativo (conviene que sumen 100). */
  weight: number
  levels: RubricLevel[]
}

export type Rubric = RubricCriterion[]

export type AssignmentStatus = 'borrador' | 'abierta' | 'revision-pares' | 'cerrada'
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['borrador', 'abierta', 'revision-pares', 'cerrada']
export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  borrador: 'Borrador',
  abierta: 'Abierta',
  'revision-pares': 'Revisión entre pares',
  cerrada: 'Cerrada',
}

export interface AssignmentRow {
  id: string
  course_id: string
  class_session_id: string | null
  title: string
  brief_md: string
  rubric: Rubric
  due_at: string | null
  peer_reviews_per_submission: number
  status: AssignmentStatus
}

export interface SubmissionRow {
  id: string
  assignment_id: string
  person_id: string
  body_md: string
  url: string | null
  created_at: string
  updated_at: string
}

/** {criterionId: score} */
export type Scores = Record<string, number>

export interface ReviewRow {
  id: string
  submission_id: string
  reviewer_id: string
  scores: Scores
  comment: string | null
  status: 'asignada' | 'enviada'
  is_teacher: boolean
  created_at: string
  submitted_at: string | null
}

/**
 * Cómo se calcula la nota final:
 * - docente-o-pares: la del docente si revisó; si no, la media de pares.
 * - media-pares / mediana-pares: solo pares.
 * - mixta: teacherWeight × docente + (1 − teacherWeight) × media de pares (si falta uno, el otro).
 */
export type GradeMode = 'docente-o-pares' | 'media-pares' | 'mediana-pares' | 'mixta'
export const GRADE_MODES: GradeMode[] = ['docente-o-pares', 'media-pares', 'mediana-pares', 'mixta']
export const GRADE_MODE_LABEL: Record<GradeMode, string> = {
  'docente-o-pares': 'Docente si existe; si no, media de pares',
  'media-pares': 'Media de pares',
  'mediana-pares': 'Mediana de pares',
  mixta: 'Mixta: docente y pares ponderados',
}

export interface AssignmentSettings {
  gradeMode: GradeMode
  /** 0..1, solo para 'mixta'. */
  teacherWeight: number
  /** Puntos porcentuales de desvío que marcan una revisión como discordante. */
  discordThreshold: number
  assignmentSeed: string | null
  assignedAt: string | null
}

export const DEFAULT_SETTINGS: AssignmentSettings = {
  gradeMode: 'docente-o-pares',
  teacherWeight: 0.5,
  discordThreshold: 20,
  assignmentSeed: null,
  assignedAt: null,
}

/** Largo mínimo del comentario de una revisión. */
export const MIN_COMMENT_LENGTH = 60
