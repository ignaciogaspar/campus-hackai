import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { activitiesBySession } from '@/lib/actividades/catalog'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { db } from '@/lib/db'
import { getClassSessions } from '@/lib/course'
import { fechaLarga } from '@/lib/format'
import { ActivityMeta } from '@/components/actividades/ActivityInfo'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Actividades' }

export default async function ActividadesAlumno() {
  const { person } = await requirePerson('alumno')
  const [sessions, { data }] = await Promise.all([
    getClassSessions(),
    db().from('activity_entries').select('activity_id').eq('person_id', person.id),
  ])
  const done = new Set(((data ?? []) as Array<{ activity_id: string }>).map((x) => x.activity_id))
  const groups = activitiesBySession()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Actividades</h1>
          <p className="muted chico">Lo que hacemos en clase, con su consigna, sus tiempos y la herramienta para trabajar. Todo lo que hacés queda guardado sobre tu caso.</p>
        </div>
        <div className="fila">
          <Link className="btn" href={r.campusOfficeHours}>Office hours</Link>
          <Link className="btn" href={r.campusRadar}>Radar semanal</Link>
        </div>
      </div>
      <div className="ac-lista">
        {sessions.filter((s) => groups.has(s.id)).map((s) => (
          <section key={s.id} className="ac-jornada">
            <h2>Jornada {s.ordinal} <span>{fechaLarga(s.starts_at)}</span></h2>
            <div className="ac-cards">
              {groups.get(s.id)!.map((a) => (
                <Link key={a.id} href={r.campusActividad(a.id)} className="card ac-card">
                  <ActivityMeta def={a} />
                  <h3>{a.title}</h3>
                  <p>{a.tagline}</p>
                  {done.has(a.id) ? <span className="badge badge-ok" style={{ justifySelf: 'start' }}>Guardaste algo</span> : null}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
