/* Calendario: la semana con las clases de cada materia como bloques, los
   parciales, los finales, las entregas (de Moodle y las tareas de HackAI) y los cierres de
   inscripción, con filtros para ver solo una cosa o una materia. Sale de Hoy
   en una sola llamada, como la pantalla de inicio: qué es cada fecha, qué ya
   pasó y cuál es la próxima lo decide Hoy. Las clases salen del horario de
   cada comisión, así que al inscribirse a una materia aparecen solas.

   `?semana=AAAA-MM-DD` abre en la semana de ese día: lo usa el mensaje de
   inscripción para mostrar la cursada nueva. */
import { CalendarDays, CalendarPlus } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { dueTime } from '@/components/dates'
import { PageHeader } from '@/components/shell/page-header'
import { TodayCalendar } from '@/components/today/calendar'
import { classSlotsOf, eventsOf } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { UpcomingItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Calendario · Campus HackAI' }

const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'TP',
  final: 'Final',
  entrega: 'Entrega'
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/* Las próximas fechas, en lista: lo mismo que el calendario, para leerlo de un vistazo. */
function NextDates({ items }: { items: UpcomingItem[] }) {
  const next = items.filter((i) => !i.past).slice(0, 6)
  return (
    <section aria-labelledby='proximas' className='rounded-2xl border border-border bg-card p-4'>
      <h2 id='proximas' className='pb-2 text-[0.9375rem] font-semibold text-ink'>
        Próximas fechas
      </h2>
      {next.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>No tenés parciales, finales ni entregas por delante.</p>
      ) : (
        <ul className='flex flex-col divide-y divide-border'>
          {next.map((i) => (
            <li key={i.id} className='flex flex-col gap-0.5 py-2'>
              <span className='text-[0.8125rem] font-semibold text-ink'>
                {KIND[i.kind]} · {i.subjectName}
              </span>
              <span className='text-[0.75rem] text-muted-foreground'>
                {i.name} · <time dateTime={i.date}>{dueTime(i.date)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const session = await requireSession()
  return (
    <>
      <PageHeader
        title='Calendario'
        subtitle='Tus clases, parciales, finales y entregas en un solo lugar.'
        art='hoy'
        hideBackOnDesktop
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <Suspense
          fallback={
            <div role='status' className='min-h-[32rem] text-sm text-muted-foreground'>
              Cargando calendario…
            </div>
          }
        >
          <CalendarContent personId={session.personId} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  )
}

async function CalendarContent({
  personId,
  searchParams
}: {
  personId: string
  searchParams: Promise<{ semana?: string }>
}) {
  const [{ semana }, result] = await Promise.all([searchParams, system().today.today(personId)])
  const initialDay = semana && DAY.test(semana) ? semana : undefined

  return !result.ok ? (
    <EmptyState icon={CalendarDays} title='No encontramos tus datos'>
      No encontramos tus datos en el SIU. Salí y volvé a entrar.
    </EmptyState>
  ) : (
    <>
      {result.value.staleSince && <StaleBanner since={result.value.staleSince} now={result.value.now} />}
      {result.value.unavailable.includes('upcoming') && (
        <ErrorNotice>
          No pudimos traer tus parciales y finales porque el SIU no responde. Probá de nuevo en un rato.
        </ErrorNotice>
      )}
      {result.value.unavailable.includes('assignments') && (
        <StaleNotice>Faltan las entregas de Moodle porque el Campus Virtual no responde.</StaleNotice>
      )}
      {result.value.unavailable.includes('coursework') && (
        <StaleNotice>Faltan las tareas de HackAI porque no pudimos leerlas. Probá de nuevo en un rato.</StaleNotice>
      )}
      <TodayCalendar
        events={eventsOf(
          result.value.upcoming,
          result.value.openEnrollments,
          result.value.next?.id ?? null,
          result.value.now
        )}
        classes={classSlotsOf(result.value.subjects.current)}
        now={result.value.now}
        initialDay={initialDay}
        filters
        below={
          <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
            <p className='min-w-0 flex-1 basis-64 text-[0.8125rem] text-muted-foreground'>
              Las entregas vienen de Moodle y de HackAI: solo aparecen las que el docente cargó con fecha.
            </p>
            <a
              href='/calendario/exportar'
              download
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 flex-none')}
            >
              <CalendarPlus aria-hidden='true' data-icon='inline-start' />
              Agregar a mi calendario
            </a>
          </div>
        }
        aside={<NextDates items={result.value.upcoming} />}
      />
    </>
  )
}
