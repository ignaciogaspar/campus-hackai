import type { RadarItem } from '@/lib/actividades/radar'
import { deleteRadarCommentAction } from '@/app/campus/radar/actions'
import { fechaHora } from '@/lib/format'
import { SubmitButton } from '@/components/classroom/SubmitButton'
import { RadarCommentForm } from './RadarCommentForm'
import './actividades.css'

/** Mensajes de la cohorte debajo de una noticia del radar, más la caja para escribir. */
export function RadarComments({ item, me, isProfesor }: { item: RadarItem; me: string; isProfesor: boolean }) {
  return (
    <div className="ac-radar-mensajes">
      {item.comments.length ? (
        <ul className="ac-mensajes">
          {item.comments.map((c) => (
            <li key={c.id} className="ac-mensaje">
              <div className="ac-mensaje-cabeza">
                <strong>{c.name}</strong>
                {c.role === 'profesor' ? <span className="badge">Profesor</span> : null}
                <span className="chico muted">{fechaHora(c.created_at)}</span>
                {c.person_id === me || isProfesor ? (
                  <form action={deleteRadarCommentAction} className="ac-mensaje-borrar">
                    <input type="hidden" name="commentId" value={c.id} />
                    <SubmitButton className="btn btn-ghost btn-sm" pending="…" title="Borrar mensaje">Borrar</SubmitButton>
                  </form>
                ) : null}
              </div>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
      ) : <span className="chico muted">Todavía nadie comentó.</span>}
      <RadarCommentForm itemId={item.id} />
    </div>
  )
}
