import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { learningStore } from '@/lib/learning/store'
import { feedbackTemplate, sessionEnded } from '@/lib/learning/core'
import { FeedbackEditor } from '@/components/learning/FeedbackEditor'
import { LearningUnavailable } from '@/components/learning/LearningCards'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Devoluciones por jornada' }

export default async function TeacherFeedbackPage({ searchParams }: { searchParams: Promise<{ jornada?: string; alumno?: string }> }) {
  const { person } = await requirePerson('profesor')
  const query = await searchParams
  const store = learningStore()
  const sessions = await store.sessions().catch(() => [])
  const selected = sessions.find((s) => s.id === query.jornada) ?? [...sessions].reverse().find((s) => sessionEnded(s)) ?? sessions[0]
  const data = selected ? await store.teacher(person.id, selected.id, query.alumno).catch((error) => { console.error('[teacher-learning]', error.message); return null }) : null
  const now = Date.now()
  const drafts = data?.allDrafts ?? []
  const link = (id: string) => `/profesor/devoluciones?${new URLSearchParams({ jornada: selected!.id, alumno: id })}`
  return <div className="page">
    <div className="page-head"><div><div className="kicker">Acompañamiento entre clases</div><h1>Devoluciones por jornada</h1><p className="muted">Una observación concreta y un próximo paso para cada alumno.</p></div></div>
    <form className="learning-filter" method="get"><label className="field"><span>Jornada</span><select className="select" name="jornada" defaultValue={selected?.id}>{sessions.map((s) => <option key={s.id} value={s.id}>J{s.ordinal} · {s.title}</option>)}</select></label><button className="btn">Ver jornada</button></form>
    {!data ? <LearningUnavailable /> : <>
      <div className="learning-summary" aria-label="Estado de la jornada">
        <span><strong>{data.allReflections.length}</strong> de {data.roster.length} reflexiones</span>
        <span><strong>{drafts.filter((d) => d.visible_at && Date.parse(d.visible_at) <= now).length}</strong> devoluciones publicadas</span>
        <span><strong>{drafts.filter((d) => d.visible_at && Date.parse(d.visible_at) > now).length}</strong> programadas</span>
        <span><strong>{drafts.filter((d) => d.read_at).length}</strong> leídas</span>
        <span><strong>{drafts.filter((d) => d.applied_at).length}</strong> aplicadas</span>
      </div>
      {!data.selected ? <div className="vacio">Todavía no hay alumnos en este curso.</div> : <div className="learning-teacher">
        <nav className="card" aria-label="Alumnos de la jornada"><ul className="learning-roster">{data.roster.map((p) => {
          const f = drafts.find((d) => d.person_id === p.id)
          const status = f?.visible_at ? (Date.parse(f.visible_at) > now ? 'Programada' : f.applied_at ? 'Aplicación registrada' : f.read_at ? 'Leída' : 'Publicada') : f ? 'Borrador' : 'Sin devolución'
          return <li key={p.id}><Link href={link(p.id)} aria-current={p.id === data.selected!.id ? 'page' : undefined}><strong>{p.full_name}</strong><small>{status} · {data.allReflections.some((r) => r.person_id === p.id) ? 'con reflexión' : 'sin reflexión'}</small></Link></li>
        })}</ul></nav>
        <section className="card" aria-label={`Devolución para ${data.selected.full_name}`}>
          <h2>{data.selected.full_name}</h2>
          {data.draft?.visible_at ? <p className="muted chico">{Date.parse(data.draft.visible_at) > now ? 'Publicación programada' : 'Última publicación'}: {fechaHora(data.draft.visible_at)}</p> : null}
          <details className="learning-evidence" open><summary>Evidencia de esta jornada</summary>
            {data.reflection ? <dl><dt>Idea que se lleva</dt><dd>{data.reflection.takeaway}</dd>{data.reflection.unclear ? <><dt>Duda que quiere retomar</dt><dd>{data.reflection.unclear}</dd></> : null}{data.reflection.application ? <><dt>Lo que quiere aplicar</dt><dd>{data.reflection.application}</dd></> : null}</dl> : <p className="muted">Todavía no compartió su reflexión. El borrador propone un cierre general; completalo con una observación tuya si la tenés.</p>}
            {data.doubts.length ? <p className="chico">Marcó «no entendí» en las slides {data.doubts.map((d) => d.position + 1).join(', ')}. <Link href={`/profesor/analitica/${data.session.deck_id}`}>Ver contexto de la clase</Link></p> : null}
          </details>
          <FeedbackEditor key={`${data.session.id}-${data.selected.id}`} personId={data.selected.id} sessionId={data.session.id} draft={data.draft} template={feedbackTemplate(data.selected.full_name, data.reflection)} />
        </section>
      </div>}
    </>}
  </div>
}
