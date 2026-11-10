/* ============================================================
   Formato de contenido v2 de las jornadas de AI-Centric Management:
   decks enteros en el estilo de Ignacio (slides 'iae') con las
   interactivas del campus intercaladas. Lo carga
   scripts/seed/decks-v2.ts en el deck `aicm-jN` (el deck anterior
   queda como `aicm-jN-v1`). Guía de estilo: docs/IAE-STYLE.md.

   Cada archivo content/aicm2/jN.ts hace `export default` de un
   JornadaDeckV2. Antes de cargarlo:
     npx tsx scripts/render-check.ts --file content/aicm2/jN.ts --out /tmp/jN
   ============================================================ */

/** Slide en el estilo de Ignacio. */
export interface IaeSlideV2 {
  kind: 'iae'
  /** Clases de la section sin `slide` (p. ej. 'content arch-fill', 'blue pause-center'). */
  classes: string
  /** HTML interior (kicker, h1, body…): sin regla, logo, contador ni notas. */
  html: string
  /** Qué decir, cuánto tiempo, qué preguntar. Los alumnos no las ven. */
  teacherNotes: string
  tags?: string[]
  poll?: never
}

/** Slide interactiva del campus en el DSL (`:::encuesta single`, `:::postura <caseId>`…). Se dibuja con la piel de Ignacio. */
export interface InteractiveSlideV2 {
  kind: 'encuesta' | 'postura' | 'simulador' | 'qr'
  /** Bloque DSL completo, empezando por `:::encuesta …`, `:::postura …`, `:::simulador …` o `:::qr`. */
  markdown: string
  teacherNotes: string
  tags?: string[]
}

export type SlideV2 = IaeSlideV2 | InteractiveSlideV2

export interface ChapterV2 {
  title: string
  minutes: number
  /** 1-based, inclusive, sobre este deck. */
  firstSlide: number
  lastSlide: number
  /** Para qué está el capítulo (opcional; va a decks.chapters.purpose). */
  purpose?: string
}

export interface JornadaDeckV2 {
  /** 'aicm-j1' … 'aicm-j8', o cualquier slug si el deck es de otra materia (`course`). */
  deckId: string
  /** Materia del deck cuando no es AI-Centric Management. El seed la crea si no existe. */
  course?: { id: string, title: string }
  title: string
  /** La pregunta de la jornada. */
  question: string
  chapters: ChapterV2[]
  slides: SlideV2[]
  /** Archivos que el agente dejó en public/decks/aicm/media/jN/ (nombres, sin ruta). */
  media?: string[]
  /**
   * Archivos de la carpeta media/ junto al archivo del deck que el seed sube al
   * bucket `media` (decks/<deckId>/<archivo>). En las slides van con
   * deckMediaUrl(deckId, archivo) de lib/media/core: no hace falta deploy.
   */
  storageMedia?: string[]
}
