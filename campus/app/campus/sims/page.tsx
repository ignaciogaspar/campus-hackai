import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { db } from '@/lib/db'
import { listSimDefs } from '@/lib/sims/defs'
import { simHref } from '@/lib/sims/registry'
import '@/components/sims/sims.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Simuladores' }

export default async function SimsPage() {
  const { person } = await requirePerson('alumno')
  const [defs, runsRes] = await Promise.all([
    listSimDefs(),
    db().from('sim_runs').select('sim_id, status, score').eq('person_id', person.id).neq('status', 'abandonada'),
  ])
  const mine = new Map<string, { done: number; open: boolean; best: number | null }>()
  for (const r of (runsRes.data ?? []) as Array<{ sim_id: string; status: string; score: number | null }>) {
    const m = mine.get(r.sim_id) ?? { done: 0, open: false, best: null }
    if (r.status === 'completada') {
      m.done++
      if (r.score !== null) m.best = Math.max(m.best ?? -Infinity, Number(r.score))
    } else m.open = true
    mine.set(r.sim_id, m)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Simuladores</h1>
          <p className="muted chico">Cada decisión que tomás queda registrada para el debate en clase. Podés dejar a mitad de camino y retomar.</p>
        </div>
      </div>
      {defs.length === 0 ? <div className="vacio">Todavía no hay simuladores cargados.</div> : (
        <div className="sim-lista-grid">
          {defs.map((s) => {
            const m = mine.get(s.id)
            return (
              <Link key={s.id} href={simHref(s.id)} className="card sim-card">
                <div className="fila">
                  {s.bloque ? <span className="badge">{s.bloque}</span> : null}
                  {s.ficticio ? <span className="badge badge-ficticio">Caso ficticio</span> : null}
                </div>
                <h3>{s.title}</h3>
                <p className="muted chico">{s.description}</p>
                <div className="sim-card-pie chico">
                  <span className="muted">~{s.minutos} min</span>
                  {m?.open ? <span className="badge badge-vivo">En curso</span> : null}
                  {m?.done ? <span className="badge badge-ok">{m.done} terminado{m.done > 1 ? 's' : ''}{m.best !== null && s.scoreLabel ? ` · mejor ${Math.round(m.best)}` : ''}</span> : null}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
