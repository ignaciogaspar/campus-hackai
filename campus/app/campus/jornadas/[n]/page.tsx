import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePerson } from '@/lib/auth'
import { fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { loadJornada, loadJornadaAlumno } from '@/lib/jornadas'
import { caseStatus, CASE_STATUS_LABEL } from '@/lib/classroom/types'
import { formatPct } from '@/lib/assignments/scoring'
import { B1_ENTORNO_ID } from '@/lib/organizacion/entregables'
import { ActivityMeta } from '@/components/actividades/ActivityInfo'
import { Bloque, CabeceraJornada, Conceptos, Extras, Materiales, NavJornadas, Simuladores } from '@/components/jornada/JornadaParts'
import { sessionEnded } from '@/lib/learning/core'
import '@/components/learning/learning.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  return { title: `Jornada ${n}` }
}

export default async function JornadaAlumno({ params }: { params: Promise<{ n: string }> }) {
  const { person } = await requirePerson('alumno')
  const j = await loadJornada(Number((await params).n))
  if (!j) notFound()
  const me = await loadJornadaAlumno(j, person.id)

  return (
    <div className="page">
      <NavJornadas j={j} href={routes.campusJornada} indice={`${routes.campus}#jornadas`} />
      <CabeceraJornada j={j} />

      {sessionEnded(j.session) ? <section className="learning-next" aria-label="Después de clase">
        <div><p className="learning-eyebrow">Después de clase</p><h2>Lo que te llevás de esta jornada</h2><p>Guardá tu reflexión y revisá las devoluciones de tus docentes.</p></div>
        <Link className="btn btn-primario" href={`${routes.campusAprendizaje}#jornada-${j.session.id}`}>Ver mi aprendizaje</Link>
      </section> : null}

      <div className="jv-grid">
        <div className="jv-main">
          {j.deck ? (
            <Bloque title="La clase">
              <article className="card">
                <div className="jv-card-head">
                  <div>
                    <h3>{j.deck.title}</h3>
                    <span className="chico muted">{j.deck.slideCount} slides</span>
                  </div>
                  <Link className="btn btn-primario" href={routes.campusDeck(j.deck.id)}>Abrir deck</Link>
                </div>
                {me.marks.total || me.marks.notes ? (
                  <div className="jv-stats">
                    {me.marks.noEntendi ? <span><strong>{me.marks.noEntendi}</strong> slide{me.marks.noEntendi > 1 ? 's' : ''} marcaste «no entendí»</span> : null}
                    {me.marks.total - me.marks.noEntendi > 0 ? <span><strong>{me.marks.total - me.marks.noEntendi}</strong> otras marcas</span> : null}
                    {me.marks.notes ? <span><strong>{me.marks.notes}</strong> nota{me.marks.notes > 1 ? 's' : ''}</span> : null}
                    <Link href={routes.campusDeck(j.deck.id)}>Repasarlas en el deck</Link>
                  </div>
                ) : null}
              </article>
            </Bloque>
          ) : null}

          {j.activities.length ? (
            <Bloque title="Actividades">
              <div className="stack" style={{ gap: 12 }}>
                {j.activities.map((a) => (
                  <article key={a.id} className="card jv-act">
                    <ActivityMeta def={a} />
                    <h3>{a.title}</h3>
                    <p className="muted">{a.tagline}</p>
                    <div className="jv-act-pie">
                      <Link className="btn btn-sm" href={routes.campusActividad(a.id)}>{me.activitiesDone.has(a.id) ? 'Seguir' : 'Abrir la actividad'}</Link>
                      {me.activitiesDone.has(a.id) ? <span className="badge badge-ok">Avance guardado</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </Bloque>
          ) : null}

          {j.cases.length ? (
            <Bloque title="Caso">
              <div className="stack" style={{ gap: 12 }}>
                {j.cases.map((c) => {
                  const mine = me.postures.get(c.id)
                  const label = mine ? c.postures.find((p) => p.id === mine)?.label ?? mine : null
                  const status = caseStatus(c)
                  return (
                    <article key={c.id} className="card">
                      <div className="jv-card-head">
                        <div>
                          <h3>{c.title}</h3>
                          {c.protagonist ? <span className="chico muted">{c.protagonist}</span> : null}
                        </div>
                        <div className="fila">
                          {status !== 'abierto' ? <span className="badge badge-ficticio">{CASE_STATUS_LABEL[status]}</span> : null}
                          {mine ? <span className="badge badge-ok">Postura tomada</span> : <span className="badge badge-vivo">Pendiente</span>}
                        </div>
                      </div>
                      {c.summary ? <p className="chico" style={{ margin: '10px 0 0' }}>{c.summary}</p> : null}
                      {c.question ? <p style={{ margin: '10px 0 0', fontWeight: 600 }}>{c.question}</p> : null}
                      <div className="jv-act-pie" style={{ marginTop: 12 }}>
                        <Link className={mine ? 'btn btn-sm' : 'btn btn-sm btn-primario'} href={routes.campusCaso(c.id)}>{mine ? 'Ver o cambiar mi postura' : 'Tomar postura antes de clase'}</Link>
                        {label ? <span className="chico muted">Elegiste: <strong>{label}</strong></span> : null}
                      </div>
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
                    const e = me.entregas.get(a.id)
                    return (
                      <li key={a.id}>
                        <Link href={routes.campusEntrega(a.id)}><strong>{a.title}</strong></Link>
                        <span className="jv-sub">Vence {fechaLarga(a.due_at)}</span>
                        <span className="jv-entrega-estado">
                          {e?.reviewed ? <span className="badge badge-ok">Devuelta{e.grade != null ? ` · ${formatPct(e.grade)}` : ''}</span>
                            : e?.submitted ? <span className="badge badge-ok">Entregada</span>
                            : <span className="badge">Pendiente</span>}
                          {a.id === B1_ENTORNO_ID && !e?.submitted ? <Link className="chico" href={`${routes.campusEntrega(B1_ENTORNO_ID)}#entorno`}>Verificar mi entorno</Link> : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Bloque>
          ) : null}
          <Conceptos j={j} />
          <Simuladores j={j} />
          <Materiales j={j} />
          <Extras j={j} officeHref={routes.campusOfficeHours} radarHref={routes.campusRadar} />
        </aside>
      </div>
    </div>
  )
}
