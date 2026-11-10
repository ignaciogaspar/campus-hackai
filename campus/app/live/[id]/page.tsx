import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LiveConsole } from '@/components/live/LiveConsole'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDeck } from '@/lib/decks/store'
import { LiveError, loadLive } from '@/lib/live/session'
import type { LiveSession } from '@/lib/db-types'
import { liveProfChannelName } from '@/lib/realtime'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Clase en vivo' }

/** Proyector + consola del profesor de una clase en vivo. */
export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireSession('profesor')
  let live: LiveSession
  try {
    live = await loadLive(id)
  } catch (err) {
    if (err instanceof LiveError) notFound()
    throw err
  }
  const loaded = await getDeck(live.deck_id, 'profesor')
  if (!loaded) notFound()
  const csId = live.class_session_id
  const { data: cs } = csId
    ? await db().from('class_sessions').select('ordinal, block').eq('id', csId).maybeSingle()
    : await db().from('class_sessions').select('ordinal, block').eq('deck_id', live.deck_id).limit(1).maybeSingle()
  const jornada = cs ? `Jornada ${cs.ordinal}${cs.block ? ` · ${cs.block}` : ''}` : undefined

  return (
    <LiveConsole
      liveSessionId={live.id}
      profChannel={liveProfChannelName(live.id)}
      code={live.code}
      deckId={live.deck_id}
      deckTitle={loaded.deck.title}
      deckKind={loaded.deck.kind}
      htmlUrl={loaded.deck.htmlUrl}
      htmlSlideCount={loaded.deck.htmlSlideCount}
      materia="AI-Centric Management"
      jornada={jornada}
      initial={{
        position: live.current_position,
        overlay: live.overlay,
        transcriptEnabled: live.transcript_enabled,
        status: live.status,
        deckVersion: loaded.deck.version,
        seq: Number(live.seq ?? 0),
        slides: loaded.slides.map((s) => ({ id: s.id, position: s.position, markdown: s.markdown, title: s.title, kind: s.kind, teacherNotes: s.teacherNotes ?? null })),
      }}
    />
  )
}
