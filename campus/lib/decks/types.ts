// Tipos del motor de slides (puro, sin I/O). Portado de ../mbt/components/campus/SlideDeck.tsx
// y extendido con los tipos interactivos del campus (encuesta, postura, simulador, qr).

export const BASE_SLIDE_TYPES = ['default', 'cover', 'big', 'quote', 'split', 'diagram', 'manos', 'cierre',
  'cifra', 'tiempo', 'versus', 'pasos', 'matriz', 'tabla', 'pregunta'] as const

/**
 * Slides de HTML con el estilo de los decks de Ignacio Berdiñas (deck.css de
 * Empresas Familiares / Building Products). Ver lib/iae/markup.ts y docs/IAE-STYLE.md.
 */
export const HTML_SLIDE_TYPES = ['iae'] as const

/** Tipos interactivos: en vivo los resuelven componentes de otras features (slot renderInteractive). */
export const INTERACTIVE_TYPES = ['encuesta', 'postura', 'simulador', 'qr'] as const
export type InteractiveType = (typeof INTERACTIVE_TYPES)[number]

export const SLIDE_TYPES = [...BASE_SLIDE_TYPES, ...HTML_SLIDE_TYPES, ...INTERACTIVE_TYPES] as const
export type SlideType = (typeof SLIDE_TYPES)[number]

/** Segundo token de la directiva: tipografía de proyección en :::diagram y :::manos. */
export const VARIANT_EST = 'est'

/** Tipos con cuerpo estructurado en filas `- a | b | c`. */
export const STRUCTURED_TYPES = ['cifra', 'tiempo', 'versus', 'pasos', 'matriz', 'tabla', 'pregunta'] as const
export type StructuredType = (typeof STRUCTURED_TYPES)[number]

export const POLL_KINDS = ['single', 'multiple', 'open', 'scale', 'wordcloud'] as const
export type PollKind = (typeof POLL_KINDS)[number]

export interface SlideRow {
  fields: string[]
  /** La fila venía marcada con `*` al principio. */
  highlight: boolean
}

export interface SlideAxis {
  label: string
  low: string
  high: string
}

export interface PollOption {
  /** 'opt-a', 'opt-b', … en el orden de la slide. Es lo que se guarda en poll_responses.choice. */
  id: string
  label: string
}

/** Datos de una slide interactiva, ya parseados. */
export type SlideInteractive =
  | {
    kind: 'encuesta'
    pollKind: PollKind
    question: string
    /** Vacío en open y wordcloud. En scale, si no hay opciones, la escala es 1..5. */
    options: PollOption[]
  }
  | { kind: 'postura'; caseId: string; title?: string }
  | { kind: 'simulador'; simId: string; title?: string }
  | { kind: 'qr'; title?: string; url?: string }

export interface ParsedSlide {
  type: SlideType
  /** Tipo crudo de la directiva, aunque sea desconocido (para validación). */
  directive?: string
  /** Argumento de la directiva (id de diagrama, tipo de encuesta, caseId, simId). */
  arg?: string
  /** Variante de render del tipo (`est` en :::diagram y :::manos). */
  variant?: string
  kicker?: string
  attribution?: string
  /** Columnas de una slide :::split (cuerpo partido por `|||`). */
  columns?: [string, string]
  body: string
  /** Título `#` de una slide estructurada o interactiva. */
  title?: string
  /** Filas `- a | b | c` de una slide estructurada, ya recortadas. */
  rows?: SlideRow[]
  /** Ejes rotulados de :::matriz. */
  axes?: { x?: SlideAxis; y?: SlideAxis }
  /** Nota de cierre (una línea) de una slide estructurada. */
  nota?: string
  /** Pie / fuente (markdown inline). */
  pie?: string
  /** Solo en encuesta, postura, simulador y qr. */
  interactive?: SlideInteractive
  /** Solo en :::iae: clases de la section y HTML interior (sin sanitizar todavía). */
  iae?: { classes: string; html: string }
  /** Qué se recortó o descartó por exceder los límites del tipo. */
  issues?: string[]
}

/** Piel con la que se dibuja un deck: 'campus' (DSL mbt) o 'iae' (estilo Ignacio). */
export type DeckSkin = 'campus' | 'iae'

/** Materia y jornada que muestra el chrome institucional de cada slide. */
export interface SlideContext {
  /** Materia o programa, p. ej. «AI-Centric Management». */
  materia?: string
  /** Jornada o unidad, p. ej. «Jornada 1 · Awareness». */
  jornada?: string
}

/** Capítulo de un deck (decks.chapters). firstSlide/lastSlide son 1-based sobre el deck BASE importado. */
export interface DeckChapter {
  title: string
  firstSlide: number
  lastSlide: number
  minutes: number
  purpose: string
}

/** Fuente citada por un deck (decks.sources). */
export interface DeckSource {
  id: string
  title: string
  publisher: string
  date: string
  url: string
  supports: string
  limitation: string
}
