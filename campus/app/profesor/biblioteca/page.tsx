import Link from 'next/link'
import { LibraryBrowser } from '@/components/authoring/LibraryBrowser'
import '@/components/authoring/authoring.css'
import { requireSession } from '@/lib/auth'
import { libraryFacets, searchLibrary } from '@/lib/authoring/library'
import { authoringRoutes } from '@/lib/authoring/routes'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE = 36

type Params = { q?: string; tipo?: string; tag?: string; autor?: string; deck?: string; p?: string }

/** Repositorio único de slides: búsqueda full-text y filtros por tipo, tag, autor y deck de origen. */
export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireSession('profesor')
  const sp = await searchParams
  const page = Math.max(1, Number(sp.p) || 1)
  const sb = db()
  const [result, facets] = await Promise.all([
    searchLibrary(sb, { q: sp.q, kind: sp.tipo, tag: sp.tag, authorId: sp.autor, deckId: sp.deck, limit: PAGE, offset: (page - 1) * PAGE }),
    libraryFacets(sb),
  ])
  const pages = Math.max(1, Math.ceil(result.total / PAGE))
  const href = (p: number) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'p') u.set(k, v)
    if (p > 1) u.set('p', String(p))
    const s = u.toString()
    return `${authoringRoutes.biblioteca}${s ? `?${s}` : ''}`
  }

  return (
    <div className="au-page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="kicker">Repositorio único</div>
          <h1>Biblioteca de slides</h1>
          <p className="muted">Todas las slides de todos los decks y profesores. Buscá, previsualizá y usalas en cualquier deck.</p>
        </div>
        <Link className="btn" href={authoringRoutes.decks}>Decks</Link>
      </div>

      <form className="au-filtros" method="get">
        <label className="field au-q">
          <span>Buscar</span>
          <input className="input" name="q" defaultValue={sp.q ?? ''} placeholder="costo del error, Pampa Sur, agentes, HITL…" />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select className="select" name="tipo" defaultValue={sp.tipo ?? ''}>
            <option value="">Todos</option>
            {facets.kinds.map((k) => <option key={k.kind} value={k.kind}>{k.kind} ({k.count})</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tag</span>
          <select className="select" name="tag" defaultValue={sp.tag ?? ''}>
            <option value="">Todos</option>
            {facets.tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
          </select>
        </label>
        <label className="field">
          <span>Autor</span>
          <select className="select" name="autor" defaultValue={sp.autor ?? ''}>
            <option value="">Todos</option>
            {facets.authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Deck</span>
          <select className="select" name="deck" defaultValue={sp.deck ?? ''}>
            <option value="">Todos</option>
            {facets.decks.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
        </label>
        <button className="btn btn-primario" type="submit">Buscar</button>
        {Object.values(sp).some(Boolean) ? <Link className="btn btn-ghost" href={authoringRoutes.biblioteca}>Limpiar</Link> : null}
      </form>

      <p className="chico muted">{result.total} slide{result.total === 1 ? '' : 's'}{pages > 1 ? ` · página ${page} de ${pages}` : ''}. Tocá una para verla grande; marcá varias para usarlas juntas.</p>

      {result.slides.length ? (
        <LibraryBrowser slides={result.slides} decks={facets.decks} />
      ) : <div className="vacio">No hay slides con esos filtros.</div>}

      {pages > 1 ? (
        <nav className="au-paginas" aria-label="Páginas">
          {page > 1 ? <Link className="btn btn-sm" href={href(page - 1)}>← Anterior</Link> : null}
          <span className="chico">{page} / {pages}</span>
          {page < pages ? <Link className="btn btn-sm" href={href(page + 1)}>Siguiente →</Link> : null}
        </nav>
      ) : null}
    </div>
  )
}
