'use client'

import { useActionState, useState } from 'react'
import { saveFeedbackAction } from '@/lib/learning/actions'
import type { FeedbackDraft, LearningActionState } from '@/lib/learning/types'

export function FeedbackEditor({ personId, sessionId, draft, template }: {
  personId: string; sessionId: string; draft: FeedbackDraft | null; template: string
}) {
  const [state, action, pending] = useActionState<LearningActionState, FormData>(saveFeedbackAction, {})
  const [body, setBody] = useState(draft?.draft_body ?? '')
  const [label, setLabel] = useState(draft?.draft_action_label ?? '')
  const [href, setHref] = useState(draft?.draft_action_href ?? '')
  const [publishAt, setPublishAt] = useState('')
  return (
    <form action={action} className="form">
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="revision" value={state.revision ?? draft?.revision ?? 0} />
      <div className="learning-editor-head">
        <h3>Tu devolución personal</h3>
        <button type="button" className="btn btn-sm" disabled={pending || !!body.trim()} onClick={() => setBody(template)}>Preparar borrador</button>
      </div>
      <p className="muted chico">El borrador toma la reflexión compartida por el alumno. Revisalo y agregá tu observación antes de publicar.</p>
      <label className="field"><span>Mensaje</span>
        <textarea className="textarea learning-message-input" name="body" required maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Una observación concreta, algo para profundizar y un próximo paso…" />
      </label>
      <div className="learning-fields">
        <label className="field"><span>Texto del botón <span className="muted">· opcional</span></span>
          <input className="input" name="label" maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Revisar mi organización" />
        </label>
        <label className="field"><span>Destino dentro del campus</span>
          <input className="input" name="href" maxLength={500} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/campus/organizacion" />
        </label>
      </div>
      <details className="learning-preview"><summary>Vista previa del mensaje</summary>
        <div className="learning-body">{body || 'Tu mensaje aparecerá acá.'}</div>
        {label ? <span className="btn">{label}</span> : null}
      </details>
      {state.error ? <p className="alerta alerta-error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="alerta alerta-ok" role="status">{state.ok}</p> : null}
      <div className="fila">
        <button className="btn" name="intent" value="draft" disabled={pending}>Guardar borrador</button>
        <button className="btn btn-primario" name="intent" value="publish" disabled={pending}>Publicar ahora</button>
      </div>
      <details className="learning-schedule"><summary>Programar publicación</summary>
        <label className="field"><span>Fecha y hora de Buenos Aires (UTC−03:00)</span><input className="input" type="datetime-local" name="publishAt" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></label>
        <button className="btn" name="intent" value="schedule" disabled={pending}>Programar devolución</button>
        <p className="muted chico">El alumno podrá verla a partir de esa hora. Las devoluciones ya publicadas se actualizan con «Publicar ahora».</p>
      </details>
      {pending ? <p role="status">Guardando cambios…</p> : null}
    </form>
  )
}
