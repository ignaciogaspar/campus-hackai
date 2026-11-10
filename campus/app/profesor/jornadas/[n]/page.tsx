import Link from 'next/link'
import { notFound } from 'next/navigation'
import { startLiveSession } from '@/app/actions/start-live'
import { requirePerson } from '@/lib/auth'
import { fechaHora, fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { loadJornada, loadJornadaProfesor } from '@/lib/jornadas'
import { ActivityMeta } from '@/components/actividades/ActivityInfo'
import { PostureBars } from '@/components/classroom/PostureBars'
import { Bloque, CabeceraJornada, Conceptos, Extras, Materiales, NavJornadas, Simuladores } from '@/components/jornada/JornadaParts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  return { title: `Jornada ${n}` }
}

export default async function JornadaProfesor({ params }: { params: Promise<{ n: string }> }) {
  await requirePerson('profesor')
  const j = await loadJornada(Number((await params).n))
  if (!j) notFound()
  const p = await loadJornadaProfesor(j)
  const deckId = j.deck?.id
  const liveNow = p.live?.status === 'live' ? p.live : null

  return (
    <div className="page">
      <NavJornadas j={j} href={routes.profesorJornada} indice={`${routes.profesor}#jornadas`} />
      <CabeceraJornada j={j} />
      <p><Link className="btn" href={`${routes.profesorDevoluciones}?jornada=${encodeURIComponent(j.session.id)}`}>Revisar reflexiones y preparar devoluciones</Link></p>

      <div className="jv-grid">
        <div className="jv-main">
          {j.deck && deckId ? (
            <Bloque title="La clase">
              <article className="card">
                <div className="jv-card-head">
                  <div>
                    <h3>{j.deck.title}</h3>
                    <span className="chico muted">{j.deck.slideCount} slides · {p.polls.draft} encuesta{p.polls.draft === 1 ? '' : 's'} lista{p.polls.draft === 1 ? '' : 's'}</span>
                  </div>
                  <div className="fila">
                    {liveNow ? (
                      <>
                        <Link className="btn btn-accion" href={routes.live(liveNow.id)}>Retomar en vivo · {liveNow.code}</Link>
                        <form action={startLiveSession}>
                          <input type="hidden" name="deckId" value={deckId} />
                          <input type="hidden" name="classSessionId" value={j.session.id} />
                          <input type="hidden" name="force" value="1" />
                          <button className="btn btn-sm btn-ghost" type="submit">Iniciar una nueva</button>
                        </form>
                      </>
                    ) : (
                      <form action={startLiveSession}>
                        <input type="hidden" name="deckId" value={deckId} />
                        <input type="hidden" name="classSessionId" value={j.session.id} />
                        <button className="btn btn-primario" type="submit">Iniciar clase en vivo</button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="fila chico" style={{ marginTop: 10 }}>
                  <Link href={routes.profesorDeck(deckId)}>Editar deck</Link>
                  <Link href={routes.deckViewer(deckId)}>Ver deck</Link>
                  <Link href={routes.analitica(deckId)}>Analítica</Link>
                  {p.live ? <Link href={`${routes.transcripciones}?live=${p.live.id}`}>Transcripción{p.lastLiveTranscript ? ` · ${p.lastLiveTranscript}` : ''}</Link> : null}
                  {p.participation ? <Link href={routes.participacion}>Participación · {p.participation}</Link> : null}
                </div>
                {p.live || p.marks.noEntendi || p.marks.notes ? (
                  <div className="jv-stats">
                    {p.live ? <span>Última clase en vivo: <strong>{fechaHora(p.live.started_at)}</strong>{liveNow ? ' (en curso)' : ''}</span> : null}
                    {p.marks.noEntendi ? <span><strong>{p.marks.noEntendi}</strong> marcas «no entendí»</span> : null}
                    {p.marks.notes ? <span><strong>{p.marks.notes}</strong> notas de alumnos</span> : null}
                  </div>
                ) : null}
              </article>
            </Bloque>
          ) : null}

          {j.activities.length ? (
            <Bloque title="Actividades">
              <div className="stack" style={{ gap: 12 }}>
                {j.activities.map((a) => {
                  const n = p.activityPeople.get(a.id) ?? 0
                  return (
                    <article key={a.id} className="card jv-act">
                      <ActivityMeta def={a} />
                      <h3>{a.title}</h3>
                      <p className="muted">{a.tagline}</p>
                      <div className="jv-act-pie">
                        <Link className="btn btn-sm btn-primario" href={routes.profesorActividad(a.id)}>Guía y panel</Link>
                        <span className="chico muted">{n} de {p.roster} guardaron algo</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            </Bloque>
          ) : null}

          {j.cases.length ? (
            <Bloque title="Caso">
              <div className="stack" style={{ gap: 12 }}>
                {j.cases.map((c) => {
                  const v = p.caseViews.get(c.id)
                  return (
                    <article key={c.id} className="card">
                      <div className="jv-card-head">
                        <div>
                          <h3>{c.title}</h3>
                          {c.protagonist ? <span className="chico muted">{c.protagonist}</span> : null}
                        </div>
                        <Link className="btn btn-sm" href={routes.profesorCaso(c.id)}>Posturas y justificaciones</Link>
                      </div>
                      {c.question ? <p style={{ margin: '10px 0 12px', fontWeight: 600 }}>{c.question}</p> : null}
                      {v ? (
                        <>
                          <PostureBars counts={v.distribution.counts} total={v.distribution.total} showConfidence />
                          <p className="jv-faltan">
                            {v.distribution.total} de {v.distribution.roster} tomaron postura
                            {v.missing.length ? ` · faltan: ${v.missing.slice(0, 6).map((m) => m.name.split(' ')[0]).join(', ')}${v.missing.length > 6 ? ` y ${v.missing.length - 6} más` : ''}` : ''}
                          </p>
                        </>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </Bloque>
          ) : null}
        </div>

        <aside className="jv-side">
          {j.assignments.length ? (
            <Bloque title="Entregas">
              <div className="card">
                <ul className="jv-lista">
                  {j.assignments.map((a) => {
                    const e = p.entregas.get(a.id)
                    return (
                      <li key={a.id}>
                        <Link href={routes.profesorEntrega(a.id)}><strong>{a.title}</strong></Link>
                        <span className="jv-sub">Vence {fechaLarga(a.due_at)}{a.peer_reviews_per_submission ? ` · revisión entre pares (${a.peer_reviews_per_submission})` : ''}</span>
                        <span className="jv-entrega-estado">
                          <span className="badge">{e?.submitted ?? 0} de {e?.students ?? p.roster} entregadas</span>
                          {e?.submitted ? <span className="badge badge-ok">{e.teacherReviewed} corregida{e.teacherReviewed === 1 ? '' : 's'}</span> : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Bloque>
          ) : null}
          <Conceptos j={j} linked={false} />
          <Simuladores j={j} href={(id) => `${routes.profesorSims}/${id}`} />
          <Materiales j={j} linked={false} />
          <Extras j={j} officeHref={routes.profesorOfficeHours} radarHref={routes.profesorRadar} />
        </aside>
      </div>
    </div>
  )
}
