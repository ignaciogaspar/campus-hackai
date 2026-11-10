import 'server-only'
import { createHmac } from 'node:crypto'
import { db } from './db'
import type { Overlay } from './db-types'
import { getDeckVersion } from './decks/store'

/* Tiempo real: Supabase Realtime Broadcast con canales PRIVADOS.
   - `live:<liveSessionId>`: proyector y celulares (state, deck.changed,
     poll.updated sin textos, session.ended, marks/postures/sim.updated).
   - `liveprof:<liveSessionId>:<firma>`: solo la consola del profesor
     (transcript, agent.turn, draw, settings, poll.updated completo). La firma
     es un HMAC con SESSION_SECRET: no se puede derivar del id de la clase.
   El servidor emite por REST con la service key (`private: true`). Los
   clientes escuchan con la anon key y `config.private`; la política RLS de
   realtime.messages (migración 0140) les deja leer pero nunca emitir, así
   que nadie puede inyectar eventos falsos. */

/** Eventos de broadcast del SPEC. */
export const LIVE_EVENTS = {
  state: 'state',
  deckChanged: 'deck.changed',
  pollUpdated: 'poll.updated',
  transcript: 'transcript',
} as const

/** Estado visible de una clase en vivo (payload del evento `state`). */
export interface LiveState {
  position: number
  overlay: Overlay | null
  /** Versión del deck (epoch ms de decks.updated_at). Si cambia, recargá slides. */
  deckVersion: number
  /** Contador monotónico del estado (live_sessions.seq): ignorá un state con seq menor al último aplicado. */
  seq: number
}

export interface LiveStateFull extends LiveState {
  liveSessionId: string
  deckId: string
  code: string
  status: 'live' | 'ended'
  transcriptEnabled: boolean
}

export function liveChannelName(liveSessionId: string): string {
  return `live:${liveSessionId}`
}

/** Canal privado de la consola del profesor. Solo se le pasa a la página /live/[id] (profesor). */
export function liveProfChannelName(liveSessionId: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('Falta SESSION_SECRET')
  const sig = createHmac('sha256', secret).update(`liveprof:${liveSessionId}`).digest('base64url').slice(0, 32)
  return `liveprof:${liveSessionId}:${sig}`
}

/** Eventos que solo ve el profesor (llevan transcripción, órdenes, notas o resultados de sorteos). */
const PROF_ONLY_EVENTS = new Set(['transcript', 'agent.turn', 'draw', 'settings', 'poll.created', 'cold_call.draw', 'cold_call.outcome', 'participation.logged'])

export type Audience = 'public' | 'prof' | 'both'

function audienceOf(event: string): Audience {
  if (PROF_ONLY_EVENTS.has(event)) return 'prof'
  // poll.updated: completo al profesor; a los celulares solo {pollId, total, status}
  if (event === 'poll.updated') return 'both'
  return 'public'
}

function publicPayload(event: string, payload: unknown): unknown {
  if (event !== 'poll.updated' || !payload || typeof payload !== 'object') return payload
  const p = payload as Record<string, unknown>
  return { pollId: p.pollId, total: p.total, ...(p.status ? { status: p.status } : {}) }
}

/**
 * Manda un evento de broadcast a los canales de la clase (REST de Realtime).
 * El destino sale del nombre del evento (ver PROF_ONLY_EVENTS) salvo que se
 * pase `audience`. No tira si falla: devuelve false y lo loguea (el estado ya
 * quedó en la DB).
 */
export async function broadcast(liveSessionId: string, event: string, payload: unknown, audience: Audience = audienceOf(event)): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  const messages: { topic: string; event: string; payload: unknown; private: true }[] = []
  if (audience === 'public' || audience === 'both') messages.push({ topic: liveChannelName(liveSessionId), event, payload: publicPayload(event, payload), private: true })
  if (audience === 'prof' || audience === 'both') messages.push({ topic: liveProfChannelName(liveSessionId), event, payload, private: true })
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`broadcast ${event} → ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`broadcast ${event} falló`, err)
    return false
  }
}

/**
 * Registra un evento en live_events y lo emite por broadcast con el mismo
 * nombre. `type` libre: 'slide.goto', 'overlay.set', 'poll.created', … o los
 * del SPEC ('state', 'deck.changed', 'poll.updated', 'transcript').
 * actor: 'profesor' | 'agent' | `alumno:<personId>`.
 */
export async function emitLive(liveSessionId: string, type: string, payload: Record<string, unknown> = {}, actor = 'profesor'): Promise<void> {
  const { error } = await db().from('live_events').insert({ live_session_id: liveSessionId, type, payload, actor })
  if (error) console.error(`live_events ${type}: ${error.message}`)
  await broadcast(liveSessionId, type, payload)
}

/** Estado actual de una clase en vivo leído de la DB (lo que devuelve GET /api/live/<id>/state). */
export async function getLiveState(liveSessionId: string): Promise<LiveStateFull | null> {
  const { data } = await db()
    .from('live_sessions')
    .select('id, deck_id, code, status, current_position, overlay, transcript_enabled, seq')
    .eq('id', liveSessionId)
    .maybeSingle()
  if (!data) return null
  return {
    liveSessionId: data.id,
    deckId: data.deck_id,
    code: data.code,
    status: data.status,
    transcriptEnabled: data.transcript_enabled,
    position: data.current_position,
    overlay: (data.overlay as Overlay | null) ?? null,
    deckVersion: await getDeckVersion(data.deck_id),
    seq: Number(data.seq ?? 0),
  }
}

/** Lee el estado de la DB y lo emite como `state` (sin registrar en live_events). */
export async function broadcastState(liveSessionId: string): Promise<LiveState | null> {
  const full = await getLiveState(liveSessionId)
  if (!full) return null
  const state: LiveState = { position: full.position, overlay: full.overlay, deckVersion: full.deckVersion, seq: full.seq }
  await broadcast(liveSessionId, LIVE_EVENTS.state, state)
  return state
}
