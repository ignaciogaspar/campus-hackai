'use client'

import { useState } from 'react'
import type { AiPreview } from '@/lib/assignments/ai'

/**
 * Botón "Pre-evaluar con IA". Pide una sugerencia por criterio a /api/assignments/<id>/ai-preview.
 * Solo se muestra: nunca se guarda ni la ve el alumno.
 */
export function AiPreviewPanel({ assignmentId, submissionId }: { assignmentId: string; submissionId: string }) {
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; data?: AiPreview; error?: string }>({ status: 'idle' })

  async function run() {
    setState({ status: 'loading' })
    try {
      const res = await fetch(`/api/assignments/${encodeURIComponent(assignmentId)}/ai-preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo pre-evaluar.')
      setState({ status: 'ok', data: json as AiPreview })
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : 'No se pudo pre-evaluar.' })
    }
  }

  return (
    <aside className="ent-ia" aria-live="polite">
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="kicker">Sugerencia de IA</div>
          <p className="chico muted" style={{ margin: 0 }}>Orientativa. No es una nota, no se guarda y el alumno no la ve.</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={run} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Pensando…' : state.status === 'ok' ? 'Volver a pre-evaluar' : 'Pre-evaluar con IA'}
        </button>
      </div>
      {state.status === 'error' ? <div className="alerta alerta-error" role="alert">{state.error}</div> : null}
      {state.status === 'ok' && state.data ? (
        <div className="ent-ia-cuerpo">
          <ul className="ent-ia-lista">
            {state.data.suggestions.map((s) => (
              <li key={s.criterionId}>
                <div className="fila"><strong>{s.criterion}</strong><span className="badge">Sugiere {s.score} · {s.levelLabel}</span></div>
                <p className="chico">{s.justification}</p>
              </li>
            ))}
          </ul>
          {state.data.overall ? <p className="chico"><strong>En general:</strong> {state.data.overall}</p> : null}
          {state.data.caveats.length ? (
            <ul className="chico muted">{state.data.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
          ) : null}
          <p className="ayuda">Modelo {state.data.model}. Revisá la entrega vos antes de puntuar.</p>
        </div>
      ) : null}
    </aside>
  )
}
