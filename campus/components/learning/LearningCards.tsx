import Link from 'next/link'
import { fechaHora } from '@/lib/format'
import { acknowledgeAction } from '@/lib/learning/actions'
import type { Feedback, NextStep } from '@/lib/learning/types'
import { ActionForm } from '@/components/assignments/ActionForm'
import './learning.css'

export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section className="learning-next" data-kind={step.kind} aria-labelledby="learning-next-title">
      <div><p className="learning-eyebrow">{step.eyebrow}</p><h2 id="learning-next-title">{step.title}</h2><p>{step.detail}</p></div>
      <Link className="btn btn-primario" href={step.href}>{step.label}<span aria-hidden="true"> →</span></Link>
    </section>
  )
}

export function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <article className="learning-feedback" aria-label="Devolución de tu docente">
      <div className="learning-editor-head"><p className="learning-eyebrow">Una devolución para vos</p>
        <span className="badge">{feedback.read_at ? 'Leída' : 'Nueva'}</span>
      </div>
      <p className="muted chico">Publicada {fechaHora(feedback.visible_at)}</p>
      <div className="learning-body">{feedback.body}</div>
      {feedback.action_href ? <Link className="btn btn-primario" href={feedback.action_href}>{feedback.action_label}</Link> : null}
      <div className="learning-receipts">
        {!feedback.read_at ? <Receipt feedback={feedback} kind="read" label="Marcar como leída" /> : <span className="chico muted">✓ Leída · {fechaHora(feedback.read_at)}</span>}
        {!feedback.applied_at ? <Receipt feedback={feedback} kind="applied" label="Ya apliqué el próximo paso" /> : <span className="chico muted">✓ Aplicación registrada · {fechaHora(feedback.applied_at)}</span>}
      </div>
      <p className="muted chico">La devolución queda en tu historial después de leerla.</p>
    </article>
  )
}

function Receipt({ feedback, kind, label }: { feedback: Feedback; kind: 'read' | 'applied'; label: string }) {
  return <ActionForm action={acknowledgeAction} submitLabel={label} pendingLabel="Guardando…" className="learning-receipt-form">
    <input type="hidden" name="sessionId" value={feedback.session_id} />
    <input type="hidden" name="publicationId" value={feedback.publication_id} />
    <input type="hidden" name="kind" value={kind} />
  </ActionForm>
}

export function LearningUnavailable() {
  return <div className="alerta alerta-aviso" role="status">No pudimos cargar el seguimiento de las jornadas. Probá de nuevo en unos minutos; el resto del campus sigue disponible.</div>
}
