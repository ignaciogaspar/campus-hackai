import Link from 'next/link'
import '@/components/assignments/assignments.css'
import { requirePerson } from '@/lib/auth'
import { STATUS_LABEL, type AssignmentStatus } from '@/lib/assignments/types'
import { getAssignments } from '@/lib/course'
import { db } from '@/lib/db'
import { fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Entregas' }

export default async function EntregasAlumno() {
  const { person } = await requirePerson('alumno')
  const [assignments, subsRes, reviewsRes] = await Promise.all([
    getAssignments(),
    db().from('submissions').select('assignment_id').eq('person_id', person.id),
    db().from('peer_reviews').select('status, submissions(assignment_id)').eq('reviewer_id', person.id).eq('is_teacher', false),
  ])
  const mine = new Set((subsRes.data ?? []).map((s) => s.assignment_id as string))
  const pending = new Map<string, number>()
  for (const r of (reviewsRes.data ?? []) as unknown as Array<{ status: string; submissions: { assignment_id: string } | null }>) {
    const a = r.submissions?.assignment_id
    if (a && r.status === 'asignada') pending.set(a, (pending.get(a) ?? 0) + 1)
  }
  const visible = assignments.filter((a) => a.status !== 'borrador')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">AI-Centric Management</div>
          <h1>Entregas y revisiones</h1>
        </div>
      </div>
      {visible.length === 0 ? <div className="vacio">Todavía no hay entregas abiertas.</div> : (
        <div className="grid">
          {visible.map((a) => {
            const p = pending.get(a.id) ?? 0
            return (
              <Link key={a.id} href={routes.campusEntrega(a.id)} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="fila">
                  <span className="badge">{STATUS_LABEL[a.status as AssignmentStatus] ?? a.status}</span>
                  {mine.has(a.id) ? <span className="badge badge-ok">Entregada</span> : a.status === 'abierta' ? <span className="badge">Pendiente</span> : null}
                  {p > 0 ? <span className="badge badge-vivo">{p} revisión{p > 1 ? 'es' : ''} pendiente{p > 1 ? 's' : ''}</span> : null}
                </div>
                <h3>{a.title}</h3>
                <p className="muted chico">Vence {fechaLarga(a.due_at)}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
