import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { learningStore } from '@/lib/learning/store'
import { sessionEnded } from '@/lib/learning/core'
import { ReflectionForm } from '@/components/learning/ReflectionForm'
import { FeedbackCard, LearningUnavailable } from '@/components/learning/LearningCards'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi aprendizaje', description: 'Tus reflexiones, devoluciones y próximos pasos por jornada.' }

export default async function LearningPage() {
  const { person } = await requirePerson('alumno')
  const data = await learningStore().student(person.id).catch((error) => { console.error('[learning-page]', error.message); return null })
  const sessions = data?.sessions.filter((s) => sessionEnded(s)).reverse() ?? []
  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-head"><div><div className="kicker">Tu recorrido</div><h1>Mi aprendizaje</h1>
        <p className="muted">Lo que te llevás de cada clase, las devoluciones de tus docentes y lo que ponés en práctica.</p>
      </div><Link className="btn" href={routes.campusPortfolio}>Ver mi portfolio</Link></div>
      {!data ? <LearningUnavailable /> : !sessions.length ? <div className="card vacio"><h2>Tu recorrido empieza en la primera jornada</h2><p>Cuando termine la clase, vas a poder registrar una idea, una duda y algo para aplicar.</p><Link className="btn" href={routes.campus}>Preparar mi próxima jornada</Link></div> : (
        <div className="learning-timeline">
          {sessions.map((s, index) => {
            const reflection = data.reflections.find((r) => r.session_id === s.id) ?? null
            const feedback = data.feedback.find((f) => f.session_id === s.id)
            return <section className="card learning-jornada" id={`jornada-${s.id}`} key={s.id} aria-labelledby={`title-${s.id}`}>
              <div className="learning-jornada-head"><div><p className="learning-eyebrow">Jornada {s.ordinal} · {fechaLarga(s.starts_at)}</p><h2 id={`title-${s.id}`}>{s.title}</h2></div>
                <div className="fila"><Link className="btn btn-sm" href={routes.campusJornada(s.ordinal)}>Ver jornada</Link>{s.deck_id ? <Link className="btn btn-sm" href={routes.campusDeck(s.deck_id)}>Repasar mis notas</Link> : null}</div>
              </div>
              {feedback ? <FeedbackCard feedback={feedback} /> : <p className="muted chico">Todavía no hay una devolución publicada para esta jornada.</p>}
              <details className="learning-details" open={index === 0}>
                <summary>{reflection ? 'Mi reflexión · guardada' : 'Cerrar mi jornada · 1 minuto'}</summary>
                <ReflectionForm sessionId={s.id} reflection={reflection} />
              </details>
            </section>
          })}
        </div>
      )}
    </div>
  )
}
