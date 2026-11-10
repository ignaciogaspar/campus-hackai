import Link from 'next/link'
import '@/components/organizacion/organizacion.css'
import { OrganizacionForm } from '@/components/organizacion/OrganizacionForm'
import { requirePerson } from '@/lib/auth'
import { getOrganization } from '@/lib/organizacion/store'
import type { Organization, OrganizationInput } from '@/lib/organizacion/types'
import { routes } from '@/lib/routes'
import { saveMyOrganization } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi organización' }

function toInput(org: Organization | null): OrganizationInput | null {
  if (!org) return null
  return {
    name: org.name,
    kind: org.kind,
    industry: org.industry ?? '',
    size: org.size ?? '',
    myRole: org.my_role ?? '',
    description: org.description,
    processes: org.processes,
    dataAssets: org.data_assets,
    systems: org.systems,
    links: org.links,
  }
}

export default async function MiOrganizacion() {
  const { person } = await requirePerson('alumno')
  const org = await getOrganization(person.id)

  return (
    <div className="page org-page">
      <div className="page-head">
        <div>
          <div className="kicker">Mi organización</div>
          <h1>{org ? org.name : 'Detallá tu organización'}</h1>
          <p className="muted chico" style={{ margin: 0 }}>
            Tu empresa, donde trabajás o un proyecto en marcha: todos los entregables se hacen sobre esto. Cuanto más detalle cargues (procesos, datos, sistemas), mejor: la IA lo lee desde el campus para construir sobre tu caso real, sin que tengas que explicarlo cada vez. Además de vos, lo ven solo los docentes.
          </p>
        </div>
        {org ? <Link className="chico" href={routes.campusPortfolio}>Ver mi portfolio →</Link> : null}
      </div>
      <OrganizacionForm initial={toInput(org)} savedAt={org?.updated_at ?? null} action={saveMyOrganization} />
    </div>
  )
}
