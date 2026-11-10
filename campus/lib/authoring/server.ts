import 'server-only'
import { db } from '@/lib/db'
import { emitLive } from '@/lib/realtime'
import { touchDeck } from '@/lib/decks/store'
import { publishDeckSessions } from '@/lib/live/session'
import { usageOf } from './repo'

/**
 * Después de cambiar slides: marca como cambiados los decks afectados
 * (versión nueva) y, si alguno está en una clase en vivo, emite
 * `deck.changed {deckVersion}` para que proyector y celulares recarguen.
 * `slideIds` suma todos los decks donde se usan esas slides (editar para todos).
 */
export async function notifyDeckChanged(deckIds: string[], slideIds: string[] = []): Promise<Record<string, number>> {
  const all = new Set(deckIds)
  if (slideIds.length) {
    for (const uses of (await usageOf(db(), slideIds)).values()) for (const u of uses) all.add(u.deckId)
  }
  const versions: Record<string, number> = {}
  if (all.size === 0) return versions
  for (const id of all) versions[id] = await touchDeck(id)
  const { data: live } = await db().from('live_sessions').select('id, deck_id').eq('status', 'live').in('deck_id', [...all])
  await Promise.all(((live ?? []) as { id: string; deck_id: string }[]).map((s) =>
    emitLive(s.id, 'deck.changed', { deckVersion: versions[s.deck_id] }, 'profesor').catch(() => undefined)))
  // authoring_set_deck_order / live_insert_deck_slide ya recalcularon
  // current_position (sigue a la slide que se estaba dando): emitimos el estado.
  const liveDecks = new Set(((live ?? []) as { deck_id: string }[]).map((s) => s.deck_id))
  await Promise.all([...liveDecks].map((d) => publishDeckSessions(d, versions[d]).catch(() => undefined)))
  return versions
}
