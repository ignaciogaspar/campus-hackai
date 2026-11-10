import 'server-only'
import { NextResponse } from 'next/server'
import { getSession, type Session } from '@/lib/auth'
import { broadcast } from '@/lib/realtime'
import type { MarksUpdatedPayload, PollResults } from './types'

/* Helpers de los route handlers de app/api/student/**. */

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function jsonError(error: string, status = 400): NextResponse {
  return json({ error }, status)
}

/** Sesión o respuesta 401 (las APIs no redirigen). */
export async function apiSession(): Promise<Session | NextResponse> {
  const session = await getSession()
  return session ?? jsonError('Tenés que ingresar al campus.', 401)
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function asPosition(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 10000 ? n : null
}

export function asDeckId(v: unknown): string | null {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/i.test(v) ? v : null
}

/**
 * `poll.updated {pollId, kind, total, counts, texts?}` al canal de la clase.
 * Solo broadcast: la respuesta ya quedó en poll_responses (no se duplica en live_events).
 */
export async function broadcastPollUpdated(liveSessionId: string | null, results: PollResults): Promise<void> {
  if (!liveSessionId) return
  await broadcast(liveSessionId, 'poll.updated', results)
}

/** `marks.updated {deckId, position, counts}`: marcas de la cohorte en esa slide durante la clase. */
export async function broadcastMarksUpdated(liveSessionId: string, payload: MarksUpdatedPayload): Promise<void> {
  await broadcast(liveSessionId, 'marks.updated', payload)
}
