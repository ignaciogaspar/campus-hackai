import { getDeck } from '@/lib/decks/store'
import { withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError } from '@/lib/live/session'
import type { LiveSlide } from '@/lib/live/types'

export const dynamic = 'force-dynamic'

/** GET: slides del deck de la clase (con notas solo para el profesor). Para recargar tras `deck.changed`. */
export async function GET(_req: Request, ctx: LiveRouteParams) {
  return withLive(ctx, {}, async (live, session) => {
    const loaded = await getDeck(live.deck_id, session.role === 'profesor' ? 'profesor' : 'alumno')
    if (!loaded) throw new LiveError('Deck inexistente.', 404)
    const slides: LiveSlide[] = loaded.slides.map((s) => ({
      id: s.id, position: s.position, markdown: s.markdown, title: s.title, kind: s.kind,
      ...(session.role === 'profesor' ? { teacherNotes: s.teacherNotes ?? null } : {}),
    }))
    return { deckId: loaded.deck.id, title: loaded.deck.title, kind: loaded.deck.kind, htmlUrl: loaded.deck.htmlUrl, version: loaded.deck.version, slides }
  })
}
