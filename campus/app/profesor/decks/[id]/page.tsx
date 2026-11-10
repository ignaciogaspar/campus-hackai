import Link from 'next/link'
import { notFound } from 'next/navigation'
import { startLiveSession } from '@/app/actions/start-live'
import { DeckEditor } from '@/components/authoring/DeckEditor'
import { DeckMetaForm } from '@/components/authoring/DeckMetaForm'
import { DeckPublicLink } from '@/components/authoring/DeckPublicLink'
import '@/components/authoring/authoring.css'
import { requireSession } from '@/lib/auth'
import { loadEditorSlides } from '@/lib/authoring/repo'
import { authoringRoutes } from '@/lib/authoring/routes'
import { db } from '@/lib/db'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'

/** Editor del deck: miniaturas, DSL con vista previa, notas del docente, historial, biblioteca y agente. */
export default async function DeckEditorPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ slide?: string }>
}) {
  await requireSession('profesor')
  const { id } = await params
  const { slide } = await searchParams
  const sb = db()
  const { data: deck } = await sb.from('decks').select('id, title, question, kind, public_token').eq('id', id).maybeSingle()
  if (!deck) notFound()
  const [slides, { data: sessions }] = await Promise.all([
    loadEditorSlides(sb, id),
    sb.from('class_sessions').select('id, ordinal, block').eq('deck_id', id).order('ordinal'),
  ])
  const cs = (sessions ?? [])[0] as { id: string; ordinal: number; block: string | null } | undefined
  const jornada = cs ? `Jornada ${cs.ordinal}${cs.block ? ` · ${cs.block}` : ''}` : undefined
  const initial = Math.max(0, (Number(slide) || 1) - 1)

  return (
    <div className="au-page">
      <div className="au-head">
        <div>
          <Link href={authoringRoutes.decks} className="chico">← Decks</Link>
          <div className="kicker">{jornada ?? 'Deck sin jornada'} · {id}</div>
          <DeckMetaForm deckId={id} title={deck.title} question={deck.question} />
        </div>
        <div className="au-head-actions">
          <Link className="btn btn-sm" href={authoringRoutes.biblioteca}>Biblioteca</Link>
          <Link className="btn btn-sm" href={routes.campusDeck(id)}>Ver como alumno</Link>
          <DeckPublicLink deckId={id} initialToken={deck.public_token} />
          <Link className="btn btn-sm" href={routes.analitica(id)}>Analítica</Link>
          <form action={startLiveSession}>
            <input type="hidden" name="deckId" value={id} />
            {cs ? <input type="hidden" name="classSessionId" value={cs.id} /> : null}
            <button className="btn btn-primario btn-sm" type="submit">Iniciar clase en vivo</button>
          </form>
        </div>
      </div>
      {deck.kind === 'html' ? (
        <div className="alerta alerta-aviso">Este deck es un sitio HTML estático: no tiene slides editables en el campus.</div>
      ) : (
        <DeckEditor deckId={id} initialSlides={slides} initialPosition={initial}
          contexto={jornada ? { materia: 'AI-Centric Management', jornada } : undefined} />
      )}
    </div>
  )
}
