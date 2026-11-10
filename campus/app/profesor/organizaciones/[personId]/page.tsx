import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import '@/components/assignments/assignments.css'
import '@/components/organizacion/organizacion.css'
import { RubricScoringForm } from '@/components/assignments/RubricScoringForm'
import { EntregablesPortfolio, OrgResumen } from '@/components/organizacion/Portfolio'
import { requireSession } from '@/lib/auth'
import { db, COURSE_ID } from '@/lib/db'
import { fechaHora } from '@/lib/format'
import { ENV_PIECES, envPieces, loadPortfolio } from '@/lib/organizacion/store'
import { organizationGaps } from '@/lib/organizacion/types'
import { routes } from '@/lib/routes'
import { submitDevolucion } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Organización del alumno' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrganizacionAlumno({ params }: { params: Promise<{ personId: string }> }) {
  await requireSession('profesor')
  const { personId } = await params
  if (!UUID.test(personId)) notFound()
  const { data: person } = await db().from('people').select('id, full_name, company, position, role').eq('id', personId).eq('course_id', COURSE_ID).maybeSingle()
  if (!person || person.role !== 'alumno') notFound()
  const data = await loadPortfolio(personId, 'profesor')
  const org = data.organization
  const last = data.envChecks[0] ?? null
  const pieces = last ? envPieces(last) : null

  const extras: Record<string, ReactNode> = {}
  for (const it of data.items) {
    if (!it.submission || !it.assignment) continue
    extras[it.def.id] = (
      <details className="org-no-imprimir" open={!it.teacher}>
        <summary className="chico"><strong>{it.teacher ? 'Editar la devolución' : 'Dejar devolución'}</strong></summary>
        <RubricScoringForm
          rubric={it.assignment.rubric}
          action={submitDevolucion}
          hidden={{ personId, assignmentId: it.def.id, submissionId: it.submission.id }}
          initialScores={it.teacher?.scores}
          initialComment={it.teacher?.comment ?? ''}
          minComment={10}
          submitLabel={it.teacher ? 'Actualizar devolución' : 'Guardar devolución'}
          commentLabel="Devolución para el alumno"
          commentHelp="la ve en su portfolio"
        />
      </details>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <div className="kicker"><Link href="/profesor/organizaciones">Organizaciones</Link> · {person.full_name}</div>
          <h1>{org ? org.name : 'Sin organización cargada'}</h1>
          <p className="muted chico" style={{ margin: 0 }}>
            {[person.position, person.company].filter(Boolean).join(' · ')}
            {org ? ` · actualizada ${fechaHora(org.updated_at)} · ${data.revisions} versiones` : ''}
          </p>
        </div>
      </div>

      <section className="seccion" aria-labelledby="ficha-h">
        <h2 id="ficha-h">Ficha</h2>
        {org ? (
          <div className="card stack">
            <OrgResumen org={org} />
            {organizationGaps(org).length ? <p className="chico muted" style={{ margin: 0 }}>Falta: {organizationGaps(org).join(', ').toLowerCase()}</p> : null}
          </div>
        ) : <div className="vacio">El alumno todavía no dio de alta su organización.</div>}
      </section>

      <section className="seccion" aria-labelledby="entorno-h">
        <h2 id="entorno-h">Entorno</h2>
        <div className="card">
          {last ? (
            <div className="stack chico">
              <span>Última verificación {fechaHora(last.created_at)} · {[last.client, last.client_version].filter(Boolean).join(' ')}{last.os ? ` · ${last.os}` : ''}</span>
              <ul className="org-checklist">
                {ENV_PIECES.map((p) => <li key={p} className={pieces?.[p] ? 'org-ok' : ''}>{p}{p === 'GitHub' && last.github_user ? `: ${last.github_user}` : ''}{p === 'Vercel' && last.vercel_user ? `: ${last.vercel_user}` : ''}{p === 'Supabase' && last.supabase ? `: ${last.supabase}` : ''}</li>)}
              </ul>
              <span className="muted">{data.envChecks.length} verificaciones en total.</span>
            </div>
          ) : <span className="chico muted">Todavía no llamó a hola_campus.</span>}
        </div>
      </section>

      <section className="seccion" aria-labelledby="ent-h">
        <h2 id="ent-h">Entregables y devoluciones</h2>
        <EntregablesPortfolio data={data} audience="profesor" extras={extras} entregaHref={routes.profesorEntrega} />
      </section>
    </div>
  )
}
