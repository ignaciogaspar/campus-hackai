import Link from 'next/link'
import '@/components/organizacion/organizacion.css'
import { DocentesCalendario } from '@/components/organizacion/Docentes'
import { requireSession } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { ENTREGABLES } from '@/lib/organizacion/entregables'
import { listOrganizations, type DeliverableState } from '@/lib/organizacion/store'
import { organizationGaps, ORG_SIZE_LABEL } from '@/lib/organizacion/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Organizaciones' }

const STATE_LABEL: Record<DeliverableState, string> = { pendiente: '—', entregado: 'Entregado', devuelto: 'Devuelto' }

export default async function Organizaciones() {
  await requireSession('profesor')
  const rows = await listOrganizations()
  const withOrg = rows.filter((r) => r.organization).length
  const verified = rows.filter((r) => r.lastEnvCheck).length
  const toReturn = rows.reduce((n, r) => n + Object.values(r.states).filter((s) => s === 'entregado').length, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Trabajo individual</div>
          <h1>Organizaciones de los alumnos</h1>
          <p className="muted chico" style={{ margin: 0 }}>
            Cada alumno trabaja sobre su organización real. Desde acá ves su ficha, sus seis entregables y dejás la devolución de cada uno.
          </p>
        </div>
        <div className="fila">
          <span className="badge">{withOrg} de {rows.length} con organización</span>
          <span className="badge">{verified} con entorno verificado</span>
          <span className={toReturn ? 'badge badge-vivo' : 'badge'}>{toReturn} devoluciones pendientes</span>
          <Link className="btn btn-sm" href="/profesor/alumnos">Códigos de ingreso y PIN</Link>
        </div>
      </div>

      <section className="seccion">
        {rows.length === 0 ? <div className="vacio">No hay alumnos en el padrón.</div> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Organización</th>
                  <th>Procesos</th>
                  <th>Entorno</th>
                  {ENTREGABLES.map((e) => <th key={e.id} title={e.title} className="org-celda-estado">{e.block}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const org = r.organization
                  const gaps = organizationGaps(org)
                  return (
                    <tr key={r.person.id}>
                      <td>
                        <Link href={`/profesor/organizaciones/${r.person.id}`}><strong>{r.person.full_name}</strong></Link>
                        {r.person.is_fictional ? <> <span className="badge badge-ficticio">Ficticio</span></> : null}
                        <div className="chico muted">{[r.person.position, r.person.company].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td>
                        {org ? (
                          <>
                            <strong>{org.name}</strong>
                            <div className="chico muted">{[org.industry, org.size ? ORG_SIZE_LABEL[org.size] : null].filter(Boolean).join(' · ')}</div>
                            {gaps.length ? <div className="chico muted">Falta: {gaps.join(', ').toLowerCase()}</div> : null}
                          </>
                        ) : <span className="muted chico">Sin alta</span>}
                      </td>
                      <td className="chico">{org ? org.processes.length : 0}</td>
                      <td className="chico">{r.lastEnvCheck ? fechaHora(r.lastEnvCheck) : <span className="muted">—</span>}</td>
                      {ENTREGABLES.map((e) => {
                        const s = r.states[e.id]
                        return <td key={e.id} className={`org-celda-estado org-estado-${s}`}>{STATE_LABEL[s]}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="seccion" aria-labelledby="doc-h">
        <h2 id="doc-h">Docentes por jornada</h2>
        <div className="card"><DocentesCalendario /></div>
      </section>
    </div>
  )
}
