import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AiPreviewPanel } from '@/components/assignments/AiPreviewPanel'
import { Markdown } from '@/components/assignments/Markdown'
import { RubricScoringForm } from '@/components/assignments/RubricScoringForm'
import { RubricTable } from '@/components/assignments/RubricTable'
import '@/components/assignments/assignments.css'
import { requireSession } from '@/lib/auth'
import { formatPct, gradeSubmission, weightedPct } from '@/lib/assignments/scoring'
import { loadBundle } from '@/lib/assignments/store'
import { GRADE_MODE_LABEL } from '@/lib/assignments/types'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { submitTeacherReview } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Revisar entrega' }

export default async function RevisarEntrega({ params }: { params: Promise<{ id: string; submissionId: string }> }) {
  const session = await requireSession('profesor')
  const { id, submissionId } = await params
  const bundle = await loadBundle(id)
  if (!bundle) notFound()
  const { assignment, settings, submissions, reviews, students } = bundle
  const submission = submissions.find((s) => s.id === submissionId)
  if (!submission) notFound()
  const rubric = assignment.rubric
  const nameOf = new Map(students.map((s) => [s.id, s.full_name]))
  const author = students.find((s) => s.id === submission.person_id)
  const mine = reviews.filter((r) => r.submission_id === submission.id)
  const peerRows = mine.filter((r) => !r.is_teacher)
  const teacherRows = mine.filter((r) => r.is_teacher && r.status === 'enviada')
  const myTeacher = mine.find((r) => r.is_teacher && r.reviewer_id === session.personId)
  // Una revisión docente por entrega cuenta para la nota: la propia o, si no, la de otro docente.
  const grade = gradeSubmission(submission.id, rubric, reviews, settings)
  const devById = new Map(grade.peerScores.map((s) => [s.reviewId, s]))

  // anterior / siguiente entrega (orden del padrón)
  const order = students.map((s) => submissions.find((x) => x.person_id === s.id)).filter((x): x is NonNullable<typeof x> => !!x)
  const idx = order.findIndex((s) => s.id === submission.id)
  const prev = idx > 0 ? order[idx - 1] : null
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={routes.profesorEntrega(assignment.id)} className="chico">← {assignment.title}</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Revisar entrega</div>
          <h1>{author?.full_name ?? 'Alumno'}</h1>
          <div className="ent-meta" style={{ marginTop: 8 }}>
            {author?.company ? <span>{author.position ? `${author.position} · ` : ''}{author.company}</span> : null}
            <span>Entregó el {fechaHora(submission.updated_at)}</span>
            <span>Nota final: <strong>{formatPct(grade.final)}</strong> ({GRADE_MODE_LABEL[settings.gradeMode].toLowerCase()})</span>
          </div>
        </div>
        <div className="fila">
          {prev ? <Link className="btn btn-sm" href={`${routes.profesorEntrega(assignment.id)}/revisar/${prev.id}`}>← Anterior</Link> : null}
          {next ? <Link className="btn btn-sm" href={`${routes.profesorEntrega(assignment.id)}/revisar/${next.id}`}>Siguiente →</Link> : null}
        </div>
      </div>

      {grade.discordant ? <div className="alerta alerta-aviso" role="status">Para mirar: {grade.discordReasons.join(' · ')}.</div> : null}

      <div className="ent-grid seccion">
        <section className="card stack" aria-labelledby="entrega-h">
          <h2 id="entrega-h" style={{ margin: 0 }}>Entrega</h2>
          {submission.url ? <p className="chico" style={{ margin: 0 }}>Link: <a href={submission.url} target="_blank" rel="noreferrer noopener">{submission.url}</a></p> : null}
          {submission.body_md ? <div className="ent-entrega"><Markdown>{submission.body_md}</Markdown></div> : <div className="vacio">Sin texto: la entrega es solo el link.</div>}
        </section>

        <div className="stack">
          <AiPreviewPanel assignmentId={assignment.id} submissionId={submission.id} />
          <section className="card" aria-labelledby="docente-h">
            <h2 id="docente-h">Tu revisión docente</h2>
            <p className="muted chico">Misma rúbrica que los pares. El alumno la ve como «Revisión docente».</p>
            <RubricScoringForm
              rubric={rubric}
              action={submitTeacherReview}
              hidden={{ assignmentId: assignment.id, submissionId: submission.id }}
              initialScores={myTeacher?.scores}
              initialComment={myTeacher?.comment ?? ''}
              minComment={10}
              submitLabel={myTeacher ? 'Actualizar revisión docente' : 'Guardar revisión docente'}
              commentLabel="Devolución para el alumno"
            />
          </section>
        </div>
      </div>

      <section className="seccion" aria-labelledby="pares-h">
        <h2 id="pares-h">Revisiones recibidas</h2>
        {peerRows.length === 0 && teacherRows.length === 0 ? <div className="vacio">Todavía no tiene revisiones asignadas.</div> : (
          <div className="stack">
            <div className="card">
              <RubricTable
                rubric={rubric}
                compact
                marks={Object.fromEntries([
                  ...peerRows.filter((r) => r.status === 'enviada').map((r) => [nameOf.get(r.reviewer_id) ?? 'Par', r.scores]),
                  ...teacherRows.map((r) => [r.reviewer_id === session.personId ? 'Vos' : 'Docente', r.scores]),
                ])}
              />
            </div>
            {[...teacherRows, ...peerRows].map((r) => {
              const dev = devById.get(r.id)
              return (
                <article key={r.id} className={`card ent-recibida${r.is_teacher ? ' ent-recibida-docente' : ''}`}>
                  <div className="fila" style={{ justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>{r.is_teacher ? `Docente · ${r.reviewer_id === session.personId ? 'vos' : 'otro docente'}` : nameOf.get(r.reviewer_id) ?? 'Par'}</h3>
                    <div className="fila">
                      {r.status === 'enviada' ? <span className="badge">{formatPct(weightedPct(rubric, r.scores))}</span> : <span className="badge badge-vivo">Pendiente</span>}
                      {dev?.deviation !== null && dev?.deviation !== undefined ? (
                        <span className={`chico ent-dev${dev.discordant ? ' ent-dev-alta' : ''}`}>{dev.deviation > 0 ? '+' : ''}{dev.deviation} pts</span>
                      ) : null}
                    </div>
                  </div>
                  {r.status === 'enviada' ? (
                    <>
                      <div className="ent-scores">
                        {rubric.map((c) => <span key={c.id} className="badge badge-ficticio">{c.criterion}: {r.scores[c.id] ?? '—'}</span>)}
                      </div>
                      {r.comment ? <Markdown>{r.comment}</Markdown> : null}
                      <p className="ayuda" style={{ margin: 0 }}>Enviada el {fechaHora(r.submitted_at)}</p>
                    </>
                  ) : <p className="muted chico" style={{ margin: 0 }}>Asignada el {fechaHora(r.created_at)}, todavía sin enviar.</p>}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
