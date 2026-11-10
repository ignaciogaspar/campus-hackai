import { getDeckVersion } from '@/lib/decks/store'
import { withLive, type LiveRouteParams } from '@/lib/live/route'

export const dynamic = 'force-dynamic'

/** GET: estado visible de la clase (profesor o alumno logueado). */
export async function GET(_req: Request, ctx: LiveRouteParams) {
  return withLive(ctx, {}, async (live) => ({
    liveSessionId: live.id,
    deckId: live.deck_id,
    code: live.code,
    status: live.status,
    transcriptEnabled: live.transcript_enabled,
    position: live.current_position,
    overlay: live.overlay ?? null,
    deckVersion: await getDeckVersion(live.deck_id),
    seq: Number(live.seq ?? 0),
  }))
}
