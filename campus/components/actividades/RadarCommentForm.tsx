'use client'

import { useActionState, useEffect, useRef } from 'react'
import { commentRadarAction, type RadarCommentState } from '@/app/campus/radar/actions'
import { SubmitButton } from '@/components/classroom/SubmitButton'

export function RadarCommentForm({ itemId }: { itemId: string }) {
  const [state, action] = useActionState<RadarCommentState, FormData>(commentRadarAction, {})
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => { if (state.ok) ref.current?.reset() }, [state])
  return (
    <form ref={ref} action={action} className="ac-mensaje-form">
      <input type="hidden" name="itemId" value={itemId} />
      <textarea className="textarea" name="body" rows={2} style={{ minHeight: 64 }} maxLength={1000} placeholder="Escribí un comentario…" aria-label="Tu comentario" required />
      <div className="ac-guardar">
        <SubmitButton className="btn btn-primario btn-sm" pending="Enviando…">Comentar</SubmitButton>
        {state.error ? <span className="ac-estado ac-estado-error" role="alert">{state.error}</span> : null}
      </div>
    </form>
  )
}
