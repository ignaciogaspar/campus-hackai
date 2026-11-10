import Link from 'next/link'
import '@/components/authoring/authoring.css'
import { requireSession } from '@/lib/auth'
import { authoringRoutes } from '@/lib/authoring/routes'
import { db } from '@/lib/db'
import { listDecks } from '@/lib/decks/store'
import { fechaCorta } from '@/lib/format'
import { createDeckAction, setSessionDeckAction } from './actions'

export const dynamic = 'force-dynamic'

/** Lista de decks, nuevo deck (vacío o desde la biblioteca) y asociación deck ↔ jornada. */
export default async function DecksPage({ searchParams }: { searchParams: Promise<{ from?: string; error?: string }> }) {
  await requireSession('profesor')
  const { from, error } = await searchParams
  const [decks, { data: sessions }] = await Promise.all([
    listDecks(),
    db().from('class_sessions').select('id, ordinal, title, block, deck_id, starts_at').order('ordinal'),
  ])
  const jornadas = (sessions ?? []) as { id: string; ordinal: number; title: string; block: string | null; deck_id: string | null; starts_at: string | null }[]
  const jornadaDe = new Map<string, string[]>()
  for (const j of jornadas) if (j.deck_id) jornadaDe.set(j.deck_id, [...(jornadaDe.get(j.deck_id) ?? []), `J${j.ordinal}`])
  const fromIds = (from ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Autoría</div>
          <h1>Decks</h1>
          <p className="muted">Cada deck ordena slides del repositorio único. Editá, armá uno nuevo o asocialo a una jornada.</p>
        </div>
        <Link className="btn" href={authoringRoutes.biblioteca}>Biblioteca de slides</Link>
      </div>

      {error ? <div className="alerta alerta-error">{error}</div> : null}

      <section className="seccion card" id="nuevo">
        <h2>Nuevo deck</h2>
        {fromIds.length ? (
          <p className="chico">Se va a crear con <strong>{fromIds.length} slide{fromIds.length === 1 ? '' : 's'}</strong> elegidas en la biblioteca, en el orden en que las elegiste.</p>
        ) : (
          <p className="chico muted">Arranca vacío. Para armarlo con slides existentes, elegilas en la <Link href={authoringRoutes.biblioteca}>biblioteca</Link> y tocá «Nuevo deck con la selección».</p>
        )}
        <form action={createDeckAction} className="form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, alignItems: 'end' }}>
          <label className="field"><span>Título</span><input className="input" name="title" required placeholder="Jornada 3 · versión corta" /></label>
          <label className="field"><span>Pregunta (opcional)</span><input className="input" name="question" placeholder="¿Qué decide el directorio?" /></label>
          <label className="field">
            <span>Jornada (opcional)</span>
            <select className="select" name="classSessionId" defaultValue="">
              <option value="">Sin jornada</option>
              {jornadas.map((j) => <option key={j.id} value={j.id}>J{j.ordinal} · {j.title}</option>)}
            </select>
          </label>
          {fromIds.length ? (
            <>
              <input type="hidden" name="slideIds" value={fromIds.join(',')} />
              <label className="field">
                <span>Slides</span>
                <select className="select" name="copy" defaultValue="">
                  <option value="">Usar las mismas (cambios compartidos)</option>
                  <option value="1">Crear copias propias</option>
                </select>
              </label>
            </>
          ) : null}
          <button className="btn btn-primario" type="submit">Crear y abrir el editor</button>
        </form>
      </section>

      <section className="seccion">
        <h2>Jornadas</h2>
        <div className="tabla-scroll">
          <table className="au-decks">
            <thead><tr><th>Jornada</th><th>Fecha</th><th>Deck asociado</th></tr></thead>
            <tbody>
              {jornadas.map((j) => (
                <tr key={j.id}>
                  <td><strong>J{j.ordinal}</strong> · {j.title}</td>
                  <td className="chico">{j.starts_at ? fechaCorta(j.starts_at) : '—'}</td>
                  <td>
                    <form action={setSessionDeckAction} className="au-inline-form">
                      <input type="hidden" name="classSessionId" value={j.id} />
                      <select className="select" name="deckId" defaultValue={j.deck_id ?? ''}>
                        <option value="">Sin deck</option>
                        {decks.map((d) => <option key={d.id} value={d.id}>{d.id} · {d.title}</option>)}
                      </select>
                      <button className="btn btn-sm" type="submit">Asociar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="seccion">
        <h2>Todos los decks</h2>
        <div className="tabla-scroll">
          <table className="au-decks">
            <thead><tr><th>Deck</th><th>Slides</th><th>Jornada</th><th>Actualizado</th><th /></tr></thead>
            <tbody>
              {decks.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={authoringRoutes.deck(d.id)}><strong>{d.title}</strong></Link>
                    <div className="chico muted">{d.id}{d.kind === 'html' ? ' · HTML' : ''}</div>
                  </td>
                  <td>{d.slideCount}</td>
                  <td>{(jornadaDe.get(d.id) ?? []).join(', ') || <span className="muted">—</span>}</td>
                  <td className="chico">{fechaCorta(d.updatedAt)}</td>
                  <td><Link className="btn btn-sm" href={authoringRoutes.deck(d.id)}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
