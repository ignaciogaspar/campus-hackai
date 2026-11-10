import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { livesWithTranscript, transcriptLines } from '@/lib/live/transcript-archive'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Transcripciones' }

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Transcripción de cada clase después de terminada: vista cronológica con la
 * slide de cada fragmento, búsqueda por texto y descarga en .txt.
 */
export default async function TranscripcionPage({ searchParams }: { searchParams: Promise<{ live?: string; q?: string; ordenes?: string }> }) {
  await requireSession('profesor')
  const sp = await searchParams
  const lives = await livesWithTranscript()
  const selected = sp.live && UUID.test(sp.live) ? lives.find((l) => l.id === sp.live) ?? null : lives.find((l) => l.segments > 0) ?? null
  const q = (sp.q ?? '').slice(0, 200)
  const withCommands = sp.ordenes === '1'
  const lines = selected ? await transcriptLines(selected.id, { q, includeCommands: withCommands }) : []
  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Clases en vivo</div>
          <h1>Transcripciones</h1>
          <p className="muted chico">Lo que se transcribió en cada clase (micrófono del profesor, con «Transcribir clase» encendido), con la slide en la que se dijo.</p>
        </div>
      </div>

      {lives.length === 0 ? <div className="vacio">Todavía no hubo clases en vivo.</div> : (
        <section className="seccion">
          <form className="fila" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            <label className="field">
              <span>Clase</span>
              <select className="select" name="live" defaultValue={selected?.id ?? ''}>
                {lives.map((l) => <option key={l.id} value={l.id}>{fechaHora(l.startedAt)} · {l.deckTitle} · {l.code} · {l.segments} fragmentos</option>)}
              </select>
            </label>
            <label className="field">
              <span>Buscar</span>
              <input className="input" name="q" defaultValue={q} placeholder="p. ej. valuación" />
            </label>
            <label className="fila chico" style={{ gap: 6 }}>
              <input type="checkbox" name="ordenes" value="1" defaultChecked={withCommands} /> Incluir órdenes al agente
            </label>
            <button className="btn btn-primario">Ver</button>
            {selected ? <a className="btn" href={`/profesor/transcripcion/descargar?live=${selected.id}`}>Descargar .txt</a> : null}
            {selected ? <Link className="btn btn-ghost" href={`${routes.analitica(selected.deckId)}?live=${selected.id}`}>Analítica de esa clase</Link> : null}
          </form>
        </section>
      )}

      {selected ? (
        <section className="seccion">
          <p className="muted chico">{q ? `${lines.length} fragmentos con «${q}».` : `${lines.length} fragmentos.`}</p>
          {lines.length === 0 ? <div className="vacio">{q ? 'Nada coincide con esa búsqueda.' : 'Esta clase no tiene transcripción.'}</div> : (
            <ol className="stack" style={{ listStyle: 'none', padding: 0 }}>
              {lines.map((l) => (
                <li key={l.id} className="fila" style={{ gap: 10, alignItems: 'baseline' }}>
                  <span className="muted chico" style={{ minWidth: 92 }}>{hora(l.createdAt)} · {l.position !== null ? `slide ${l.position + 1}` : '—'}</span>
                  <span>{l.isCommand ? <span className="badge">orden</span> : null} {l.text}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  )
}
