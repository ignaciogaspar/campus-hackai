import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { db } from '@/lib/db'
import { listSimDefs } from '@/lib/sims/defs'
import '@/components/sims/sims.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Simuladores' }

export default async function ProfesorSimsPage() {
  await requirePerson('profesor')
  const [defs, runsRes] = await Promise.all([
    listSimDefs(),
    db().from('sim_runs').select('sim_id, status, person_id').neq('status', 'abandonada'),
  ])
  const stats = new Map<string, { runs: number; done: number; people: Set<string> }>()
  for (const r of (runsRes.data ?? []) as Array<{ sim_id: string; status: string; person_id: string | null }>) {
    const s = stats.get(r.sim_id) ?? { runs: 0, done: 0, people: new Set<string>() }
    s.runs++
    if (r.status === 'completada') s.done++
    if (r.person_id) s.people.add(r.person_id)
    stats.set(r.sim_id, s)
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Profesor</div>
          <h1>Simuladores</h1>
          <p className="muted chico">Corridas de la cohorte, resultados y distribución de decisiones. Para lanzarlos en clase, usá una slide <code>:::simulador &lt;id&gt;</code> o pedíselo al agente en vivo.</p>
        </div>
      </div>
      <div className="sim-lista-grid">
        {defs.map((s) => {
          const st = stats.get(s.id)
          return (
            <Link key={s.id} href={`/profesor/sims/${s.id}`} className="card sim-card">
              <div className="fila"><code className="chico">{s.id}</code>{s.ficticio ? <span className="badge badge-ficticio">Caso ficticio</span> : null}</div>
              <h3>{s.title}</h3>
              <p className="muted chico">{s.description}</p>
              <div className="sim-card-pie chico">
                <span className="badge">{st?.people.size ?? 0} participantes</span>
                <span className="badge badge-ok">{st?.done ?? 0} terminadas</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
