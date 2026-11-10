import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { byWeek, listRadar, type RadarItem } from '@/lib/actividades/radar'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { fechaLarga } from '@/lib/format'
import { RadarComments } from '@/components/actividades/RadarComments'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Radar semanal' }

const semana = (week: string) => `Semana del ${fechaLarga(`${week}T12:00:00-03:00`)}`

function Item({ item, me }: { item: RadarItem; me: string }) {
  return (
    <article className="card ac-radar-item">
      <div>
        <h3 style={{ margin: 0 }}>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</h3>
        {item.source ? <span className="chico muted">{item.source}</span> : null}
      </div>
      {item.summary ? <p style={{ margin: 0 }}>{item.summary}</p> : null}
      <RadarComments item={item} me={me} isProfesor={false} />
    </article>
  )
}

export default async function RadarAlumno() {
  const { person } = await requirePerson('alumno')
  const weeks = byWeek(await listRadar())
  const [current, ...previous] = weeks
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.campusActividades} className="chico">← Actividades</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Radar semanal</div>
          <h1>Radar</h1>
          <p className="muted chico">Las noticias de la semana. Comentá lo que te parezca: qué te llamó la atención, cómo lo ves en tu organización, links relacionados.</p>
        </div>
      </div>
      {!current ? <div className="vacio">Todavía no hay noticias publicadas.</div> : (
        <section className="seccion stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>{semana(current.week)}</h2>
          {current.items.map((it) => <Item key={it.id} item={it} me={person.id} />)}
        </section>
      )}
      {previous.map((w) => (
        <details key={w.week} className="seccion">
          <summary><strong>{semana(w.week)}</strong></summary>
          <div className="stack" style={{ gap: 12, marginTop: 10 }}>{w.items.map((it) => <Item key={it.id} item={it} me={person.id} />)}</div>
        </details>
      ))}
    </div>
  )
}
