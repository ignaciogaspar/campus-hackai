import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { listCases } from '@/lib/classroom/cases'
import { CASE_STATUS_LABEL, caseStatus } from '@/lib/classroom/types'
import { db } from '@/lib/db'
import { routes } from '@/lib/routes'
import '@/components/classroom/classroom.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Casos' }

export default async function CasosAlumno() {
  const { person } = await requirePerson('alumno')
  const [cases, { data }] = await Promise.all([
    listCases(),
    db().from('case_postures').select('case_id, posture_id').eq('person_id', person.id),
  ])
  const mine = new Map(((data ?? []) as Array<{ case_id: string; posture_id: string }>).map((r) => [r.case_id, r.posture_id]))
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Casos</h1>
          <p className="muted chico">Leé el caso, tomá postura y justificala antes de la clase. Podés cambiarla hasta que cierre.</p>
        </div>
      </div>
      {cases.length === 0 ? <div className="vacio">Todavía no hay casos cargados.</div> : (
        <div className="cl-lista">
          {cases.map((c) => {
            const st = caseStatus(c)
            const p = mine.get(c.id)
            const label = p ? c.postures.find((x) => x.id === p)?.label ?? p : null
            return (
              <article key={c.id} className="card cl-item">
                <div>
                  <div className="fila">
                    <span className={`badge${st === 'abierto' ? ' badge-ok' : ''}`}>{CASE_STATUS_LABEL[st]}</span>
                    {c.is_fictional ? <span className="badge badge-ficticio">Ficticio</span> : null}
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.question}</p>
                </div>
                <div className="stack" style={{ gap: 8, justifyItems: 'end' }}>
                  {label ? <span className="chico">Tu postura: <strong>{label}</strong></span> : <span className="chico muted">Sin postura todavía</span>}
                  <Link className={`btn ${p ? '' : 'btn-primario'}`} href={routes.campusCaso(c.id)}>{p ? 'Ver o cambiar' : 'Tomar postura'}</Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
