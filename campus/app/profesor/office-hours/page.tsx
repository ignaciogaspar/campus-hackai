import Link from 'next/link'
import { requirePerson } from '@/lib/auth'
import { listSlots, listTeachers, type Slot } from '@/lib/actividades/office-hours'
import { actividadesRoutes as r } from '@/lib/actividades/routes'
import { diaSemana, fechaCorta, fechaHora } from '@/lib/format'
import { SubmitButton } from '@/components/classroom/SubmitButton'
import { createSlotsAction, deleteSlotAction } from './actions'
import '@/components/actividades/actividades.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Office hours' }

const hora = (iso: string) => fechaHora(iso).split(' ')[1] ?? ''

function SlotRow({ slot }: { slot: Slot }) {
  return (
    <article className="card ac-slot">
      <div className="ac-slot-fecha">{fechaCorta(slot.starts_at)} {hora(slot.starts_at)}<span>{diaSemana(slot.starts_at)} · {slot.minutes} min</span></div>
      <div className="stack" style={{ gap: 4 }}>
        <span><strong>{slot.teacher_name}</strong> <span className="chico muted">· {slot.mode === 'presencial' ? 'Presencial' : 'Online'}{slot.location ? ` · ${slot.location}` : ''} · {slot.bookings.length}/{slot.capacity}</span></span>
        {slot.notes ? <span className="chico">{slot.notes}</span> : null}
        {slot.bookings.length ? (
          <ul className="ac-lineas">{slot.bookings.map((b) => <li key={b.id}><strong>{b.name}</strong>{b.company ? ` (${b.company})` : ''}: {b.topic || 'sin tema'}</li>)}</ul>
        ) : <span className="chico muted">Sin reservas.</span>}
      </div>
      <form action={deleteSlotAction}>
        <input type="hidden" name="slotId" value={slot.id} />
        <SubmitButton className="btn btn-ghost btn-sm" pending="Borrando…">Borrar</SubmitButton>
      </form>
    </article>
  )
}

export default async function OfficeHoursProfesor({ searchParams }: { searchParams: Promise<{ aviso?: string; error?: string }> }) {
  const { person } = await requirePerson('profesor')
  const sp = await searchParams
  const [slots, teachers] = await Promise.all([listSlots(), listTeachers()])
  const now = Date.now()
  const upcoming = slots.filter((s) => new Date(s.starts_at).getTime() + s.minutes * 60_000 > now)
  const past = slots.filter((s) => new Date(s.starts_at).getTime() + s.minutes * 60_000 <= now).reverse()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={r.profesorActividades} className="chico">← Actividades</Link>
          <h1 style={{ marginTop: 8 }}>Office hours</h1>
          <p className="muted chico">Publicá franjas; los alumnos reservan desde el campus con el tema que traen. El link o lugar lo ven solo quienes reservaron.</p>
        </div>
      </div>
      {sp.aviso ? <div className="alerta alerta-ok" role="status">{sp.aviso}</div> : null}
      {sp.error ? <div className="alerta alerta-error" role="alert">{sp.error}</div> : null}
      <section className="card seccion">
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Publicar franjas</h2>
        <form action={createSlotsAction} className="form">
          <div className="ac-campos">
            <label className="field"><span>Profesor</span>
              <select className="select" name="teacherId" defaultValue={person.id}>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </label>
            <label className="field"><span>Fecha</span><input className="input" type="date" name="date" required /></label>
            <label className="field"><span>Desde (hora de Buenos Aires)</span><input className="input" type="time" name="time" defaultValue="17:00" required /></label>
            <label className="field"><span>Minutos por turno</span><input className="input" type="number" name="minutes" min={10} max={180} defaultValue={20} /></label>
            <label className="field"><span>Cantidad de turnos seguidos</span><input className="input" type="number" name="count" min={1} max={12} defaultValue={3} /></label>
            <label className="field"><span>Cupo por turno</span><input className="input" type="number" name="capacity" min={1} max={20} defaultValue={1} /></label>
            <label className="field"><span>Modalidad</span>
              <select className="select" name="mode" defaultValue="online"><option value="online">Online</option><option value="presencial">Presencial</option></select>
            </label>
            <label className="field"><span>Link o lugar</span><input className="input" name="location" placeholder="https://meet… o DOT, piso 2" /></label>
          </div>
          <label className="field"><span>Nota (opcional)</span><input className="input" name="notes" placeholder="Traé tu repo abierto y el error a mano." /></label>
          <div><SubmitButton pending="Publicando…">Publicar</SubmitButton></div>
        </form>
      </section>
      <section className="seccion stack" style={{ gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Próximas ({upcoming.length})</h2>
        {upcoming.length ? <div className="ac-slots">{upcoming.map((s) => <SlotRow key={s.id} slot={s} />)}</div> : <div className="vacio">No hay franjas publicadas.</div>}
      </section>
      {past.length ? (
        <details className="seccion">
          <summary><strong>Pasadas ({past.length})</strong></summary>
          <div className="ac-slots" style={{ marginTop: 10 }}>{past.map((s) => <SlotRow key={s.id} slot={s} />)}</div>
        </details>
      ) : null}
    </div>
  )
}
