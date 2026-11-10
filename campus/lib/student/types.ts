// Tipos y helpers puros de la vista del alumno (marcas, notas, encuestas).
// Sin I/O: se pueden importar desde client components y desde scripts.

import type { Overlay } from '@/lib/db-types'
import type { PollKind, PollOption } from '@/lib/decks/types'

/* ---------- marcas ---------- */

export const MARK_KINDS = ['no-entendi', 'clave', 'pregunta', 'idea'] as const
export type MarkKind = (typeof MARK_KINDS)[number]

export const MARK_LABELS: Record<MarkKind, string> = {
  'no-entendi': 'No entendí',
  clave: 'Clave',
  pregunta: 'Pregunta',
  idea: 'Idea',
}

export const MARK_ICONS: Record<MarkKind, string> = {
  'no-entendi': '?',
  clave: '★',
  pregunta: '✋',
  idea: '💡',
}

export function isMarkKind(v: unknown): v is MarkKind {
  return typeof v === 'string' && (MARK_KINDS as readonly string[]).includes(v)
}

/** Marca propia (fila de slide_marks reducida). */
export interface MyMark {
  position: number
  kind: MarkKind
}

/** Total de marcas propias por tipo en un deck. */
export type MarkTotals = Record<MarkKind, number>

export function emptyTotals(): MarkTotals {
  return { 'no-entendi': 0, clave: 0, pregunta: 0, idea: 0 }
}

export function markTotals(marks: MyMark[]): MarkTotals {
  const t = emptyTotals()
  for (const m of marks) t[m.kind]++
  return t
}

/** Respuesta de POST /api/student/marks. */
export interface ToggleMarkResult {
  active: boolean
  /** Posición actual de la slide marcada (puede diferir de la pedida si el deck cambió). */
  position?: number
  /** Marcas propias en esa slide. */
  slide: MarkKind[]
  /** Totales propios en el deck. */
  totals: MarkTotals
}

/* ---------- notas ---------- */

export const NOTE_VISIBILITIES = ['privada', 'cohorte'] as const
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number]

export function isVisibility(v: unknown): v is NoteVisibility {
  return v === 'privada' || v === 'cohorte'
}

/** Nota propia de una slide (una por persona, deck y posición). */
export interface StudentNote {
  id: string
  deckId: string
  position: number
  slideId: string | null
  body: string
  /** Fragmentos subrayados de la slide, uno por línea. */
  quote: string | null
  visibility: NoteVisibility
  updatedAt: string
}

/** Nota que otro alumno compartió con la cohorte. */
export interface CohortNote {
  id: string
  author: string
  body: string
  quote: string | null
  updatedAt: string
}

export const NOTE_MAX = 8000
export const QUOTE_MAX = 4000

/** Agrega un fragmento subrayado a las citas existentes (una por línea, sin repetir). */
export function appendQuote(current: string | null | undefined, fragment: string): string {
  const clean = fragment.replace(/\s+/g, ' ').trim().slice(0, 600)
  const lines = (current ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (clean && !lines.includes(clean)) lines.push(clean)
  return lines.join('\n').slice(0, QUOTE_MAX)
}

export function quoteLines(quote: string | null | undefined): string[] {
  return (quote ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Exporta las notas y marcas de un deck como texto plano. */
export function notesAsText(input: {
  deckTitle: string
  slides: { position: number; title: string }[]
  notes: StudentNote[]
  marks: MyMark[]
  author?: string
}): string {
  const out: string[] = []
  out.push(`Mis notas · ${input.deckTitle}`)
  if (input.author) out.push(input.author)
  out.push(`Exportado el ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`)
  out.push('')
  const byPos = new Map(input.notes.map((n) => [n.position, n]))
  const marksByPos = new Map<number, MarkKind[]>()
  for (const m of input.marks) marksByPos.set(m.position, [...(marksByPos.get(m.position) ?? []), m.kind])
  let any = false
  for (const s of input.slides) {
    const n = byPos.get(s.position)
    const mk = marksByPos.get(s.position) ?? []
    if (!n && mk.length === 0) continue
    any = true
    out.push(`## ${s.position + 1}. ${s.title}`)
    if (mk.length) out.push(`Marcas: ${mk.map((k) => MARK_LABELS[k]).join(', ')}`)
    for (const q of quoteLines(n?.quote)) out.push(`> ${q}`)
    if (n?.body.trim()) out.push(n.body.trim())
    if (n?.visibility === 'cohorte') out.push('(compartida con la cohorte)')
    out.push('')
  }
  if (!any) out.push('Todavía no tenés notas ni marcas en este deck.')
  return out.join('\n')
}

/* ---------- encuestas ---------- */

export type PollStatus = 'draft' | 'open' | 'closed'

/** Encuesta tal como la ve el alumno. */
export interface PublicPoll {
  id: string
  kind: PollKind
  question: string
  options: PollOption[]
  status: PollStatus
  anonymous: boolean
  liveSessionId: string | null
  deckId: string | null
  slideId: string | null
}

/** Respuesta propia. `choice`: ['opt-a', …] o número (scale sin opciones). */
export interface MyPollResponse {
  choice: string[] | number | null
  text: string | null
  guestName: string | null
  updatedAt: string
}

/** Conteos de una encuesta (payload de `poll.updated`). */
export interface PollResults {
  pollId: string
  kind: PollKind
  total: number
  /** single/multiple/scale con opciones: por opción · scale 1..5: por número · wordcloud: por palabra normalizada. */
  counts: Record<string, number>
  /** open: últimas respuestas de texto (sin nombres). */
  texts?: string[]
}

export const SCALE_DEFAULT = [1, 2, 3, 4, 5]
export const WORDCLOUD_MAX_TERMS = 3

/** Términos de una respuesta de nube de palabras: separados por coma o salto de línea, normalizados. */
export function wordcloudTerms(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(/[,\n;]+/)) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 40)
    if (t) seen.add(t)
    if (seen.size >= WORDCLOUD_MAX_TERMS) break
  }
  return [...seen]
}

export type PollAnswerInput = { choice?: unknown; text?: unknown }

/**
 * Valida y normaliza una respuesta según el tipo de encuesta.
 * Devuelve {choice, text} listos para poll_responses o {error}.
 */
export function normalizeAnswer(poll: Pick<PublicPoll, 'kind' | 'options'>, input: PollAnswerInput):
  { choice: string[] | number | null; text: string | null } | { error: string } {
  const ids = new Set(poll.options.map((o) => o.id))
  const asList = (v: unknown): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String)
  switch (poll.kind) {
    case 'single': {
      const list = asList(input.choice)
      if (list.length !== 1 || !ids.has(list[0])) return { error: 'Elegí una opción.' }
      return { choice: list, text: null }
    }
    case 'multiple': {
      const list = [...new Set(asList(input.choice))]
      if (list.length === 0) return { error: 'Elegí al menos una opción.' }
      if (list.some((id) => !ids.has(id))) return { error: 'Opción inválida.' }
      return { choice: poll.options.map((o) => o.id).filter((id) => list.includes(id)), text: null }
    }
    case 'scale': {
      if (poll.options.length > 0) {
        const list = asList(input.choice)
        if (list.length !== 1 || !ids.has(list[0])) return { error: 'Elegí un valor de la escala.' }
        return { choice: list, text: null }
      }
      const n = Number(Array.isArray(input.choice) ? input.choice[0] : input.choice)
      if (!Number.isInteger(n) || !SCALE_DEFAULT.includes(n)) return { error: 'Elegí un valor del 1 al 5.' }
      return { choice: n, text: null }
    }
    case 'open': {
      const text = typeof input.text === 'string' ? input.text.trim().slice(0, 1000) : ''
      if (!text) return { error: 'Escribí tu respuesta.' }
      return { choice: null, text }
    }
    case 'wordcloud': {
      const text = typeof input.text === 'string' ? input.text : ''
      const terms = wordcloudTerms(text)
      if (terms.length === 0) return { error: `Escribí hasta ${WORDCLOUD_MAX_TERMS} palabras separadas por coma.` }
      return { choice: null, text: terms.join(', ') }
    }
    default:
      return { error: 'Tipo de encuesta desconocido.' }
  }
}

/** Calcula los conteos a partir de las respuestas. */
export function computeResults(poll: Pick<PublicPoll, 'id' | 'kind' | 'options'>,
  responses: { choice: unknown; text: string | null }[]): PollResults {
  const counts: Record<string, number> = {}
  const texts: string[] = []
  if (poll.kind === 'single' || poll.kind === 'multiple' || (poll.kind === 'scale' && poll.options.length > 0)) {
    for (const o of poll.options) counts[o.id] = 0
  } else if (poll.kind === 'scale') {
    for (const n of SCALE_DEFAULT) counts[String(n)] = 0
  }
  for (const r of responses) {
    if (poll.kind === 'open') {
      if (r.text) texts.push(r.text)
    } else if (poll.kind === 'wordcloud') {
      for (const t of wordcloudTerms(r.text ?? '')) counts[t] = (counts[t] ?? 0) + 1
    } else {
      const list = Array.isArray(r.choice) ? r.choice.map(String) : r.choice == null ? [] : [String(r.choice)]
      for (const c of list) if (c in counts) counts[c]++
    }
  }
  const out: PollResults = { pollId: poll.id, kind: poll.kind, total: responses.length, counts }
  if (poll.kind === 'open') out.texts = texts.slice(-50)
  return out
}

/* ---------- vivo ---------- */

/** Slide del deck como la ve el alumno (sin notas del docente). */
export interface StudentSlide {
  id: string
  position: number
  title: string
  markdown: string
}

/** Respuesta de GET /api/student/live/[code]. */
export interface StudentLiveSnapshot {
  liveSessionId: string
  code: string
  deckId: string
  status: 'live' | 'ended'
  position: number
  overlay: Overlay | null
  deckVersion: number
  /** live_sessions.seq: el celular ignora estados más viejos que el último aplicado. */
  seq?: number
  /** Encuesta activa para responder (overlay poll, o la abierta más reciente de la clase o de la slide actual). */
  activePoll: PublicPoll | null
  /** Solo si se pidió ?slides=1. */
  slides?: StudentSlide[]
}

/** Payload del broadcast `marks.updated` que emite el toggle de marcas en vivo. */
export interface MarksUpdatedPayload {
  deckId: string
  position: number
  counts: MarkTotals
}
