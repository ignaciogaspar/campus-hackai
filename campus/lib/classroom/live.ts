import 'server-only'
import { db } from '@/lib/db'
import type { Overlay } from '@/lib/db-types'
import { loadLive, setOverlay } from '@/lib/live/session'

/* Puente con la clase en vivo: encontrar la clase activa y poner un overlay
   (con el mismo helper que usa la consola y el agente). */

export interface ActiveLive {
  id: string
  deckId: string
  classSessionId: string | null
  code: string
  overlay: Overlay | null
  startedAt: string
}

/**
 * La clase en vivo activa (status 'live'). Si se pasa classSessionId,
 * prefiere la de esa jornada; si no hay, devuelve la más reciente.
 */
export async function activeLiveSession(classSessionId?: string | null): Promise<ActiveLive | null> {
  const { data } = await db()
    .from('live_sessions')
    .select('id, deck_id, class_session_id, code, overlay, started_at')
    .eq('status', 'live')
    .order('started_at', { ascending: false })
    .limit(10)
  const rows = (data ?? []) as Array<{ id: string; deck_id: string; class_session_id: string | null; code: string; overlay: Overlay | null; started_at: string }>
  const pick = (classSessionId ? rows.find((r) => r.class_session_id === classSessionId) : undefined) ?? rows[0]
  if (!pick) return null
  return { id: pick.id, deckId: pick.deck_id, classSessionId: pick.class_session_id, code: pick.code, overlay: pick.overlay, startedAt: pick.started_at }
}

/**
 * Pone (o limpia con null) el overlay de una clase en vivo. Delega en
 * lib/live/session setOverlay (guarda, registra en live_events y emite `state`).
 */
export async function setLiveOverlay(liveSessionId: string, overlay: Overlay | null, actor = 'profesor'): Promise<void> {
  const live = await loadLive(liveSessionId)
  await setOverlay(live, overlay, actor)
}

/** class_session_id de una clase en vivo (o null). */
export async function classSessionOfLive(liveSessionId: string | null | undefined): Promise<string | null> {
  if (!liveSessionId) return null
  const { data } = await db().from('live_sessions').select('class_session_id').eq('id', liveSessionId).maybeSingle()
  return (data?.class_session_id as string | null) ?? null
}
