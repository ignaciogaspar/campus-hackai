import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/assignments/Markdown'
import { RubricScoringForm } from '@/components/assignments/RubricScoringForm'
import { RubricTable } from '@/components/assignments/RubricTable'
import { SubmissionForm } from '@/components/assignments/SubmissionForm'
import '@/components/assignments/assignments.css'
import '@/components/organizacion/organizacion.css'
import { EntornoPasos } from '@/components/organizacion/EntornoPasos'
import { B1_ENTORNO_ID } from '@/lib/organizacion/entregables'
import { mcpUrl } from '@/lib/organizacion/mcp-url'
import { listEnvChecks } from '@/lib/organizacion/store'
import { requirePerson } from '@/lib/auth'
import { commonScale, criterionMeans, formatPct, pctToScale, weightedPct } from '@/lib/assignments/scoring'
import { getAssignmentRow, loadStudentView, submissionWindow } from '@/lib/assignments/store'
import { GRADE_MODE_LABEL, MIN_COMMENT_LENGTH, STATUS_LABEL } from '@/lib/assignments/types'
import { fechaHora, fechaLarga } from '@/lib/format'
import { routes } from '@/lib/routes'
import { submitPeerReview, submitWork } from './actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await getAssignmentRow((await params).id)
  return { title: a ? a.title : 'Entrega' }
}

export default async function EntregaAlumno({ params }: { params: Promise<{ id: string }> }) {
  const { person } = await requirePerson('alumno')
  const { id } = await params
  const view = await loadStudentView(id, person.id)
  if (!view || view.bundle.assignment.status === 'borrador') notFound()
  const { assignment, settings } = view.bundle
  const rubric = assignment.rubric
  const scale = commonScale(rubric)
  const win = submissionWindow(assignment)
  const pendientes = view.toReview.filter((r) => r.review.status === 'asignada').length
  const reviewOpen = assignment.status === 'revision-pares'
  const esB1 = assignment.id === B1_ENTORNO_ID
  const [envChecks, url] = esB1 ? await Promise.all([listEnvChecks(person.id), mcpUrl()]) : [[], '']

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={`${routes.campus}#entregas`} className="chico">← Entregas</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Entrega</div>
          <h1>{assignment.title}</h1>
          <div className="fila" style={{ marginTop: 8 }}>
            <span className={`badge${assignment.status === 'abierta' ? ' badge-ok' : assignment.status === 'revision-pares' ? ' badge-vivo' : ''}`}>{STATUS_LABEL[assignment.status]}</span>
            {view.mySubmission ? <span className="badge badge-ok">Entregada</span> : null}
            <span className="muted chico">{assignment.due_at ? `Vence el ${fechaLarga(assignment.due_at)} · ${fechaHora(assignment.due_at)}` : 'Sin fecha de vencimiento'}</span>
          </div>
        </div>
      </div>

      {reviewOpen && pendientes > 0 ? (
        <div className="alerta alerta-aviso" role="status">
          Tenés {pendientes} revisión{pendientes > 1 ? 'es' : ''} entre pares pendiente{pendientes > 1 ? 's' : ''}. <a href="#revisar">Ir a revisar</a>
        </div>
      ) : null}

      <div className="ent-grid seccion">
        <section className="card" aria-labelledby="consigna-h">
          <h2 id="consigna-h">Consigna</h2>
          <Markdown>{assignment.brief_md}</Markdown>
        </section>
        <section className="card" aria-labelledby="rubrica-h">
          <h2 id="rubrica-h">Rúbrica</h2>
          <p className="muted chico">Así se evalúa: tus pares y el equipo docente usan estos niveles. El porcentaje es el peso de cada criterio.</p>
          <RubricTable rubric={rubric} />
        </section>
      </div>

      {esB1 ? (
        <section className="seccion" id="entorno" aria-labelledby="entorno-h">
          <h2 id="entorno-h">Verificá tu entorno</h2>
          <div className="card">
            <EntornoPasos mcpUrl={url} checks={envChecks} />
          </div>
        </section>
      ) : null}

      <section className="seccion" id="mi-entrega" aria-labelledby="mi-entrega-h">
        <h2 id="mi-entrega-h">Tu entrega</h2>
        <div className="card">
          {win.open ? (
            <>
              {view.mySubmission ? <p className="muted chico">Última versión guardada el {fechaHora(view.mySubmission.updated_at)}.</p> : null}
              <SubmissionForm
                action={submitWork}
                assignmentId={assignment.id}
                initialBody={view.mySubmission?.body_md ?? ''}
                initialUrl={view.mySubmission?.url ?? ''}
                hasSubmission={!!view.mySubmission}
              />
            </>
          ) : view.mySubmission ? (
            <div className="stack">
              <p className="muted chico">{win.reason} Entregaste el {fechaHora(view.mySubmission.updated_at)}.</p>
              {view.mySubmission.url ? <p><a href={view.mySubmission.url} target="_blank" rel="noreferrer noopener">{view.mySubmission.url}</a></p> : null}
              {view.mySubmission.body_md ? <div className="ent-entrega"><Markdown>{view.mySubmission.body_md}</Markdown></div> : null}
            </div>
          ) : (
            <div className="vacio">{win.reason} No registramos una entrega tuya.</div>
          )}
        </div>
      </section>

      {view.toReview.length > 0 ? (
        <section className="seccion" id="revisar" aria-labelledby="revisar-h">
          <h2 id="revisar-h">Revisión entre pares · {view.toReview.length - pendientes}/{view.toReview.length} enviadas</h2>
          <p className="muted chico">
            Las entregas son anónimas y tu revisión también. Elegí un nivel por criterio y dejá un comentario constructivo:
            qué funciona y por qué, qué mejorarías y cómo. Pensá en lo que te serviría leer a vos.
          </p>
          {view.toReview.map(({ review, label, submission }) => (
            <article key={review.id} className="card ent-revision" aria-label={label}>
              <div className="fila" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{label}</h3>
                {review.status === 'enviada'
                  ? <span className="badge badge-ok">Enviada · {formatPct(weightedPct(rubric, review.scores))}</span>
                  : <span className="badge badge-vivo">Pendiente</span>}
              </div>
              {submission.url ? <p className="chico">Link: <a href={submission.url} target="_blank" rel="noreferrer noopener">{submission.url}</a></p> : null}
              {submission.body_md ? <div className="ent-entrega"><Markdown>{submission.body_md}</Markdown></div> : <div className="vacio">La entrega es solo el link.</div>}
              {reviewOpen ? (
                <RubricScoringForm
                  rubric={rubric}
                  action={submitPeerReview}
                  hidden={{ assignmentId: assignment.id, reviewId: review.id }}
                  initialScores={review.scores}
                  initialComment={review.comment ?? ''}
                  minComment={MIN_COMMENT_LENGTH}
                  submitLabel={review.status === 'enviada' ? 'Actualizar revisión' : 'Enviar revisión'}
                  commentLabel="Comentario para el autor (obligatorio)"
                  commentHelp="concreto y respetuoso"
                />
              ) : (
                <p className="muted chico">La revisión entre pares está cerrada.</p>
              )}
            </article>
          ))}
        </section>
      ) : reviewOpen && view.mySubmission ? (
        <section className="seccion" aria-labelledby="revisar-h">
          <h2 id="revisar-h">Revisión entre pares</h2>
          <div className="vacio">Todavía no tenés entregas asignadas para revisar.</div>
        </section>
      ) : null}

      {view.mySubmission && (view.received.length > 0 || view.receivedHiddenReason) ? (
        <section className="seccion" id="devolucion" aria-labelledby="devolucion-h">
          <h2 id="devolucion-h">Devolución sobre tu entrega</h2>
          {view.grade?.final !== null && view.grade?.final !== undefined ? (
            <div className="card fila" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="kicker">Puntaje ponderado</div>
                <div className="ent-puntaje">
                  {formatPct(view.grade.final)}
                  {scale ? <small> · {pctToScale(view.grade.final, scale)?.toLocaleString('es-AR')} de {scale}</small> : null}
                </div>
              </div>
              <p className="muted chico" style={{ maxWidth: 420, margin: 0 }}>
                Criterio: {GRADE_MODE_LABEL[settings.gradeMode].toLowerCase()}.
                {view.grade.peerMean !== null ? ` Media de pares: ${formatPct(view.grade.peerMean)}.` : ''}
                {assignment.status !== 'cerrada' ? ' Puede cambiar hasta que cierre la entrega.' : ''}
              </p>
            </div>
          ) : null}
          {view.receivedHiddenReason ? <div className="alerta" style={{ marginBottom: 16 }}>{view.receivedHiddenReason}</div> : null}
          {view.received.length > 0 ? (
            <div className="stack">
              {view.received.length > 1 ? (
                <div className="card">
                  <h3>Promedio por criterio</h3>
                  <div className="ent-scores">
                    {rubric.map((c) => {
                      const m = criterionMeans(rubric, view.received.map((r) => r.review))[c.id]
                      return <span key={c.id} className="badge">{c.criterion}: {m?.toLocaleString('es-AR') ?? '—'}</span>
                    })}
                  </div>
                  <RubricTable rubric={rubric} compact marks={Object.fromEntries(view.received.map((r) => [r.label, r.review.scores]))} />
                </div>
              ) : null}
              {view.received.map(({ review, label }) => (
                <article key={review.id} className={`card ent-recibida${review.is_teacher ? ' ent-recibida-docente' : ''}`}>
                  <div className="fila" style={{ justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0 }}>{label}</h3>
                    <span className="badge">{formatPct(weightedPct(rubric, review.scores))}</span>
                  </div>
                  <div className="ent-scores">
                    {rubric.map((c) => {
                      const s = review.scores[c.id]
                      const lvl = c.levels.find((l) => l.score === s)
                      return <span key={c.id} className="badge badge-ficticio">{c.criterion}: {s ?? '—'}{lvl ? ` · ${lvl.label}` : ''}</span>
                    })}
                  </div>
                  {review.comment ? <Markdown>{review.comment}</Markdown> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
