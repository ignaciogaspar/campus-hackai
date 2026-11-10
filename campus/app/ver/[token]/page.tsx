import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeckPlayer } from '@/components/deck/DeckPlayer'
import { getPublicDeck } from '@/lib/decks/store'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const loaded = await getPublicDeck(token)
  return {
    title: { absolute: loaded?.deck.title ?? 'Presentación' },
    description: loaded?.deck.question ?? undefined,
    robots: { index: false, follow: false },
  }
}

/** Deck por link público: sin login, sin notas del docente. */
export default async function PublicDeckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const loaded = await getPublicDeck(token)
  if (!loaded) notFound()
  const { deck, slides } = loaded

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{deck.title}</h1>
          {deck.question ? <p className="muted">{deck.question}</p> : null}
        </div>
      </div>
      {deck.kind === 'html' && deck.htmlUrl ? (
        <iframe src={deck.htmlUrl} title={deck.title} style={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid var(--borde)' }} allowFullScreen />
      ) : (
        <DeckPlayer
          slides={slides.map((s) => ({ id: s.id, position: s.position, markdown: s.markdown, title: s.title }))}
          chapters={deck.chapters}
          audio
        />
      )}
    </div>
  )
}
