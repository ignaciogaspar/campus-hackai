import Link from 'next/link'
import '@/components/assignments/assignments.css'
import '@/components/organizacion/organizacion.css'
import { EntregablesPortfolio, OrgResumen } from '@/components/organizacion/Portfolio'
import { requirePerson } from '@/lib/auth'
import { loadPortfolio } from '@/lib/organizacion/store'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi portfolio' }

export default async function MiPortfolio() {
  const { person } = await requirePerson('alumno')
  const data = await loadPortfolio(person.id, 'alumno')
  const org = data.organization
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management · portfolio</div>
          <h1>{org ? org.name : 'Tu portfolio'}</h1>
          <p className="muted chico" style={{ margin: 0 }}>{person.full_name}{org?.my_role ? ` · ${org.my_role}` : ''}</p>
        </div>
        <div className="fila org-no-imprimir">
          <Link className="btn" href="/campus/organizacion">Editar</Link>
        </div>
      </div>
      {org ? (
        <section className="seccion"><div className="card"><OrgResumen org={org} /></div></section>
      ) : (
        <div className="vacio">Primero <Link href="/campus/organizacion">dá de alta tu organización</Link>.</div>
      )}
      <section className="seccion" aria-labelledby="ent-h">
        <h2 id="ent-h">Entregables</h2>
        <EntregablesPortfolio data={data} audience="alumno" entregaHref={routes.campusEntrega} />
      </section>
    </div>
  )
}
