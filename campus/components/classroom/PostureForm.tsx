'use client'

import { useActionState, useState } from 'react'
import { savePostureAction, type PostureFormState } from '@/lib/classroom/actions'
import { CONFIDENCE_LABEL, JUSTIFICATION_MAX, JUSTIFICATION_MIN, type CasePosture } from '@/lib/classroom/types'
import { SubmitButton } from './SubmitButton'
import './classroom.css'

/** Formulario del alumno: elegir postura, justificar y declarar confianza. */
export function PostureForm({ caseId, postures, initial, disabled = false }: {
  caseId: string
  postures: CasePosture[]
  initial?: { postureId: string; justification: string; confidence: number | null } | null
  disabled?: boolean
}) {
  const [state, action] = useActionState<PostureFormState, FormData>(savePostureAction, {})
  const [text, setText] = useState(initial?.justification ?? '')
  const largo = text.trim().length
  const editing = !!initial

  return (
    <form action={action} className="form" aria-describedby="postura-ayuda">
      <input type="hidden" name="caseId" value={caseId} />
      <fieldset className="cl-opciones" disabled={disabled}>
        <legend className="label" style={{ marginBottom: 8 }}>Tu postura</legend>
        {postures.map((p) => (
          <label key={p.id} className="cl-opcion">
            <input type="radio" name="postureId" value={p.id} defaultChecked={initial?.postureId === p.id} required />
            <div>
              <strong>{p.label}</strong>
              {p.description ? <span>{p.description}</span> : null}
            </div>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>Justificación</span>
        <textarea
          className="textarea"
          name="justification"
          value={text}
          onChange={(e) => setText(e.target.value)}
          minLength={JUSTIFICATION_MIN}
          maxLength={JUSTIFICATION_MAX}
          required
          disabled={disabled}
          placeholder="¿Por qué elegís esta postura? Usá datos del caso y decí qué tendría que pasar para que cambies de opinión."
        />
        <span className={`cl-contador${largo >= JUSTIFICATION_MIN ? ' cl-contador--ok' : ''}`} aria-live="polite">
          {largo < JUSTIFICATION_MIN ? `Faltan ${JUSTIFICATION_MIN - largo} caracteres` : `${largo} caracteres`}
        </span>
      </label>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
        <legend className="label" style={{ marginBottom: 6 }}>¿Cuánta confianza le tenés?</legend>
        <div className="cl-escala">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n}>
              <input type="radio" name="confidence" value={n} defaultChecked={(initial?.confidence ?? 3) === n} required />
              <strong>{n}</strong>
              {CONFIDENCE_LABEL[n]}
            </label>
          ))}
        </div>
      </fieldset>

      <p id="postura-ayuda" className="ayuda">
        {editing ? 'Podés cambiar tu postura hasta que cierre el caso.' : 'Después de enviar vas a ver cómo se reparte la cohorte, sin nombres.'}
      </p>
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.ok ? (
        <div className="alerta alerta-ok" role="status">{state.changed ? 'Cambiaste tu postura. Quedó guardada.' : 'Tu postura quedó guardada.'}</div>
      ) : null}
      {!disabled ? (
        <SubmitButton pending="Guardando…">{editing ? 'Actualizar mi postura' : 'Enviar mi postura'}</SubmitButton>
      ) : null}
    </form>
  )
}
