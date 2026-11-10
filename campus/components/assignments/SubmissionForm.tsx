'use client'

import { useActionState, useState } from 'react'
import { INITIAL_ACTION_STATE, type ActionState } from './action-state'

/** Formulario de entrega: texto en markdown + link opcional. */
export function SubmissionForm({ action, assignmentId, initialBody, initialUrl, hasSubmission }: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  assignmentId: string
  initialBody: string
  initialUrl: string
  hasSubmission: boolean
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE)
  const [body, setBody] = useState(initialBody)
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  return (
    <form action={formAction} className="form">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className="field">
        <span>Tu entrega</span>
        <textarea
          className="textarea ent-textarea"
          name="bodyMd"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Escribí acá tu respuesta. Podés usar markdown: **negrita**, listas con -, títulos con #."
        />
        <span className="ayuda">{words} palabras · markdown habilitado</span>
      </label>
      <label className="field">
        <span>Link (opcional)</span>
        <input className="input" name="url" type="url" inputMode="url" defaultValue={initialUrl} placeholder="https://docs.google.com/…" />
        <span className="ayuda">Si tu entrega es un documento o una presentación, pegá el link con acceso de lectura.</span>
      </label>
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.ok ? <div className="alerta alerta-ok" role="status">{state.ok}</div> : null}
      <div className="fila">
        <button className="btn btn-primario" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : hasSubmission ? 'Guardar cambios' : 'Entregar'}
        </button>
        <span className="ayuda">Podés editarla hasta el vencimiento.</span>
      </div>
    </form>
  )
}
