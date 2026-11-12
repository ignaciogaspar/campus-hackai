/* Hoy del alumno: qué tiene que hacer y cuándo, armado con lo que da Hoy en una
   sola llamada. Si una parte no se pudo leer, esa parte dice por qué y el resto
   se ve igual; si algo es lo último que se leyó, un aviso dice desde cuándo.
   Las novedades sin leer van a la campana del encabezado, no acá.

   En el celular es una columna: el próximo parcial, las próximas 2 semanas, las
   inscripciones y el acceso a Mis materias. En compu, a la izquierda el
   calendario de esta semana y la próxima, y a la derecha lo demás.

   Todo lleva a algún lado: una inscripción, a su oferta de comisiones o de
   mesas; un parcial, un final o una entrega, al espacio de su materia. */
import type { ReactNode } from 'react'
import { longDay, timeOf } from '@/components/dates'
import { spaceHref } from '@/components/spaces/format'
import { SubjectsShortcut } from '@/components/subjects/subjects-shortcut'
import { agendaOf, calendarOf } from '@/components/today/agenda'
import { OpenEnrollmentList } from '@/components/today/open-enrollments'
import { TwoWeekCalendar, UpcomingAgenda } from '@/components/today/upcoming'
import { CalendarLegend } from '@/components/ui/calendar-day'
import { NextExamCard } from '@/components/ui/next-exam-card'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice } from '@/components/ui/states'
import type { NextExam, TodayView } from '@/lib/core/today'
import { cn } from '@/lib/utils'

const UPCOMING_DOWN = 'No pudimos traer tus parciales y finales porque el SIU no responde. Probá de nuevo en un rato.'
const MOODLE_NOTE =
  'Las entregas vienen de Moodle y son un complemento: solo aparecen las que el docente cargó con fecha.'
const ASSIGNMENTS_DOWN =
  'Faltan las entregas de Moodle porque el Campus Virtual no responde. Los parciales y finales están todos.'
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

/** Las fechas, en lista o en calendario: si el SIU no respondió, su error; si faltan solo las entregas de Moodle, se avisa en la nota. */
function Dates({ view, children }: { view: TodayView; children: ReactNode }) {
  const siuDown = view.unavailable.includes('upcoming')
  if (siuDown && view.upcoming.length === 0) return <ErrorNotice>{UPCOMING_DOWN}</ErrorNotice>
  const moodleDown = !siuDown && view.unavailable.includes('subjects')
  return (
    <>
      {siuDown && <ErrorNotice>{UPCOMING_DOWN}</ErrorNotice>}
      {children}
      <p className='text-[0.8125rem] text-muted-foreground'>{moodleDown ? ASSIGNMENTS_DOWN : MOODLE_NOTE}</p>
    </>
  )
}

const nextLabel = (next: NextExam) => (next.kind === 'final' ? 'Próximo final' : 'Próximo parcial')

/** El próximo parcial o final: lleva al espacio de su materia y, si es un final, dice su turno y dónde se rinde. */
function NextExamBlock({ next }: { next: NextExam }) {
  return (
    <NextExamCard
      label={nextLabel(next)}
      title={next.name}
      subject={next.subjectName}
      detail={next.examPeriod ?? undefined}
      when={[longDay(next.date), timeOf(next.date), next.location].filter(Boolean).join(' · ')}
      daysLeft={next.daysLeft}
      href={spaceHref(next.subjectId)}
    />
  )
}

export function TodayScreen({ view }: { view: TodayView }) {
  const agenda = agendaOf(view.upcoming, view.now, view.next)
  const calendar = calendarOf(view.upcoming, view.now, view.next)

  return (
    <div className='flex flex-col gap-6'>
      {view.staleSince && <StaleBanner since={view.staleSince} />}

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18.75rem,1fr)] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start'>
        <Section
          id='calendario'
          title='Esta semana y la próxima'
          aside={<CalendarLegend next={view.next ? nextLabel(view.next) : undefined} />}
          className='hidden lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:flex'
        >
          <Dates view={view}>
            <TwoWeekCalendar calendar={calendar} />
          </Dates>
        </Section>

        {view.next && (
          <div className='lg:col-start-2'>
            <NextExamBlock next={view.next} />
          </div>
        )}

        <Section id='proximas' title='Próximas 2 semanas' className='lg:hidden'>
          <Dates view={view}>
            <UpcomingAgenda agenda={agenda} />
          </Dates>
        </Section>

        <Section id='inscripciones' title='Inscripciones que cierran pronto' className='lg:col-start-2'>
          {view.unavailable.includes('openEnrollments') ? (
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
