// Contenido de una jornada de AI-Centric Management. Cada agente de contenido
// completa content/aicm/j<N>.ts con `export default` de este tipo; la seed
// scripts/seed/content.ts lo aplica sobre el deck BASE importado de mbt.
//
// Reglas:
// - Las posiciones refieren SIEMPRE al deck base importado (0-based), no al
//   deck después de insertar. La seed inserta de atrás hacia adelante.
// - Los ids (case.id, assignment.id, contentItems[].id, concepts[].id) son
//   globales en la DB: prefijalos con la jornada (p. ej. 'aicm-j3-caso').
// - Todo lo ficticio (Distribuidora Pampa Sur, Grupo Aconcagua, Conexa,
//   Alimentos del Plata…) va con isFictional: true.
// - markdown en el DSL de slides (lib/decks/parse.ts). Para una encuesta en
//   vivo usá `:::encuesta single|multiple|open|scale|wordcloud`: la seed crea
//   una poll en estado draft para cada una.

export type SessionId = 'aicm-j1' | 'aicm-j2' | 'aicm-j3' | 'aicm-j4' | 'aicm-j5' | 'aicm-j6' | 'aicm-j7' | 'aicm-j8'
  | `aicm-j${number}`

export interface SlideInsertion {
  /** Posición en el deck BASE importado después de la cual va la slide (-1 = al principio). */
  afterPosition: number
  /** Una slide en el DSL (empieza con `:::tipo`). */
  markdown: string
  teacherNotes?: string
  tags?: string[]
}

export interface CasePosture {
  id: string
  label: string
  description: string
}

export interface JornadaCase {
  /** p. ej. 'pampa-sur-j1' */
  id: string
  title: string
  protagonist: string
  /** Una o dos oraciones para la tarjeta. */
  summary: string
  /** El caso completo en markdown. */
  bodyMd: string
  /** La decisión que el alumno tiene que tomar. */
  question: string
  /** 2 a 4 posturas posibles. */
  postures: CasePosture[]
  teacherNotes: string
  isFictional: boolean
}

export interface RubricLevel {
  score: number
  label: string
  description: string
}

export interface RubricCriterion {
  id: string
  criterion: string
  /** Pesos relativos; conviene que sumen 100. */
  weight: number
  levels: RubricLevel[]
}

export interface JornadaAssignment {
  id: string
  title: string
  briefMd: string
  rubric: RubricCriterion[]
  /** Días después de la fecha de la jornada en que vence. */
  dueOffsetDays: number
  peerReviewsPerSubmission: number
}

export type ContentKind = 'video' | 'lectura' | 'caso' | 'link' | 'ejemplo'

export interface ContentItem {
  id: string
  kind: ContentKind
  title: string
  url?: string
  bodyMd?: string
  conceptIds?: string[]
}

export interface Concept {
  id: string
  name: string
  summary: string
  /** ids de conceptos previos (de cualquier jornada). */
  prereqs: string[]
}

export interface JornadaContent {
  sessionId: SessionId
  /** Notas docentes por posición del deck BASE (0-based). Reemplazan las que haya. */
  teacherNotes: Record<number, string>
  insertions: SlideInsertion[]
  case: JornadaCase
  assignment?: JornadaAssignment
  contentItems: ContentItem[]
  concepts: Concept[]
}
