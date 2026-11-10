import Link from 'next/link'
import '@/components/assignments/assignments.css'
import { requireSession } from '@/lib/auth'
import { listAssignmentsWithStats } from '@/lib/assignments/store'
import { STATUS_LABEL } from '@/lib/assignments/types'
import { COURSE_ID } from '@/lib/db'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Entregas' }

export default async function EntregasProfesor() {
  await requireSession('profesor')
  const items = await listAssignmentsWithStats(COURSE_ID)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Entregas</h1>
          <p className="muted chico">Estado de cada entrega, revisión entre pares y notas.</p>
        </div>
      </div>
      {items.length === 0 ? <div className="vacio">Todavía no hay entregas cargadas. Se cargan con el contenido de cada jornada (scripts/seed/content.ts).</div> : (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr><th>Entrega</th><th>Estado</th><th>Vence</th><th>Entregaron</th><th>Revisiones de pares</th><th>Docente</th><th>Para mirar</th><th /></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.assignment.id}>
                  <td><Link href={routes.profesorEntrega(i.assignment.id)}><strong>{i.assignment.title}</strong></Link></td>
                  <td><span className="badge">{STATUS_LABEL[i.assignment.status]}</span></td>
                  <td>{fechaHora(i.assignment.due_at)}</td>
                  <td>{i.submissions}/{i.students}</td>
                  <td>{i.reviewsAssigned ? `${i.reviewsSent}/${i.reviewsAssigned}` : '—'}</td>
                  <td>{i.teacherReviews}</td>
                  <td>{i.discordant ? <span className="ent-alerta">{i.discordant} discordante{i.discordant > 1 ? 's' : ''}</span> : '—'}</td>
                  <td><Link className="btn btn-sm" href={routes.profesorEntrega(i.assignment.id)}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
