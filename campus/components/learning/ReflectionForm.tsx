'use client'

import { useActionState, useState } from 'react'
import { saveReflectionAction } from '@/lib/learning/actions'
import type { LearningActionState, Reflection } from '@/lib/learning/types'

export function ReflectionForm({ sessionId, reflection }: { sessionId: string; reflection: Reflection | null }) {
  const [state, action, pending] = useActionState<LearningActionState, FormData>(saveReflectionAction, {})
  const [takeaway, setTakeaway] = useState(reflection?.takeaway ?? '')
  const [unclear, setUnclear] = useState(reflection?.unclear ?? '')
  const [application, setApplication] = useState(reflection?.application ?? '')
  return (
    <form action={action} className="form learning-reflection">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="revision" value={state.revision ?? reflection?.revision ?? 0} />
      <p className="muted chico">Un minuto para cerrar la clase. Compartís estas respuestas con tus docentes; no llevan nota.</p>
      <label className="field"><span>Una idea que me llevo <span className="muted">· requerida</span></span>
        <textarea className="textarea" name="takeaway" required maxLength={1200} value={takeaway} onChange={(e) => setTakeaway(e.target.value)} placeholder="Algo que cambió cómo pensás o decidís…" />
      </label>
      <label className="field"><span>Lo que todavía me genera dudas</span>
        <textarea className="textarea" name="unclear" maxLength={1200} value={unclear} onChange={(e) => setUnclear(e.target.value)} placeholder="Un concepto o una pregunta para retomar…" />
      </label>
      <label className="field"><span>Lo que quiero aplicar en mi organización</span>
        <textarea className="textarea" name="application" maxLength={1200} value={application} onChange={(e) => setApplication(e.target.value)} placeholder="Un proceso, una decisión o un experimento…" />
      </label>
      {state.error ? <p className="alerta alerta-error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="alerta alerta-ok" role="status">{state.ok}</p> : null}
      <div><button className="btn btn-primario" disabled={pending}>{pending ? 'Guardando…' : 'Guardar mi reflexión'}</button></div>
    </form>
  )
}
