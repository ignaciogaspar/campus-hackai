'use client'

import { useActionState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { summarizeAction, type SummaryState } from '@/lib/classroom/actions'
import { SubmitButton } from './SubmitButton'
import './classroom.css'

/** Botón "Resumir el entendimiento con IA" y el reporte resultante. */
export function SummaryPanel({ deckId, liveSessionId }: { deckId: string; liveSessionId: string | null }) {
  const [state, action] = useActionState<SummaryState, FormData>(summarizeAction, {})
  return (
    <section className="card cl-resumen" aria-labelledby="resumen-h">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <h2 id="resumen-h" style={{ fontSize: 18 }}>Resumen con IA</h2>
          <p className="muted chico" style={{ margin: 0 }}>Qué entendió la cohorte y qué conviene reforzar la próxima clase{liveSessionId ? ', solo con los datos de la clase elegida' : ''}.</p>
        </div>
        <form action={action}>
          <input type="hidden" name="deckId" value={deckId} />
          <input type="hidden" name="liveSessionId" value={liveSessionId ?? ''} />
          <SubmitButton pending="Resumiendo… (unos segundos)">{state.markdown ? 'Volver a resumir' : 'Resumir el entendimiento con IA'}</SubmitButton>
        </form>
      </div>
      {state.error ? <div className="alerta alerta-aviso" role="alert">{state.error}</div> : null}
      {state.markdown ? (
        <div className="cl-resumen-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.markdown}</ReactMarkdown>
        </div>
      ) : null}
    </section>
  )
}
