import 'server-only'
import { db } from '@/lib/db'

/* Transcripción después de la clase: listado de clases, búsqueda por texto y
   vista cronológica completa (para /profesor/transcripcion y su descarga). */

export interface LiveWithTranscript {
  id: string
  deckId: string
  deckTitle: string
  code: string
  startedAt: string
  status: 'live' | 'ended'
  segments: number
}

export interface ArchiveLine {
  id: number
  text: string
  isCommand: boolean
  position: number | null
  createdAt: string
}

export async function livesWithTranscript(limit = 40): Promise<LiveWithTranscript[]> {
  const { data } = await db().from('live_sessions')
    .select('id, deck_id, code, started_at, status, decks(title), transcript_segments(count)')
    .order('started_at', { ascending: false }).limit(limit)
  return ((data ?? []) as unknown as Array<{ id: string; deck_id: string; code: string; started_at: string; status: 'live' | 'ended'; decks: { title: string } | null; transcript_segments: { count: number }[] }>)
    .map((r) => ({ id: r.id, deckId: r.deck_id, deckTitle: r.decks?.title ?? r.deck_id, code: r.code, startedAt: r.started_at, status: r.status, segments: r.transcript_segments?.[0]?.count ?? 0 }))
}

/** Toda la transcripción de una clase, en orden. Con `q`, solo los fragmentos que contienen el texto (sin distinguir mayúsculas). */
export async function transcriptLines(liveSessionId: string, opts: { q?: string; includeCommands?: boolean; limit?: number } = {}): Promise<ArchiveLine[]> {
  let query = db().from('transcript_segments').select('id, text, is_command, slide_position, created_at').eq('live_session_id', liveSessionId)
  if (!opts.includeCommands) query = query.eq('is_command', false)
  const q = opts.q?.trim()
  if (q) query = query.ilike('text', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  const { data } = await query.order('id', { ascending: true }).limit(opts.limit ?? 5000)
  return ((data ?? []) as Array<{ id: number; text: string; is_command: boolean; slide_position: number | null; created_at: string }>)
    .map((r) => ({ id: r.id, text: r.text, isCommand: r.is_command, position: r.slide_position, createdAt: r.created_at }))
}
