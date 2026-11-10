import { Avatar } from './Avatar'
import './classroom.css'

/** Tarjeta grande del alumno sorteado (overlay `student` del proyector). */
export function StudentCard({ name, company, position, photoUrl, kicker = 'Te toca' }: {
  name: string
  company?: string | null
  position?: string | null
  photoUrl?: string | null
  kicker?: string
}) {
  return (
    <div className="cl-overlay">
      <div className="cl-alumno-card">
        <Avatar name={name} photoUrl={photoUrl} />
        <div>
          <div className="kicker">{kicker}</div>
          <h2>{name}</h2>
          {position || company ? <p className="muted">{[position, company].filter(Boolean).join(' · ')}</p> : null}
        </div>
      </div>
    </div>
  )
}
