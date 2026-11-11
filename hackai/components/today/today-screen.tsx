/* Hoy del alumno: qué tiene que hacer y cuándo, armado con lo que da Hoy en una
   sola llamada. Si una parte no se pudo leer, esa parte dice por qué y el resto
   se ve igual; si algo es lo último que se leyó, un aviso dice desde cuándo.
   Las novedades sin leer van a la campana del encabezado, no acá.

   En el celular es una columna: el próximo parcial, las próximas 2 semanas, las
   inscripciones y el acceso a Mis materias. En compu, a la izquierda el
   calendario de esta semana y la próxima, y a la derecha lo demás. */
import type { ReactNode } from 'react'
import { SubjectsShortcut } from '@/components/subjects/subjects-shortcut'
import { agendaOf, calendarOf } from '@/components/today/agenda'
import { OpenEnrollmentList } from '@/components/today/open-enrollments'
import { TwoWeekCalendar, UpcomingAgenda } from '@/components/today/upcoming'
import { CalendarLegend } from '@/components/ui/calendar-day'
import { NextExamCard } from '@/components/ui/next-exam-card'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice } from '@/components/ui/states'
import type { NextExam, TodayPart, TodayView } from '@/lib/core/today'
import { longDay, timeOf } from '@/lib/dates'
import { cn } from '@/lib/utils'

const UPCOMING_DOWN =
  'No pudimos traer tus parciales, finales y entregas porque el SIU o el Campus Virtual no responden. Probá de nuevo en un rato.'
const ENROLLMENTS_DOWN =
  'No pudimos traer las inscripciones abiertas porque el SIU no responde. Probá de nuevo en un rato.'

function Section({
  id,
  title,
  aside,
  className,
  children
}: {
  id: string
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 id={id} className='text-lg font-extrabold'>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function NextExamBlock({ next }: { next: NextExam }) {
  return (
    <NextExamCard
      label={next.kind === 'final' ? 'Próximo final' : 'Próximo parcial'}
      title={next.name}
      subject={next.subjectName}
      when={`${longDay(next.date)} · ${timeOf(next.date)}`}
      daysLeft={next.daysLeft}
    />
  )
}

export function TodayScreen({ view }: { view: TodayView }) {
  const missing = (part: TodayPart) => view.unavailable.includes(part)
  const agenda = agendaOf(view.upcoming, view.now, view.next)
  const calendar = calendarOf(view.upcoming, view.now, view.next)
  const moodleNote = (
    <p className='text-[0.8125rem] text-muted-foreground'>
      Las entregas vienen de Moodle y son un complemento: solo aparecen las que el docente cargó con fecha.
    </p>
  )

  return (
    <div className='flex flex-col gap-6'>
      {view.staleSince && <StaleBanner since={view.staleSince} />}

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18.75rem,1fr)] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start'>
        <Section
          id='calendario'
          title='Esta semana y la próxima'
          aside={<CalendarLegend />}
          className='hidden lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:flex'
        >
          {missing('upcoming') ? <ErrorNotice>{UPCOMING_DOWN}</ErrorNotice> : <TwoWeekCalendar calendar={calendar} />}
          {!missing('upcoming') && moodleNote}
        </Section>

        {view.next && (
          <div className='lg:col-start-2'>
            <NextExamBlock next={view.next} />
          </div>
        )}

        <Section id='proximas' title='Próximas 2 semanas' className='lg:hidden'>
          {missing('upcoming') ? <ErrorNotice>{UPCOMING_DOWN}</ErrorNotice> : <UpcomingAgenda agenda={agenda} />}
          {!missing('upcoming') && moodleNote}
        </Section>

        <Section id='inscripciones' title='Inscripciones que cierran pronto' className='lg:col-start-2'>
          {missing('openEnrollments') ? (
            <ErrorNotice>{ENROLLMENTS_DOWN}</ErrorNotice>
          ) : (
            <OpenEnrollmentList items={view.openEnrollments} />
          )}
        </Section>

        <div className='lg:col-start-2'>
          <SubjectsShortcut />
        </div>
      </div>
    </div>
  )
}
