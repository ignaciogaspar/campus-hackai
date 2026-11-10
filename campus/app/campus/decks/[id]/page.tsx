import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeckStudy } from '@/components/student/DeckStudy'
import { requirePerson } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDeck } from '@/lib/decks/store'
import { parseSlide, slideTitle } from '@/lib/decks/parse'
import { routes } from '@/lib/routes'
import { listMyMarks, listMyNotes } from '@/lib/student/core'

export const dynamic = 'force-dynamic'

/** Deck fuera de clase, con marcas, notas, índice y «Mis notas». */
export default async function CampusDeckPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ s?: string }>
}) {
  const { id } = await params
  const { s } = await searchParams
  const { person } = await requirePerson('alumno')
  const loaded = await getDeck(id, 'alumno')
  if (!loaded) notFound()
  const client = db()
  const [marks, notes, cs] = await Promise.all([
    listMyMarks(client, person.id, id),
    listMyNotes(client, person.id, id),
    client.from('class_sessions').select('ordinal, block').eq('deck_id', id).maybeSingle().then((r) => r.data),
  ])
  const jornada = cs ? `Jornada ${cs.ordinal}${cs.block ? ` · ${cs.block}` : ''}` : undefined
  const { deck } = loaded

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={`${routes.campus}#decks`} className="chico">← Volver al campus</Link>
          <div className="kicker">{jornada ?? 'Deck'}</div>
          <h1>{deck.title}</h1>
          {deck.question ? <p className="muted">{deck.question}</p> : null}
        </div>
      </div>
      {deck.kind === 'html' && deck.htmlUrl ? (
        <div className="stack">
          <p className="alerta">Este deck es una presentación externa: las marcas y notas por slide no están disponibles.</p>
          <iframe src={deck.htmlUrl} title={deck.title} style={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid var(--borde)' }} />
        </div>
      ) : (
        <DeckStudy
          deckId={id}
          deckTitle={deck.title}
          slides={loaded.slides.map((sl) => ({ id: sl.id, position: sl.position, markdown: sl.markdown, title: sl.title ?? slideTitle(parseSlide(sl.markdown)) }))}
          chapters={deck.chapters}
          contexto={jornada ? { materia: 'AI-Centric Management', jornada } : undefined}
          initialIndex={s ? Math.max(0, Number(s) - 1 || 0) : 0}
          initialMarks={marks}
          initialNotes={notes}
          author={person.full_name}
        />
      )}
    </div>
  )
}
