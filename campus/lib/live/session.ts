import 'server-only'
import { NextResponse } from 'next/server'
import { getSession, type Session } from '@/lib/auth'
import { db } from '@/lib/db'
import type { LiveSession, Overlay } from '@/lib/db-types'
import { broadcast, LIVE_EVENTS, type LiveState } from '@/lib/realtime'
import { getDeckVersion } from '@/lib/decks/store'

/* Operaciones de estado de la clase en vivo. Todo cambio visible pasa por
   acá: se guarda en live_sessions, se registra en live_events y se emite
   `state` por Realtime. Las usan las APIs de app/api/live y el agente. */

export class LiveError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** Sesión para route handlers: devuelve la sesión o una respuesta 401/403 lista. */
export async function apiSession(role?: 'profesor' | 'alumno'): Promise<Session | NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Necesitás ingresar.' }, { status: 401 })
  if (role && session.role !== role) return NextResponse.json({ error: 'Solo para el profesor.' }, { status: 403 })
  return session
}

export function jsonError(err: unknown): NextResponse {
  if (err instanceof LiveError) return NextResponse.json({ error: err.message }, { status: err.status })
  console.error('[live]', err)
  const message = err instanceof Error ? err.message : 'Error inesperado'
  return NextResponse.json({ error: message }, { status: 500 })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadLive(liveSessionId: string): Promise<LiveSession> {
  if (!UUID.test(liveSessionId)) throw new LiveError('Clase inexistente.', 404)
  const { data, error } = await db().from('live_sessions').select('*').eq('id', liveSessionId).maybeSingle()
  if (error) throw new Error(`live_sessions: ${error.message}`)
  if (!data) throw new LiveError('Clase inexistente.', 404)
  return data as LiveSession
}

export async function loadLiveOpen(liveSessionId: string): Promise<LiveSession> {
  const live = await loadLive(liveSessionId)
  if (live.status !== 'live') throw new LiveError('La clase ya terminó.', 409)
  return live
}

/** Registra un evento en live_events sin emitirlo (el estado sale por `state`). */
export async function logEvent(liveSessionId: string, type: string, payload: Record<string, unknown>, actor = 'profesor'): Promise<void> {
  const { error } = await db().from('live_events').insert({ live_session_id: liveSessionId, type, payload, actor })
  if (error) console.error(`live_events ${type}: ${error.message}`)
}

/** Copia en `live` (in place) la fila que devolvió la DB: el agente y las rutas siguen con el estado real. */
function applyRow(live: LiveSession, row: Record<string, unknown> | null | undefined): LiveSession {
  if (row) Object.assign(live, row)
  return live
}

/** Relee la fila de la clase y la copia en `live` (in place). Usalo antes de decidir algo con la posición u overlay. */
export async function refreshLive(live: LiveSession): Promise<LiveSession> {
  const { data, error } = await db().from('live_sessions').select('*').eq('id', live.id).maybeSingle()
  if (error) throw new Error(`live_sessions: ${error.message}`)
  return applyRow(live, data as Record<string, unknown> | null)
}

/** Emite `state` con la fila de la DB (la que devolvieron las funciones atómicas o releída). */
export async function publishState(live: Pick<LiveSession, 'id' | 'deck_id' | 'current_position' | 'overlay' | 'seq'>, deckVersion?: number): Promise<LiveState> {
  const state: LiveState = {
    position: live.current_position,
    overlay: live.overlay ?? null,
    deckVersion: deckVersion ?? (await getDeckVersion(live.deck_id)),
    seq: Number(live.seq ?? 0),
  }
  await broadcast(live.id, LIVE_EVENTS.state, state)
  return state
}

export async function deckLength(deckId: string): Promise<number> {
  const { count, error } = await db().from('deck_slides').select('position', { count: 'exact', head: true }).eq('deck_id', deckId)
  if (error) throw new Error(`deck_slides: ${error.message}`)
  if (count) return count
  const { data } = await db().from('decks').select('kind, html_slide_count').eq('id', deckId).maybeSingle()
  return data?.kind === 'html' ? (data.html_slide_count ?? 0) : 0
}

/**
 * Mueve la clase a una posición (0-based, se acota al deck). Atómico en la DB
 * (live_goto): solo cambia la posición (y limpia la overlay de «confusión»),
 * sube seq y emite el estado que quedó guardado.
 */
export async function setPosition(live: LiveSession, position: number, actor = 'profesor'): Promise<LiveState> {
  const from = live.current_position
  const { data, error } = await db().rpc('live_goto', { p_id: live.id, p_position: Math.round(position) })
  if (error) throw new Error(`goto: ${error.message}`)
  if (!data) throw new LiveError('La clase ya terminó.', 409)
  applyRow(live, data as Record<string, unknown>)
  const [state] = await Promise.all([
    publishState(live),
    logEvent(live.id, 'slide.goto', { from, position: live.current_position }, actor),
  ])
  return state
}

/**
 * Pone (o limpia con null) el overlay y emite `state`. Atómico (live_set_overlay).
 * Con `expect`, solo cambia si el overlay actual lo contiene (jsonb @>);
 * devuelve changed=false si no.
 */
export async function setOverlay(live: LiveSession, overlay: Overlay | null, actor = 'profesor', expect?: Record<string, unknown>): Promise<LiveState & { changed: boolean }> {
  const { data, error } = await db().rpc('live_set_overlay', { p_id: live.id, p_overlay: overlay, p_expect: expect ?? null })
  if (error) throw new Error(`overlay: ${error.message}`)
  const res = data as { row: Record<string, unknown>; changed: boolean } | null
  if (!res) throw new LiveError('Clase inexistente.', 404)
  applyRow(live, res.row)
  if (!res.changed) {
    if (live.status !== 'live') throw new LiveError('La clase ya terminó.', 409)
    return { position: live.current_position, overlay: live.overlay ?? null, deckVersion: await getDeckVersion(live.deck_id), seq: Number(live.seq ?? 0), changed: false }
  }
  const [state] = await Promise.all([
    publishState(live),
    logEvent(live.id, overlay ? 'overlay.set' : 'overlay.clear', { overlay }, actor),
  ])
  return { ...state, changed: true }
}

export async function setTranscriptEnabled(live: LiveSession, enabled: boolean, actor = 'profesor'): Promise<void> {
  const { error } = await db().from('live_sessions').update({ transcript_enabled: enabled }).eq('id', live.id)
  if (error) throw new Error(`transcript_enabled: ${error.message}`)
  live.transcript_enabled = enabled
  await Promise.all([
    logEvent(live.id, 'settings', { transcriptEnabled: enabled }, actor),
    broadcast(live.id, 'settings', { transcriptEnabled: enabled }),
  ])
}

export async function endLive(live: LiveSession, actor = 'profesor'): Promise<void> {
  if (live.status === 'ended') return
  const { data, error } = await db().rpc('live_end', { p_id: live.id })
  if (error) throw new Error(`end: ${error.message}`)
  applyRow(live, data as Record<string, unknown>)
  // las encuestas abiertas de la clase se cierran
  await db().from('polls').update({ status: 'closed', closed_at: live.ended_at ?? new Date().toISOString() }).eq('live_session_id', live.id).eq('status', 'open')
  await Promise.all([
    logEvent(live.id, 'session.ended', {}, actor),
    broadcast(live.id, 'session.ended', {}),
    publishState(live),
  ])
}

/** Después de cambiar el orden de un deck (editor, MCP, seed): emite `state` de cada clase viva del deck. */
export async function publishDeckSessions(deckId: string, deckVersion?: number): Promise<void> {
  const { data } = await db().from('live_sessions').select('*').eq('deck_id', deckId).eq('status', 'live')
  await Promise.all(((data ?? []) as LiveSession[]).map((l) => publishState(l, deckVersion).catch(() => undefined)))
}

/** Slide de una posición del deck (id + markdown + notas). */
export async function slideAt(deckId: string, position: number): Promise<{ id: string; markdown: string; teacher_notes: string | null; kind: string; title: string | null } | null> {
  const { data } = await db()
    .from('deck_slides')
    .select('slide_id, slides(id, markdown, teacher_notes, kind, title)')
    .eq('deck_id', deckId)
    .eq('position', position)
    .maybeSingle()
  const s = (data as unknown as { slides: { id: string; markdown: string; teacher_notes: string | null; kind: string; title: string | null } | null } | null)?.slides
  return s ?? null
}

/** course_id del deck de la clase (cae al curso por defecto). */
export async function courseOfLive(live: LiveSession): Promise<string> {
  const { data } = await db().from('decks').select('course_id').eq('id', live.deck_id).maybeSingle()
  return (data?.course_id as string | null) ?? 'ai-centric-management'
}

/** class_session de la clase en vivo (o la del deck). */
export async function classSessionOfLive(live: LiveSession): Promise<string | null> {
  if (live.class_session_id) return live.class_session_id
  const { data } = await db().from('class_sessions').select('id').eq('deck_id', live.deck_id).limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}
