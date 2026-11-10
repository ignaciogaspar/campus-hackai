import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getDeckAnalytics, type PollAnalytics, type SlideAnalytics } from '@/lib/classroom/analytics'
import { MARK_KINDS, MARK_LABEL } from '@/lib/classroom/types'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { SlideView } from '@/components/deck'
import { deckSkin } from '@/lib/decks/parse'
import type { DeckSkin } from '@/lib/decks/types'
import { SummaryPanel } from '@/components/classroom/SummaryPanel'
import '@/components/classroom/classroom.css'

export const dynamic = 'force-dynamic'
/** La acción «Resumen con IA» (summarizeAction) llama a Claude: acotamos el tiempo de la función. */
export const maxDuration = 60

export async function generateMetadata({ params }: { params: Promise<{ deckId: string }> }) {
  return { title: `Analítica · ${(await params).deckId}` }
}

const POLL_KIND: Record<string, string> = { single: 'opción única', multiple: 'opción múltiple', open: 'abierta', scale: 'escala', wordcloud: 'nube de palabras' }

function PollBlock({ p }: { p: PollAnalytics }) {
  return (
    <div className="cl-poll">
      <h4>{p.question}</h4>
      <div className="muted chico">{POLL_KIND[p.kind] ?? p.kind} · {p.total} respuestas{p.average != null ? ` · promedio ${p.average}` : ''}{p.status !== 'closed' ? ` · ${p.status === 'open' ? 'abierta' : 'borrador'}` : ''}</div>
      {p.options.length ? (
        <div className="cl-bars">
          {p.options.map((o) => (
            <div key={o.id} className="cl-bar">
              <div className="cl-bar-top"><span>{o.label}</span><span className="cl-bar-num">{o.pct}% · {o.count}</span></div>
              <div className="cl-bar-track" aria-hidden="true"><div className="cl-bar-fill" style={{ width: `${o.pct}%` }} /></div>
            </div>
          ))}
        </div>
      ) : null}
      {p.texts.length ? <ul className="chico" style={{ margin: 0, paddingLeft: 18 }}>{p.texts.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
    </div>
  )
}

function SlideRow({ s, total, skin }: { s: SlideAnalytics; total: number; skin: DeckSkin }) {
  const said = s.transcript.filter((t) => !t.isCommand)
  const commands = s.transcript.filter((t) => t.isCommand)
  return (
    <article id={`slide-${s.position + 1}`} className="card cl-slide">
      <div className="cl-slide-mini">
        <SlideView slide={s.markdown} index={s.position} total={total} fit="width" skin={skin} media={false} />
      </div>
      <div className="cl-slide-datos">
        <div>
          <div className="kicker">Slide {s.position + 1} · {s.kind}</div>
          <h3>{s.title}</h3>
        </div>
        <div className="cl-marcas" aria-label="Marcas de los alumnos">
          {MARK_KINDS.map((k) => (
            <span key={k} className={`cl-marca cl-marca--${k}${s.marks[k] ? ' cl-marca--hay' : ' cl-marca--cero'}`}>
              <strong>{s.marks[k]}</strong> {MARK_LABEL[k]}
            </span>
          ))}
          <span className={`cl-marca${s.notes.total ? '' : ' cl-marca--cero'}`}><strong>{s.notes.total}</strong> notas{s.notes.public ? ` · ${s.notes.public} públicas` : ''}</span>
        </div>

        {s.polls.length ? <div className="stack" style={{ gap: 8 }}>{s.polls.map((p) => <PollBlock key={p.pollId} p={p} />)}</div> : null}

        {s.notes.publicSamples.length ? (
          <details className="cl-detalle">
            <summary>Notas compartidas con la cohorte · {s.notes.public}</summary>
            <ul>
              {s.notes.publicSamples.map((n, i) => (
                <li key={i}>{n.quote ? <span className="cl-cita">«{n.quote}» </span> : null}{n.body} <span className="muted chico">— {n.author}</span></li>
              ))}
            </ul>
          </details>
        ) : null}

        {s.tutor.length ? (
          <details className="cl-detalle">
            <summary>Preguntas al tutor · {s.tutor.length}</summary>
            <ul>
              {s.tutor.map((t) => (
                <li key={t.threadId}>
                  {t.questions[0]} <span className="muted chico">— {t.person} · {fechaHora(t.at)}{t.questions.length > 1 ? ` · +${t.questions.length - 1} repreguntas` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {s.transcript.length ? (
          <details className="cl-detalle">
            <summary>Lo dicho en esta slide · {said.length} fragmentos{commands.length ? ` · ${commands.length} comandos al agente` : ''}</summary>
            <ul>
              {s.transcript.map((t) => (
                <li key={t.id} className={t.isCommand ? 'cl-comando' : undefined}>{t.isCommand ? 'Al agente: ' : ''}{t.text} <span className="muted chico">{fechaHora(t.at)}</span></li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  )
}

export default async function AnaliticaDeck({ params, searchParams }: {
  params: Promise<{ deckId: string }>
  searchParams: Promise<{ live?: string }>
}) {
  await requireSession('profesor')
  const { deckId } = await params
  const { live } = await searchParams
  const a = await getDeckAnalytics(deckId, live || null)
  if (!a) notFound()
  const selected = a.liveSessionId ? a.lives.find((l) => l.id === a.liveSessionId) : null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/profesor/analitica" className="chico">← Decks</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Analítica por slide</div>
          <h1>{a.deck.title}</h1>
          {a.deck.question ? <p className="muted chico" style={{ margin: '4px 0 0' }}>{a.deck.question}</p> : null}
        </div>
        <form method="get" className="fila" aria-label="Filtrar por clase en vivo">
          <select className="select" name="live" defaultValue={a.liveSessionId ?? ''} style={{ width: 'auto' }} aria-label="Clase en vivo">
            <option value="">Todo (clases y estudio fuera de clase)</option>
            {a.lives.map((l) => <option key={l.id} value={l.id}>Clase {l.code} · {fechaHora(l.startedAt)}{l.status === 'live' ? ' · en vivo' : ''}</option>)}
          </select>
          <button type="submit" className="btn">Filtrar</button>
          <Link className="btn btn-ghost" href={routes.profesorDeck(a.deck.id)}>Editar deck</Link>
        </form>
      </div>

      {selected ? <div className="alerta" style={{ marginBottom: 16 }}>Mostrando solo la clase {selected.code} del {fechaHora(selected.startedAt)}. Las preguntas al tutor se toman por horario de la clase.</div> : null}

      <div className="cl-totales">
        <div className="cl-total"><strong>{a.totals.people}</strong><span>personas con actividad</span></div>
        <div className="cl-total"><strong>{a.totals.marks}</strong><span>marcas</span></div>
        <div className="cl-total"><strong>{a.totals.notes}</strong><span>notas</span></div>
        <div className="cl-total"><strong>{a.totals.responses}</strong><span>respuestas a encuestas</span></div>
        <div className="cl-total"><strong>{a.totals.tutor}</strong><span>consultas al tutor</span></div>
        <div className="cl-total"><strong>{a.totals.transcript}</strong><span>fragmentos de transcripción</span></div>
      </div>

      <section className="seccion cl-dos">
        <div>
          <h2 style={{ fontSize: 18 }}>Slides con más «no entendí»</h2>
          {a.ranking.length === 0 ? <div className="vacio">Nadie marcó «no entendí» {selected ? 'en esta clase' : 'todavía'}.</div> : (
            <ol className="cl-ranking">
              {a.ranking.map((r) => (
                <li key={r.position}>
                  <a href={`#slide-${r.position + 1}`}>
                    <span className="cl-ranking-pos">#{r.position + 1}</span>
                    <span>{r.title}{r.preguntas || r.tutor ? <span className="muted chico"> · {r.preguntas} preguntas · {r.tutor} al tutor</span> : null}</span>
                    <span className="cl-ranking-n">{r.noEntendi}</span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
        <SummaryPanel deckId={a.deck.id} liveSessionId={a.liveSessionId} />
      </section>

      {a.orphanPolls.length ? (
        <section className="seccion">
          <h2>Encuestas sin slide asociada</h2>
          <div className="grid">{a.orphanPolls.map((p) => <PollBlock key={p.pollId} p={p} />)}</div>
        </section>
      ) : null}

      <section className="seccion">
        <h2>Slide por slide · {a.slides.length}</h2>
        <div className="stack">
          {((skin) => a.slides.map((s) => <SlideRow key={s.slideId} s={s} total={a.slides.length} skin={skin} />))(deckSkin(a.slides.map((x) => x.markdown)))}
        </div>
      </section>
    </div>
  )
}
