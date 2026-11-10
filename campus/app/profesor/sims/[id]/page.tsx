import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePerson } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { loadSimDef } from '@/lib/sims/defs'
import { simHref } from '@/lib/sims/registry'
import { findOpenRun, isUuid, listCohortRuns, listMyRuns } from '@/lib/sims/server'
import { simSummary } from '@/lib/sims/summary'
import { SimPlayer } from '@/components/sims/SimPlayer'
import { SimSummaryLive } from '@/components/sims/SimSummaryLive'
import '@/components/sims/sims.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Simulador · cohorte' }

/* Vista del profesor de un simulador: corridas de la cohorte, resultados y
   distribución de decisiones. ?live=<liveSessionId> filtra por clase en vivo;
   ?vista=jugar abre el simulador para probarlo (queda como corrida del profesor). */

export default async function ProfesorSimPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ live?: string; vista?: string }>
}) {
  const { person } = await requirePerson('profesor')
  const { id } = await params
  const sp = await searchParams
  const def = await loadSimDef(id)
  if (!def) notFound()
  const live = isUuid(sp.live) ? sp.live : null

  if (sp.vista === 'jugar') {
    const [open, runs] = await Promise.all([findOpenRun(def.id, person.id, null), listMyRuns(def.id, person.id)])
    return (
      <div className="page">
        <div className="sim-head">
          <div>
            <div className="kicker"><Link href={`/profesor/sims/${def.id}`}>← Resultados de la cohorte</Link></div>
            <h1>{def.title}</h1>
            <p className="muted chico">Modo prueba: tus corridas quedan registradas a tu nombre y no se mezclan con las de una clase en vivo.</p>
          </div>
        </div>
        <SimPlayer def={def} personId={person.id} firstName={person.full_name.split(' ')[0]} initialRun={open ?? (def.kind === 'react' ? runs.find((r) => r.status === 'completada') ?? null : null)}
          history={runs.filter((r) => r.status === 'completada').map((r) => ({ score: r.score, completedAt: r.completedAt }))} />
      </div>
    )
  }

  const [runs, summary] = await Promise.all([listCohortRuns(def.id, live), simSummary(def.id, live)])
  const alumnos = runs.filter((r) => r.personId !== person.id)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker"><Link href="/profesor/sims">Simuladores</Link>{live ? ' · clase en vivo' : ' · toda la cohorte'}</div>
          <h1>{def.title}</h1>
          <p className="muted chico">{def.description}</p>
        </div>
        <div className="fila">
          {live ? <Link className="btn btn-sm" href={`/profesor/sims/${def.id}`}>Ver toda la cohorte</Link> : null}
          <Link className="btn btn-sm" href={`/profesor/sims/${def.id}?vista=jugar`}>Probar el simulador</Link>
          <span className="badge" title="Link para los alumnos">{simHref(def.id, live)}</span>
        </div>
      </div>

      <section className="seccion">
        <h2>Resultados {live ? 'de la clase' : 'de la cohorte'}</h2>
        <div className="card">
          <SimSummaryLive simId={def.id} liveSessionId={live} initial={summary} pollMs={15000} />
        </div>
      </section>

      <section className="seccion">
        <h2>Corridas · {alumnos.length}</h2>
        {runs.length === 0 ? <div className="vacio">Todavía nadie abrió este simulador{live ? ' en esta clase' : ''}.</div> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr><th>Persona</th><th>Estado</th><th style={{ textAlign: 'right' }}>Score</th><th>Cierre</th><th>Inicio</th><th>Fin</th><th style={{ textAlign: 'right' }}>Eventos</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.personName ?? '—'}
                      {r.personId === person.id ? <span className="badge" style={{ marginLeft: 6 }}>vos</span> : null}
                      {r.company ? <div className="chico muted">{r.company}</div> : null}
                    </td>
                    <td>{r.status === 'completada' ? <span className="badge badge-ok">Terminada</span> : <span className="badge badge-vivo">En curso</span>}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.score ?? '—'}</td>
                    <td className="chico">{typeof r.summary.headline === 'string' ? r.summary.headline : ''}</td>
                    <td className="chico muted">{fechaHora(r.startedAt)}</td>
                    <td className="chico muted">{r.completedAt ? fechaHora(r.completedAt) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{r.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
