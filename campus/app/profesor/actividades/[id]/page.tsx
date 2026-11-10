import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requirePerson } from '@/lib/auth'
import { getActivityDef } from '@/lib/actividades/catalog'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { buildView } from '@/lib/actividades/service'
import { ActivityInfo, ActivityMeta } from '@/components/actividades/ActivityInfo'
import { TeacherPanel } from '@/components/actividades/TeacherPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: getActivityDef((await params).id)?.title ?? 'Actividad' }
}

export default async function ActividadProfesor({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requirePerson('profesor')
  const def = getActivityDef((await params).id)
  if (!def) notFound()
  const view = await buildView(def, { personId: session.personId, role: 'profesor' })
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.profesorActividades} className="chico">← Actividades</Link>
          <div style={{ marginTop: 8 }}><ActivityMeta def={def} /></div>
          <h1>{def.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{def.tagline}</p>
        </div>
      </div>
      <div className="ac-layout">
        <div className="stack" style={{ minWidth: 0 }}>
          <TeacherPanel def={def} initial={view} />
        </div>
        <aside className="stack">
          <section className="card ac-guia">
            <div className="kicker">Guía para el profesor</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{def.guia}</ReactMarkdown>
          </section>
          <details className="card">
            <summary><strong>Lo que ve el alumno</strong></summary>
            <div style={{ marginTop: 10 }}><ActivityInfo def={def} /></div>
          </details>
        </aside>
      </div>
    </div>
  )
}
