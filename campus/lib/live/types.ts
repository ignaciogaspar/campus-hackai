// Tipos de la clase en vivo (puros: sirven en server, client y scripts).
import type { Overlay } from '@/lib/db-types'
import type { PollKind, PollOption } from '@/lib/decks/types'

export type { Overlay }

/** Estado de una encuesta con sus conteos. Compatible con el payload de `poll.updated`. */
export interface PollSnapshot {
  pollId: string
  kind: PollKind
  question: string
  options: PollOption[]
  status: 'draft' | 'open' | 'closed'
  slideId: string | null
  total: number
  /** single/multiple: por id de opción · scale: por valor · wordcloud: por término. */
  counts: Record<string, number>
  /** open/wordcloud: últimas respuestas de texto (sin nombres). */
  texts?: string[]
}

export interface PostureSnapshot {
  caseId: string
  title: string
  question: string
  total: number
  postures: { id: string; label: string; description?: string; count: number }[]
  /** 2-3 justificaciones (nombre de pila + texto). */
  quotes: { name: string; postureLabel: string; text: string }[]
}

export interface ConfusionSnapshot {
  position: number
  slideTitle: string | null
  counts: Record<'no-entendi' | 'clave' | 'pregunta' | 'idea', number>
  /** Marcas hechas durante esta clase (el resto es de otras sesiones o fuera de clase). */
  inSession: number
}

export interface SimSnapshot {
  simId: string
  title: string
  url: string
  opened: number
  completed: number
}

export interface StudentSnapshot {
  personId: string
  name: string
  company?: string | null
  position?: string | null
  photoUrl?: string | null
  industry?: string | null
}

/** Datos resueltos para dibujar un overlay (GET /api/live/<id>/overlay-data). */
export type OverlayData =
  | { type: 'poll'; poll: PollSnapshot }
  | { type: 'postures'; postures: PostureSnapshot }
  | { type: 'confusion'; confusion: ConfusionSnapshot }
  | { type: 'sim'; sim: SimSnapshot }
  | { type: 'student'; student: StudentSnapshot }
  | { type: 'none' }

/** Una acción ejecutada por el agente (lo que muestra la consola). */
export interface AgentAction {
  tool: string
  input: Record<string, unknown>
  ok: boolean
  /** Resumen corto en español de lo que pasó (o el error). */
  summary: string
}

/** Respuesta de POST /api/live/<id>/agent. */
export interface AgentResponse {
  reply: string
  actions: AgentAction[]
  latencyMs: number
  turnId: number | null
  error?: string
}

export interface TranscriptLine {
  id: number
  text: string
  isCommand: boolean
  position: number | null
  createdAt: string
}

export interface AgentTurnLine {
  id: number
  utterance: string
  reply: string | null
  error: string | null
  latencyMs: number | null
  actions: AgentAction[]
  createdAt: string
}

export interface DrawLine {
  id: string
  personId: string
  name: string
  outcome: 'pendiente' | 'participo' | 'paso' | 'ausente'
  drawnBy: string
  createdAt: string
}

/** GET /api/live/<id>/console: lo que muestra el panel lateral del profesor. */
export interface ConsoleSnapshot {
  transcript: TranscriptLine[]
  turns: AgentTurnLine[]
  activePoll: PollSnapshot | null
  draws: DrawLine[]
  round: { id: string; drawn: number; remaining: number } | null
}

/** Slide tal como la usa el proyector. */
export interface LiveSlide {
  id: string
  position: number
  markdown: string
  title: string | null
  kind: string
  teacherNotes?: string | null
}

/** Eventos de broadcast que emite esta feature, además de los del SPEC. */
export const LIVE_FEATURE_EVENTS = {
  /** {turnId, utterance, reply, actions} · el agente terminó un turno. */
  agentTurn: 'agent.turn',
  /** {draw: DrawLine} · hubo un sorteo o cambió su resultado. */
  draw: 'draw',
  /** {transcriptEnabled} · se prendió o apagó la transcripción. */
  settings: 'settings',
  /** {} · la clase terminó. */
  ended: 'session.ended',
} as const

/** URL absoluta (para QRs) a partir de un origin y una ruta o URL. */
export function absoluteUrl(origin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${origin.replace(/\/$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

/** Normaliza un nombre para comparar: minúsculas, sin acentos ni signos. */
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Términos de una respuesta de nube de palabras (coma, punto y coma o salto de línea). */
export function cloudTerms(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(/[,\n;]+/)) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, 40)
    if (t) seen.add(t)
    if (seen.size >= 3) break
  }
  return [...seen]
}

/** Iniciales para el avatar del sorteo. */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
