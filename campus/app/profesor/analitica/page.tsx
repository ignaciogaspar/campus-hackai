import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { getClassSessions } from '@/lib/course'
import { COURSE_ID } from '@/lib/db'
import { listDecks } from '@/lib/decks/store'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analítica' }

export default async function AnaliticaIndex() {
  await requireSession('profesor')
  const [decks, sessions] = await Promise.all([listDecks(COURSE_ID).catch(() => []), getClassSessions()])
  const ordinal = new Map(sessions.filter((s) => s.deck_id).map((s) => [s.deck_id as string, s.ordinal]))
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Aula</div>
          <h1>Analítica por slide</h1>
          <p className="muted chico">Elegí un deck para ver marcas, notas, encuestas, transcripción y preguntas al tutor en cada slide.</p>
        </div>
      </div>
      {decks.length === 0 ? <div className="vacio">No hay decks cargados.</div> : (
        <div className="grid">
          {decks.map((d) => (
            <Link key={d.id} href={routes.analitica(d.id)} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="kicker">{ordinal.has(d.id) ? `J${ordinal.get(d.id)}` : d.id}</div>
              <h3 style={{ fontSize: 16 }}>{d.title}</h3>
              <p className="muted chico" style={{ margin: 0 }}>{d.slideCount} slides</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
