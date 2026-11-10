import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { byWeek, listRadar, mondayOf, RADAR_PER_WEEK } from '@/lib/actividades/radar'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { fechaLarga } from '@/lib/format'
import { RadarComments } from '@/components/actividades/RadarComments'
import { SubmitButton } from '@/components/classroom/SubmitButton'
import { deleteRadarAction, publishRadarAction } from './actions'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Radar semanal' }

export default async function RadarProfesor({ searchParams }: { searchParams: Promise<{ aviso?: string; error?: string }> }) {
  const { person } = await requirePerson('profesor')
  const sp = await searchParams
  const weeks = byWeek(await listRadar())
  const thisWeek = mondayOf()
  const used = weeks.find((w) => w.week === thisWeek)?.items.length ?? 0
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.profesorActividades} className="chico">← Actividades</Link>
          <h1 style={{ marginTop: 8 }}>Radar semanal</h1>
          <p className="muted chico">Publicá {RADAR_PER_WEEK} noticias por semana. Debajo de cada una, la cohorte comenta. Podés responder y borrar mensajes.</p>
        </div>
      </div>
      {sp.aviso ? <div className="alerta alerta-ok" role="status">{sp.aviso}</div> : null}
      {sp.error ? <div className="alerta alerta-error" role="alert">{sp.error}</div> : null}
      <section className="card seccion">
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Publicar noticia <span className="chico muted">({used} de {RADAR_PER_WEEK} esta semana)</span></h2>
        <form action={publishRadarAction} className="form">
          <div className="ac-campos">
            <label className="field"><span>Título</span><input className="input" name="title" required maxLength={200} /></label>
            <label className="field"><span>Link</span><input className="input" name="url" type="url" placeholder="https://…" /></label>
            <label className="field"><span>Fuente y fecha</span><input className="input" name="source" placeholder="Reuters, 20/11/2026" /></label>
            <label className="field"><span>Semana (cualquier día)</span><input className="input" name="week" type="date" defaultValue={thisWeek} /></label>
          </div>
          <label className="field"><span>Resumen en dos líneas</span><textarea className="textarea" name="summary" rows={2} maxLength={600} /></label>
          <div><SubmitButton pending="Publicando…">Publicar</SubmitButton></div>
        </form>
      </section>
      {weeks.length ? weeks.map((w) => (
        <section key={w.week} className="seccion stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Semana del {fechaLarga(`${w.week}T12:00:00-03:00`)}</h2>
          {w.items.map((it) => (
            <article key={it.id} className="card ac-radar-item">
              <div className="fila" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a> : it.title}</h3>
                <form action={deleteRadarAction}>
                  <input type="hidden" name="itemId" value={it.id} />
                  <SubmitButton className="btn btn-ghost btn-sm" pending="Borrando…">Borrar</SubmitButton>
                </form>
              </div>
              {it.source ? <span className="chico muted">{it.source}</span> : null}
              {it.summary ? <p style={{ margin: 0 }}>{it.summary}</p> : null}
              <RadarComments item={it} me={person.id} isProfesor />
            </article>
          ))}
        </section>
      )) : <div className="vacio">Todavía no publicaste noticias.</div>}
    </div>
  )
}
