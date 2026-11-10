import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePerson } from '@/lib/auth'
import { getActivityDef } from '@/lib/actividades/catalog'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { buildView } from '@/lib/actividades/service'
import { ActivityClient } from '@/components/actividades/ActivityClient'
import { ActivityInfo, ActivityMeta } from '@/components/actividades/ActivityInfo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: getActivityDef((await params).id)?.title ?? 'Actividad' }
}

export default async function ActividadAlumno({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requirePerson('alumno')
  const def = getActivityDef((await params).id)
  if (!def) notFound()
  const view = await buildView(def, { personId: session.personId, role: 'alumno' })
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.campusActividades} className="chico">← Actividades</Link>
          <div style={{ marginTop: 8 }}><ActivityMeta def={def} /></div>
          <h1>{def.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{def.tagline}</p>
        </div>
      </div>
      <div className="ac-layout">
        <div className="stack" style={{ minWidth: 0 }}>
          <ActivityClient initial={view} />
        </div>
        <aside className="card"><ActivityInfo def={def} /></aside>
      </div>
    </div>
  )
}
