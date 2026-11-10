import Link from 'next/link'
import type { ReactNode } from 'react'
import { diaSemana, fechaCorta, fechaHora, fechaLarga } from '@/lib/format'
import { type Foco, type RadarReciente, type SlotProximo, type Aviso } from '@/lib/inicio'
import { hora, JORNADA_LUGAR, finJornada } from '@/lib/jornadas'
import { teacherNames, type SessionTeacher } from '@/lib/organizacion/store'
import './inicio.css'

export function Seccion({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="in-seccion" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="in-seccion-cabeza">
        <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** «Faltan 18 días» / «Mañana» / «Hoy a las 18:30» / «En vivo ahora». */
export function cuentaRegresiva(foco: Foco): string {
  if (foco.fase === 'vivo') return 'En vivo ahora'
  if (foco.fase === 'terminado') return 'La cursada terminó'
  if (foco.fase === 'hoy') return `Hoy a las ${hora(foco.session.starts_at)}`
  return foco.dias === 1 ? 'Mañana' : `Faltan ${foco.dias} días`
}

const FASE_LABEL: Record<Foco['fase'], string> = { vivo: 'En vivo', hoy: 'Hoy', proxima: 'Próxima jornada', terminado: 'Última jornada' }

/** Cabecera de la jornada en foco: fecha, cuenta regresiva, título, pregunta y docentes. Las acciones y el detalle van como children. */
export function HeroJornada({ foco, question, teachers, actions, children }: {
  foco: Foco
  question: string | null
  teachers: SessionTeacher[] | undefined
  actions: ReactNode
  children?: ReactNode
}) {
  const s = foco.session
  return (
    <article className={`in-hero in-hero-${foco.fase}`}>
      <div className="in-hero-arriba">
        <div className="in-hero-fecha" title={fechaLarga(s.starts_at)}>
          <span>{diaSemana(s.starts_at)}</span>
          <strong>{fechaCorta(s.starts_at)}</strong>
        </div>
        <div className="in-hero-texto">
          <div className="in-hero-estado">
            <span className={`badge ${foco.fase === 'vivo' ? 'badge-vivo' : ''}`}>{FASE_LABEL[foco.fase]}</span>
            <strong className="in-hero-cuenta">{cuentaRegresiva(foco)}</strong>
          </div>
          <div className="kicker">Jornada {s.ordinal}{s.block ? ` · ${s.block}` : ''}</div>
          <h2 className="in-hero-titulo">{s.title}</h2>
          <p className="in-hero-meta">
            <span>{fechaLarga(s.starts_at)}</span> · {hora(s.starts_at)} a {hora(finJornada(s.starts_at))} · {JORNADA_LUGAR}
            {teachers?.length ? <><br />{teachers.length > 1 ? 'Docentes' : 'Docente'}: <strong>{teacherNames(teachers)}</strong></> : null}
          </p>
          {question ? <p className="in-hero-pregunta">{question}</p> : null}
        </div>
      </div>
      {children}
      <div className="in-hero-acciones">{actions}</div>
    </article>
  )
}

export interface CheckItem { done: boolean; label: ReactNode; detail?: ReactNode; href?: string }

export function Checklist({ title, items }: { title: string; items: CheckItem[] }) {
  if (!items.length) return null
  return (
    <div className="in-check">
      <h3>{title}</h3>
      <ul>
        {items.map((it, i) => (
          <li key={i} data-done={it.done ? 'true' : undefined}>
            <span className="in-check-marca" aria-label={it.done ? 'Hecho' : 'Pendiente'}>{it.done ? '✓' : ''}</span>
            <span>
              {it.href ? <Link href={it.href}>{it.label}</Link> : it.label}
              {it.detail ? <span className="in-check-detalle"> · {it.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RadarLista({ items, href }: { items: RadarReciente[]; href: string }) {
  if (!items.length) return null
  return (
    <Seccion title="Radar" action={<Link className="chico" href={href}>Ver todo</Link>}>
      <ul className="in-lista card">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={href}>{r.title}</Link>
            <span className="chico muted">{r.source ? `${r.source} · ` : ''}{r.comments === 0 ? 'sin comentarios' : r.comments === 1 ? '1 comentario' : `${r.comments} comentarios`}</span>
          </li>
        ))}
      </ul>
    </Seccion>
  )
}

export function AvisosLista({ items }: { items: Aviso[] }) {
  if (!items.length) return null
  return (
    <Seccion title="Avisos">
      <ul className="in-lista card">
        {items.map((a) => (
          <li key={a.id}>
            <strong>{a.title}</strong>
            {a.body_md ? <span className="chico in-recorte">{a.body_md}</span> : null}
            <span className="chico muted">{fechaHora(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </Seccion>
  )
}

export function OfficeHoursLista({ slots, href, me }: { slots: SlotProximo[]; href: string; me?: string }) {
  if (!slots.length) return null
  return (
    <Seccion title="Office hours" action={<Link className="chico" href={href}>{me ? 'Reservar' : 'Ver todo'}</Link>}>
      <ul className="in-lista card">
        {slots.map((s) => {
          const mine = me ? s.bookings.some((b) => b.person_id === me) : false
          return (
            <li key={s.id}>
              <span><strong>{fechaHora(s.starts_at)}</strong> · {s.minutes} min · {s.mode}</span>
              <span className="chico muted">
                {s.teacher}
                {me
                  ? mine ? ' · reservaste' : s.bookings.length >= s.capacity ? ' · lleno' : ''
                  : s.bookings.length ? ` · ${s.bookings.map((b) => b.name.split(' ')[0]).join(', ')}` : ' · sin reservas'}
              </span>
            </li>
          )
        })}
      </ul>
    </Seccion>
  )
}

/** «Ana P., Bruno G. y 4 más». */
export function nombres(list: string[], max = 5): string {
  const corto = (n: string) => { const [a, ...r] = n.split(' '); return r.length ? `${a} ${r[r.length - 1][0]}.` : a }
  const first = list.slice(0, max).map(corto)
  const rest = list.length - first.length
  return rest > 0 ? `${first.join(', ')} y ${rest} más` : first.join(', ')
}
