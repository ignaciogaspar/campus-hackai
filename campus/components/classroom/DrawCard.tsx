import { drawOutcomeAction, showDrawOnLiveAction } from '@/lib/classroom/actions'
import type { DrawnStudent } from '@/lib/classroom/participation'
import { DRAW_OUTCOME_LABEL, QUALITY_LABEL } from '@/lib/classroom/types'
import { Avatar } from './Avatar'
import { SubmitButton } from './SubmitButton'
import './classroom.css'

/** Resultado del sorteo con los botones participó / pasó / ausente. */
export function DrawCard({ draw, back, postureLabel, canProject }: {
  draw: DrawnStudent
  /** Ruta a la que vuelven las actions. */
  back: string
  postureLabel?: string | null
  canProject: boolean
}) {
  return (
    <article className="card cl-sorteo" aria-live="polite">
      <Avatar name={draw.name} photoUrl={draw.photoUrl} />
      <div>
        <div className="kicker">{draw.outcome === 'pendiente' ? 'Salió sorteado' : `Resultado: ${DRAW_OUTCOME_LABEL[draw.outcome]}`}</div>
        <h2>{draw.name}</h2>
        <p>{[draw.position, draw.company].filter(Boolean).join(' · ') || 'Alumno'}{postureLabel ? ` · postura: ${postureLabel}` : ''}</p>
      </div>
      <div className="cl-resultado">
        <form action={drawOutcomeAction}>
          <input type="hidden" name="drawId" value={draw.drawId} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="outcome" value="participo" />
          <select className="select" name="quality" defaultValue="2" aria-label="Calidad de la participación">
            {[1, 2, 3].map((q) => <option key={q} value={q}>{q} · {QUALITY_LABEL[q]}</option>)}
          </select>
          <input className="input" name="note" placeholder="Nota (opcional)" maxLength={300} aria-label="Nota" />
          <SubmitButton className="btn btn-accion">Participó</SubmitButton>
        </form>
        <form action={drawOutcomeAction}>
          <input type="hidden" name="drawId" value={draw.drawId} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton className="btn" name="outcome" value="paso">Pasó</SubmitButton>
          <SubmitButton className="btn" name="outcome" value="ausente">Ausente</SubmitButton>
        </form>
        {canProject ? (
          <form action={showDrawOnLiveAction}>
            <input type="hidden" name="drawId" value={draw.drawId} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton className="btn btn-ghost" pending="Proyectando…">Mostrar en el proyector</SubmitButton>
          </form>
        ) : null}
      </div>
    </article>
  )
}
