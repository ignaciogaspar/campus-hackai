/* Hoy del alumno, como una ficha con agenda: arriba, una tarjeta azul con quién
   es y unos números, y al lado lo próximo (parcial y entrega); abajo, la semana
   con las horas, sus clases y sus fechas (components/today/calendar.tsx). A la derecha, el mes chico,
   tus materias y las inscripciones que cierran pronto. Todo sale de Hoy en una
   sola llamada. Si una parte no se pudo leer, un aviso dice por qué y el resto
   se ve igual; si algo es lo último que se leyó, un aviso dice desde cuándo.
   Las novedades sin leer van a la campana del encabezado, no acá.

   Todo lleva a algún lado: una inscripción, a su oferta de comisiones o de
   mesas; el próximo parcial o final, al espacio de su materia (o a su mesa, si
   rinde libre). */
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { longDay, shortDate, timeOf } from '@/components/dates'
import { creditsText } from '@/components/enrollment/format'
import { offerHref } from '@/components/enrollment/offer-href'
import { activeProgram } from '@/components/session/person-text'
import { Avatar } from '@/components/shell/avatar'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { dateHref } from '@/components/today/agenda'
import { TodayCalendar } from '@/components/today/calendar'
import { classSlotsOf, eventsOf, mondayOf, weekOf } from '@/components/today/calendar-layout'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice } from '@/components/ui/states'
import type { Person } from '@/lib/core/people'
import type { OpenEnrollment } from '@/lib/core/studies'
import type { NextExam, TodayView } from '@/lib/core/today'
import { dayKey } from '@/lib/dates'

const UPCOMING_DOWN = 'No pudimos traer tus parciales y finales porque el SIU no responde. Probá de nuevo en un rato.'
const MOODLE_NOTE =
  'Las entregas vienen de Moodle y son un complemento: solo aparecen las que el docente cargó con fecha.'
const ASSIGNMENTS_DOWN =
  'Faltan las entregas de Moodle porque el Campus Virtual no responde. Los parciales y finales están todos.'
const ENROLLMENTS_DOWN =
  'No pudimos traer las inscripciones abiertas porque el SIU no responde. Probá de nuevo en un rato.'

const days = (n: number) => (n === 0 ? 'Hoy' : `${n} ${n === 1 ? 'día' : 'días'}`)

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <dt className='text-[0.75rem] text-white/75'>{label}</dt>
      <dd className='text-[0.9375rem] font-semibold tabular-nums'>{value}</dd>
    </div>
  )
}

/* La tarjeta azul: quién es, qué cursa y cuánto tiene por delante. */
function StudentCard({ person, view }: { person: Person; view: TodayView }) {
  const week = weekOf(mondayOf(dayKey(view.now)))
  const thisWeek = view.upcoming.filter((i) => !i.past && week.includes(dayKey(i.date))).length
  return (
    <section aria-label='Tu resumen' className='flex flex-col gap-4 rounded-2xl bg-blue p-5 text-white'>
      <div className='flex items-center gap-3'>
        <Avatar person={person} className='size-12 ring-2 ring-white/25' />
        <div className='min-w-0'>
          <p className='truncate text-lg leading-tight font-semibold'>{person.name}</p>
          <p className='truncate text-[0.8125rem] text-white/80'>{activeProgram(person)?.name ?? person.school.name}</p>
        </div>
      </div>
      <dl className='grid grid-cols-3 gap-3'>
        <Stat label='Materias' value={view.subjects.current.length} />
        <Stat label='Esta semana' value={thisWeek} />
        <Stat label='Próximo' value={view.next ? days(view.next.daysLeft) : '—'} />
      </dl>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      <dt className='text-[0.75rem] text-muted-foreground'>{label}</dt>
      <dd className='text-[0.875rem] font-semibold text-ink'>{children}</dd>
    </div>
  )
}

/* El próximo parcial o final, con su turno si es un final. Lleva al espacio de su materia, o a su mesa si rinde libre. */
function NextName({ next }: { next: NextExam }) {
  const text = [next.name, next.subjectName, next.examPeriod].filter(Boolean).join(' · ')
  const href = dateHref(next, 'alumno')
  if (!href) return text
  return (
    <Link href={href} className='text-blue underline-offset-2 hover:underline focus-ring'>
      {text}
    </Link>
  )
}

/* Lo próximo, como los datos de una ficha: el parcial o final y la entrega. */
function NextUp({ view }: { view: TodayView }) {
  const next = view.next
  const delivery = view.upcoming.find((i) => i.kind === 'entrega' && !i.past)
  return (
    <section aria-label='Lo próximo' className='rounded-2xl border border-border bg-card p-5'>
      <dl className='grid gap-x-6 gap-y-4 sm:grid-cols-3'>
        <Field label={next?.kind === 'final' ? 'Próximo final' : 'Próximo parcial'}>
          {next ? <NextName next={next} /> : 'No tenés'}
        </Field>
        <Field label='Cuándo'>
          {next ? [longDay(next.date), timeOf(next.date), next.location].filter(Boolean).join(' · ') : '—'}
        </Field>
        <Field label='Faltan'>{next ? days(next.daysLeft) : '—'}</Field>
        <Field label='Próxima entrega'>{delivery ? `${delivery.name} · ${delivery.subjectName}` : 'No tenés'}</Field>
        <Field label='Vence'>{delivery ? `${shortDate(delivery.date)} · ${timeOf(delivery.date)}` : '—'}</Field>
        <Field label='Viene de'>{delivery ? 'Moodle' : '—'}</Field>
      </dl>
    </section>
  )
}

/* Tus materias: ícono, nombre y comisión, cada una lleva a su espacio. */
function SubjectsCard({ view }: { view: TodayView }) {
  const subjects = view.subjects.current
  return (
    <section aria-labelledby='tus-materias' className='rounded-2xl border border-border bg-card p-4'>
      <h2 id='tus-materias' className='pb-2 text-[0.9375rem] font-semibold text-ink'>
        Tus materias
      </h2>
      {subjects.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>No estás cursando materias este cuatrimestre.</p>
      ) : (
        <ul className='flex flex-col'>
          {subjects.map((s) => (
            <li key={s.subjectId}>
              <Link
                href={`/materias/${s.subjectId}`}
                className='-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink/4 focus-ring'
              >
                <SubjectIcon name={s.name} size='sm' tone='soft' />
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate text-[0.8125rem] font-semibold text-ink'>{s.name}</span>
                  <span className='truncate text-[0.75rem] text-muted-foreground'>{s.sectionName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const ENROLLMENT: Record<OpenEnrollment['kind'], string> = {
  cursada: 'Cursada de',
  actividad: 'Actividad:',
  examen: 'Final de'
}

/** Debajo del nombre: cuándo cierra y, si hace falta, los créditos o que falta regularizar. */
function enrollmentNote(e: OpenEnrollment): string | null {
  if (e.credits !== null) return creditsText(e.credits)
  return e.needsRegularity ? 'antes regularizá la cursada' : null
}

function EnrollmentItems({ view }: { view: TodayView }) {
  const items = view.openEnrollments.slice(0, 3)
  if (view.unavailable.includes('openEnrollments'))
    return <p className='text-[0.8125rem] text-ink/70'>{ENROLLMENTS_DOWN}</p>
  if (items.length === 0) return <p className='text-[0.8125rem] text-ink/70'>No tenés inscripciones abiertas.</p>
  return (
    <ul className='flex flex-col gap-1'>
      {items.map((e) => (
        <li key={`${e.kind}-${e.subjectId}`}>
          <Link
            href={offerHref(e.subjectId, e.kind)}
            className='-mx-2 block rounded-lg px-2 py-1 text-[0.8125rem] text-ink transition-colors hover:bg-white/60 focus-ring'
          >
            <span className='font-semibold'>
              {ENROLLMENT[e.kind]} {e.subjectName}
            </span>
            <span className='block text-[0.75rem] text-ink/60'>
              Cierra el <time dateTime={e.closesAt}>{shortDate(e.closesAt)}</time>
              {enrollmentNote(e) && ` · ${enrollmentNote(e)}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* Las inscripciones que cierran pronto, en una tarjeta celeste con el acceso a Inscripciones. */
function EnrollmentsCard({ view }: { view: TodayView }) {
  return (
    <section aria-labelledby='inscripciones' className='flex flex-col gap-3 rounded-2xl bg-accent p-4'>
      <h2 id='inscripciones' className='text-[0.9375rem] leading-snug font-semibold text-blue'>
        Inscripciones que cierran pronto
      </h2>
      <EnrollmentItems view={view} />
      <Link
        href='/inscripciones'
        className='inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-blue px-3 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-blue-deep focus-ring'
      >
        Ir a inscripciones
        <ArrowRight aria-hidden='true' className='size-4' strokeWidth={2} />
      </Link>
    </section>
  )
}

export function TodayScreen({ view, person }: { view: TodayView; person: Person | null }) {
  const siuDown = view.unavailable.includes('upcoming')
  const moodleDown = !siuDown && (view.unavailable.includes('subjects') || view.unavailable.includes('assignments'))
  const events = eventsOf(view.upcoming, view.openEnrollments, view.next?.id ?? null, view.now)

  return (
    <div className='flex flex-col gap-4'>
      {view.staleSince && <StaleBanner since={view.staleSince} now={view.now} />}
      {siuDown && <ErrorNotice>{UPCOMING_DOWN}</ErrorNotice>}
      <TodayCalendar
        events={events}
        classes={classSlotsOf(view.subjects.current)}
        now={view.now}
        top={
          <div className='grid gap-5 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]'>
            {person && <StudentCard person={person} view={view} />}
            <NextUp view={view} />
          </div>
        }
        aside={
          <>
            <SubjectsCard view={view} />
            <EnrollmentsCard view={view} />
          </>
        }
      />
      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1'>
        <p className='text-[0.8125rem] text-muted-foreground'>{moodleDown ? ASSIGNMENTS_DOWN : MOODLE_NOTE}</p>
        <a
          href='/calendario/exportar'
          download
          className='inline-flex min-h-11 items-center text-[0.8125rem] font-bold text-blue underline focus-ring'
        >
          Agregar a mi calendario
        </a>
      </div>
    </div>
  )
}
