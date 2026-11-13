/* Planning: las clases de todas las materias con su aula, día por día y aula por aula,
   con filtros. Lo carga secretaría (/cargar-clases). Sin reglas de negocio:
   qué clase hay cada día y qué cambió lo decide Planning; las materias de quien
   mira salen de Cursada, para «Solo mis materias». */
import { CalendarRange, Upload } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PlanningCalendar } from '@/components/planning/planning-calendar'
import { PageHeader } from '@/components/shell/page-header'
import { mondayOf } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { addDays, dayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Planning · Campus HackAI' }

/** Cuántas semanas antes y después de esta se pueden recorrer sin volver a cargar. */
const WEEKS_BACK = 6
const WEEKS_AHEAD = 20

export default async function PlanningPage() {
  const session = await requireSession()
  const { planning, studies, people, now } = system()
  const monday = mondayOf(dayKey(now()))
  const [classes, subjects, person] = await Promise.all([
    planning.classes(addDays(monday, -7 * WEEKS_BACK), addDays(monday, 7 * WEEKS_AHEAD - 1)),
    session.role === 'secretaria' ? null : studies.subjectsOf(session.personId),
    people.get(session.personId)
  ])
  const mine = subjects?.ok ? subjects.value.data.current.map((s) => s.name) : []
  const school = person.ok ? person.value.school.id.toUpperCase() : null

  return (
    <>
      <PageHeader
        title='Planning'
        subtitle='Las clases de todas las materias, con su aula y su horario.'
        art='hoy'
        hideBackOnDesktop
        actions={
          session.role === 'secretaria' ? (
            <Link href='/cargar-clases' className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')}>
              <Upload aria-hidden='true' data-icon='inline-start' />
              Cargar clases
            </Link>
          ) : undefined
        }
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!classes.ok ? (
          <ErrorNotice>No pudimos traer el planning porque la base no responde. Probá de nuevo en un rato.</ErrorNotice>
        ) : classes.value.length === 0 ? (
          <EmptyState icon={CalendarRange} title='Todavía no hay clases cargadas'>
            {session.role === 'secretaria'
              ? 'Cargá la planilla de clases del cuatrimestre desde «Cargar clases».'
              : 'Secretaría todavía no cargó las aulas de este cuatrimestre.'}
          </EmptyState>
        ) : (
          <PlanningCalendar classes={classes.value} now={now()} mine={mine} defaultSchool={school} />
        )}
      </main>
    </>
  )
}
