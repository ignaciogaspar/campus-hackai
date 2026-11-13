/* Calendario: la semana con las clases de cada materia como bloques, los
   parciales, los finales, las entregas (de Moodle y las tareas de HackAI) y los cierres de
   inscripción, con filtros para ver solo una cosa o una materia. Sale de Hoy
   en una sola llamada, como la pantalla de inicio: qué es cada fecha, qué ya
   pasó y cuál es la próxima lo decide Hoy. Las clases salen del horario de
   cada comisión, así que al inscribirse a una materia aparecen solas.

   `?semana=AAAA-MM-DD` abre en la semana de ese día: lo usa el mensaje de
   inscripción para mostrar la cursada nueva. Los filtros van en `?ver=` (un
   tipo) y `?materia=` (una sigla), así sobreviven a recargar.

   El docente ve sus clases, los parciales de sus comisiones y las mesas de
   final que integra, con textos para él: sin el filtro de inscripciones y con
   el final como «Mesa de final». */
import { CalendarDays, CalendarPlus } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/shell/page-header'
import { TodayCalendar } from '@/components/today/calendar'
import { calendarFiltersFrom, classSlotsOf, eventsOf } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Role } from '@/lib/core/people'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Calendario · Campus HackAI' }

/** Lo que cambia para el docente: no rinde finales, integra la mesa, y las entregas son las que él carga. */
const TEXTS: Record<Role, { subtitle: string; below: string }> = {
  alumno: {
    subtitle: 'Tus clases, parciales, finales y entregas en un solo lugar.',
    below: 'Las entregas vienen de Moodle y de HackAI: solo aparecen las que el docente cargó con fecha.'
  },
  profesor: {
    subtitle: 'Tus clases, parciales, mesas de final y entregas en un solo lugar.',
    below: 'Las entregas vienen de Moodle y de HackAI: aparecen las tareas que cargaste con fecha.'
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

type CalendarParams = { semana?: string; ver?: string; materia?: string }

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<CalendarParams> }) {
  const session = await requireSession()
  return (
    <>
      <PageHeader
        desktopBell={session.role === 'profesor'}
        title='Calendario'
        subtitle={TEXTS[session.role].subtitle}
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
          <CalendarContent personId={session.personId} role={session.role} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  )
}

async function CalendarContent({
  personId,
  role,
  searchParams
}: {
  personId: string
  role: Role
  searchParams: Promise<CalendarParams>
}) {
  const [params, result] = await Promise.all([searchParams, system().today.today(personId)])
  const { semana } = params
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
          result.value.now,
          role
        )}
        classes={classSlotsOf(result.value.subjects.current)}
        upcoming={result.value.upcoming}
        viewer={role}
        now={result.value.now}
        initialDay={initialDay}
        filters
        initialFilters={calendarFiltersFrom(params)}
        below={<p className='text-[0.8125rem] text-muted-foreground'>{TEXTS[role].below}</p>}
        aside={
          <div className='flex flex-col gap-3'>
            {/* Entre el mes y las próximas fechas, a la vista sin bajar hasta el final de la semana. */}
            <a
              href='/calendario/exportar'
              download
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 w-full')}
            >
              <CalendarPlus aria-hidden='true' data-icon='inline-start' />
              Agregar a mi calendario
            </a>
          </div>
        }
      />
    </>
  )
}
