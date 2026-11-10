import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeckPlayer } from '@/components/deck/DeckPlayer'
import { homeFor, requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDeck } from '@/lib/decks/store'

export const dynamic = 'force-dynamic'

/** Visor genérico de un deck (fundación). El profesor ve las notas del docente. */
export default async function DeckViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const audience = session.role === 'profesor' ? 'profesor' : 'alumno'
  const loaded = await getDeck(id, audience)
  if (!loaded) notFound()
  const { data: cs } = await db().from('class_sessions').select('ordinal, block').eq('deck_id', id).maybeSingle()
  const jornada = cs ? `Jornada ${cs.ordinal}${cs.block ? ` · ${cs.block}` : ''}` : undefined

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={homeFor(session.role)} className="chico">← Volver</Link>
          <div className="kicker">{jornada ?? 'Deck'}</div>
          <h1>{loaded.deck.title}</h1>
          {loaded.deck.question ? <p className="muted">{loaded.deck.question}</p> : null}
        </div>
      </div>
      <DeckPlayer
        slides={loaded.slides.map((s) => ({ id: s.id, position: s.position, markdown: s.markdown, title: s.title, teacherNotes: s.teacherNotes }))}
        materia="AI-Centric Management"
        contexto={jornada ? { materia: 'AI-Centric Management', jornada } : undefined}
        chapters={loaded.deck.chapters}
        showNotes={audience === 'profesor'}
      />
    </div>
  )
}
