import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { listSlots, type Slot } from '@/lib/actividades/office-hours'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { diaSemana, fechaCorta, fechaHora } from '@/lib/format'
import { SubmitButton } from '@/components/classroom/SubmitButton'
import { bookAction, cancelAction } from './actions'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Office hours' }

const hora = (iso: string) => fechaHora(iso).split(' ')[1] ?? ''

function SlotRow({ slot, me }: { slot: Slot; me: string }) {
  const mine = slot.bookings.find((b) => b.person_id === me)
  const left = slot.capacity - slot.bookings.length
  return (
    <article className="card ac-slot">
      <div className="ac-slot-fecha">{fechaCorta(slot.starts_at)} {hora(slot.starts_at)}<span>{diaSemana(slot.starts_at)} · {slot.minutes} min</span></div>
      <div className="stack" style={{ gap: 2 }}>
        <strong>{slot.teacher_name}</strong>
        <span className="chico muted">{slot.mode === 'presencial' ? 'Presencial' : 'Online'}{mine && slot.location ? ` · ${slot.location}` : ''}{slot.capacity > 1 ? ` · grupal (${slot.capacity})` : ''}</span>
        {slot.notes ? <span className="chico">{slot.notes}</span> : null}
        {mine ? <span className="chico">Tu tema: {mine.topic || '—'}</span> : null}
        {mine && slot.mode === 'online' && slot.location && /^https?:\/\//.test(slot.location) ? <a className="chico" href={slot.location} target="_blank" rel="noopener noreferrer">Entrar a la videollamada</a> : null}
      </div>
      {mine ? (
        <form action={cancelAction}>
          <input type="hidden" name="slotId" value={slot.id} />
          <SubmitButton className="btn btn-ghost btn-sm" pending="Cancelando…">Cancelar</SubmitButton>
        </form>
      ) : left > 0 ? (
        <form action={bookAction} className="fila">
          <input type="hidden" name="slotId" value={slot.id} />
          <input className="input" name="topic" placeholder="¿Sobre qué querés hablar?" maxLength={300} style={{ minWidth: 200 }} required />
          <SubmitButton className="btn btn-primario btn-sm" pending="Reservando…">Reservar</SubmitButton>
        </form>
      ) : <span className="badge">Completo</span>}
    </article>
  )
}

export default async function OfficeHoursAlumno({ searchParams }: { searchParams: Promise<{ aviso?: string; error?: string }> }) {
  const { person } = await requirePerson('alumno')
  const sp = await searchParams
  const slots = await listSlots({ from: new Date(Date.now() - 60 * 60_000).toISOString() })
  const mine = slots.filter((s) => s.bookings.some((b) => b.person_id === person.id))
  const open = slots.filter((s) => !s.bookings.some((b) => b.person_id === person.id) && new Date(s.starts_at).getTime() > Date.now())
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.campusActividades} className="chico">← Actividades</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Opcionales</div>
          <h1>Office hours</h1>
          <p className="muted chico">Reservá un turno con un profesor para destrabar tu proyecto. Contá el tema así llega preparado.</p>
        </div>
      </div>
      {sp.aviso ? <div className="alerta alerta-ok" role="status">{sp.aviso}</div> : null}
      {sp.error ? <div className="alerta alerta-error" role="alert">{sp.error}</div> : null}
      <section className="seccion stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Tus turnos</h2>
        {mine.length ? <div className="ac-slots">{mine.map((s) => <SlotRow key={s.id} slot={s} me={person.id} />)}</div> : <div className="vacio">No tenés turnos reservados.</div>}
      </section>
      <section className="seccion stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Turnos disponibles</h2>
        {open.length ? <div className="ac-slots">{open.map((s) => <SlotRow key={s.id} slot={s} me={person.id} />)}</div> : <div className="vacio">No hay turnos publicados por ahora.</div>}
      </section>
    </div>
  )
}
