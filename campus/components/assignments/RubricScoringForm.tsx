'use client'

import { useActionState, useState } from 'react'
import { weightedPct } from '@/lib/assignments/scoring'
import type { Rubric, Scores } from '@/lib/assignments/types'
import { INITIAL_ACTION_STATE, type ActionState } from './action-state'

/**
 * Puntuar con la rúbrica: un nivel por criterio + comentario. Los puntajes viajan como
 * `score:<criterionId>` en el FormData.
 */
export function RubricScoringForm({
  rubric, action, hidden, initialScores, initialComment, minComment, submitLabel, commentLabel, commentHelp, disabled,
}: {
  rubric: Rubric
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  hidden: Record<string, string>
  initialScores?: Scores
  initialComment?: string
  minComment: number
  submitLabel: string
  commentLabel?: string
  commentHelp?: string
  disabled?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE)
  const [scores, setScores] = useState<Scores>(initialScores ?? {})
  const [comment, setComment] = useState(initialComment ?? '')
  const pct = weightedPct(rubric, scores)
  const missing = rubric.filter((c) => scores[c.id] === undefined).length
  const short = comment.trim().length < minComment
  const uid = Object.values(hidden).join('-')

  return (
    <form action={formAction} className="form ent-puntuar">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {rubric.map((c) => (
        <fieldset key={c.id} className="ent-fieldset" disabled={disabled}>
          <legend>{c.criterion} <span className="muted chico">· peso {c.weight}</span></legend>
          <div className="ent-opciones">
            {c.levels.map((l) => {
              const id = `${uid}-${c.id}-${l.score}`
              const checked = scores[c.id] === l.score
              return (
                <label key={l.score} htmlFor={id} className={checked ? 'ent-opcion ent-opcion-on' : 'ent-opcion'}>
                  <input
                    id={id}
                    type="radio"
                    name={`score:${c.id}`}
                    value={l.score}
                    checked={checked}
                    onChange={() => setScores((s) => ({ ...s, [c.id]: l.score }))}
                  />
                  <span className="ent-opcion-head"><strong>{l.score}</strong> {l.label}</span>
                  {l.description ? <span className="ent-opcion-desc">{l.description}</span> : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <label className="field">
        <span>{commentLabel ?? 'Comentario'}</span>
        <textarea
          className="textarea"
          name="comment"
          rows={6}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={disabled}
          placeholder="Qué funciona y por qué · qué mejorarías y cómo · una pregunta que le harías al autor."
        />
        <span className={short ? 'ayuda ent-falta' : 'ayuda'}>
          {comment.trim().length}/{minComment} caracteres mínimos{commentHelp ? ` · ${commentHelp}` : ''}
        </span>
      </label>
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.ok ? <div className="alerta alerta-ok" role="status">{state.ok}</div> : null}
      <div className="fila">
        <button className="btn btn-primario" type="submit" disabled={pending || disabled || missing > 0 || short}>
          {pending ? 'Enviando…' : submitLabel}
        </button>
        <span className="ayuda">
          {missing > 0 ? `Te falta${missing > 1 ? 'n' : ''} ${missing} criterio${missing > 1 ? 's' : ''}.` : `Puntaje ponderado: ${pct?.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`}
        </span>
      </div>
    </form>
  )
}
