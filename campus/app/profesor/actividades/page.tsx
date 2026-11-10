import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { activitiesBySession } from '@/lib/actividades/catalog'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { entryCounts, itemCounts } from '@/lib/actividades/store'
import { getClassSessions } from '@/lib/course'
import { fechaLarga } from '@/lib/format'
import { ActivityMeta } from '@/components/actividades/ActivityInfo'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Actividades' }

export default async function ActividadesProfesor() {
  await requirePerson('profesor')
  const [sessions, entries, items] = await Promise.all([getClassSessions(), entryCounts(), itemCounts()])
  const groups = activitiesBySession()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Actividades</h1>
          <p className="muted chico">Guía, controles en vivo (parejas, cronómetro, directorio) y lo que produjo cada alumno.</p>
        </div>
        <div className="fila">
          <Link className="btn" href={r.profesorOfficeHours}>Office hours</Link>
          <Link className="btn" href={r.profesorRadar}>Radar semanal</Link>
        </div>
      </div>
      <div className="ac-lista">
        {sessions.filter((s) => groups.has(s.id)).map((s) => (
          <section key={s.id} className="ac-jornada">
            <h2>Jornada {s.ordinal} <span>{fechaLarga(s.starts_at)}</span></h2>
            <div className="ac-cards">
              {groups.get(s.id)!.map((a) => {
                const n = (entries.get(a.id) ?? 0) + (items.get(a.id) ?? 0)
                return (
                  <Link key={a.id} href={r.profesorActividad(a.id)} className="card ac-card">
                    <ActivityMeta def={a} />
                    <h3>{a.title}</h3>
                    <p>{a.tagline}</p>
                    <span className="chico muted">{n ? `${n} registros` : 'Sin registros todavía'}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
