import 'server-only'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { broadcast, LIVE_EVENTS } from '@/lib/realtime'
import { slideAt } from './session'
import type { AgentAction, AgentTurnLine, TranscriptLine } from './types'

/* Transcripción de la clase: segmentos finales del reconocedor con la
   posición de slide del momento (la del servidor, no la del cliente). */

export async function saveSegment(live: LiveSession, input: { text: string; isCommand: boolean; speaker?: string }): Promise<TranscriptLine | null> {
  const text = input.text.replace(/\s+/g, ' ').trim().slice(0, 4000)
  if (!text) return null
  // sin transcripción encendida solo se guardan las órdenes al agente
  if (!input.isCommand && !live.transcript_enabled) return null
  const slide = await slideAt(live.deck_id, live.current_position)
  const { data, error } = await db().from('transcript_segments').insert({
    live_session_id: live.id,
    slide_position: live.current_position,
    slide_id: slide?.id ?? null,
    speaker: input.speaker ?? 'profesor',
    text,
    is_command: input.isCommand,
  }).select('id, created_at').single()
  if (error || !data) throw new Error(`transcript: ${error?.message}`)
  await broadcast(live.id, LIVE_EVENTS.transcript, { text, isCommand: input.isCommand, position: live.current_position })
  return { id: data.id as number, text, isCommand: input.isCommand, position: live.current_position, createdAt: data.created_at as string }
}

export async function recentTranscript(liveSessionId: string, opts: { sinceMinutes?: number; limit?: number; includeCommands?: boolean } = {}): Promise<TranscriptLine[]> {
  let q = db().from('transcript_segments').select('id, text, is_command, slide_position, created_at').eq('live_session_id', liveSessionId)
  if (opts.sinceMinutes) q = q.gte('created_at', new Date(Date.now() - opts.sinceMinutes * 60_000).toISOString())
  if (opts.includeCommands === false) q = q.eq('is_command', false)
  const { data } = await q.order('id', { ascending: false }).limit(opts.limit ?? 60)
  return ((data ?? []) as { id: number; text: string; is_command: boolean; slide_position: number | null; created_at: string }[])
    .reverse()
    .map((r) => ({ id: r.id, text: r.text, isCommand: r.is_command, position: r.slide_position, createdAt: r.created_at }))
}

/**
 * Busca en toda la transcripción de la clase (términos sueltos, sin acentos).
 * Devuelve los fragmentos que coinciden con 3 de contexto antes y después,
 * en orden: una idea suele venir partida en varias frases.
 */
export async function searchTranscript(liveSessionId: string, query: string, limit = 30): Promise<TranscriptLine[]> {
  const all = await recentTranscript(liveSessionId, { limit: 2000, includeCommands: false })
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const terms = norm(query).split(/[^a-z0-9ñ]+/).filter((t) => t.length > 2)
  if (!terms.length) return all.slice(-limit)
  const scored = all.map((l, i) => ({ i, score: terms.filter((t) => norm(l.text).includes(t.length > 5 ? t.slice(0, -1) : t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.i - a.i)
    .slice(0, 6)
  const keep = new Set<number>()
  for (const { i } of scored) for (let j = Math.max(0, i - 3); j <= Math.min(all.length - 1, i + 3); j++) keep.add(j)
  return [...keep].sort((a, b) => a - b).slice(0, limit).map((i) => all[i])
}

export async function recentTurns(liveSessionId: string, limit = 8): Promise<AgentTurnLine[]> {
  const { data } = await db().from('agent_turns').select('id, utterance, reply, error, latency_ms, tool_calls, created_at')
    .eq('live_session_id', liveSessionId).eq('surface', 'live').order('id', { ascending: false }).limit(limit)
  return ((data ?? []) as { id: number; utterance: string; reply: string | null; error: string | null; latency_ms: number | null; tool_calls: AgentAction[]; created_at: string }[])
    .map((r) => ({ id: r.id, utterance: r.utterance, reply: r.reply, error: r.error, latencyMs: r.latency_ms, actions: r.tool_calls ?? [], createdAt: r.created_at }))
}
