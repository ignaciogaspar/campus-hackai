'use client'

import { useActionState, type ReactNode } from 'react'
import { INITIAL_ACTION_STATE, type ActionState } from './action-state'

/** Formulario genérico para server actions con (prev, form) → ActionState: muestra error u ok. */
export function ActionForm({ action, children, submitLabel, pendingLabel, className, confirm }: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  children: ReactNode
  submitLabel: string
  pendingLabel?: string
  className?: string
  /** Si se pasa, pide confirmación antes de enviar. */
  confirm?: string
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_ACTION_STATE)
  return (
    <form
      action={formAction}
      className={className ?? 'form'}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {children}
      {state.error ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.ok ? <div className="alerta alerta-ok" role="status">{state.ok}</div> : null}
      <div className="fila">
        <button className="btn btn-primario" type="submit" disabled={pending}>{pending ? pendingLabel ?? 'Procesando…' : submitLabel}</button>
      </div>
    </form>
  )
}
