/* Las fechas de Hoy: parciales y finales del SIU y, como complemento, las
   entregas de Moodle. En el celular, una lista de las próximas 2 semanas; en
   compu, el calendario de esta semana y la próxima. Cada fecha lleva al
   espacio de su materia, y cada final dice su turno y, si el SIU lo da, dónde
   se rinde. Solo muestra lo que da Hoy. */
import { CalendarCheck, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { dayParts, longDay, shortDate, shortDay, timeOf } from '@/components/dates'
import { type Agenda, type Calendar, dateHref } from '@/components/today/agenda'
import { CalendarDay } from '@/components/ui/calendar-day'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { EmptyState } from '@/components/ui/states'
import type { Role } from '@/lib/core/people'
import type { UpcomingItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

/** Cuántas fechas se ven en el celular antes de «Ver más». */
const VISIBLE = 4

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'Trabajo práctico',
  final: 'Final',
  entrega: 'Entrega'
}

function DateBlock({ item }: { item: UpcomingItem }) {
  const { weekday, day, month } = dayParts(item.date)
  return (
    <span
      aria-hidden='true'
      className={cn(
        'flex w-12 flex-none flex-col items-center rounded-xl py-1 leading-tight',
        item.past && 'border border-dashed border-gray-light',
        !item.past && (item.source === 'moodle' ? 'bg-origin-moodle-background' : 'bg-background')
      )}
    >
      <span className='text-[10px] font-bold text-muted-foreground uppercase'>{weekday}</span>
      <span className='text-xl font-extrabold'>{day}</span>
      <span className='text-[10px] text-muted-foreground uppercase'>{month}</span>
    </span>
  )
}

/** El turno de examen y el lugar de un final, si los hay: «Turno Diciembre 2026 · Campus Pilar, aula 12». */
export function examDetail(item: UpcomingItem): string {
  return [item.examPeriod, item.location].filter(Boolean).join(' · ')
}

/** Qué es y a qué hora, con el lugar si el SIU lo da: «Final · 09:00 · Campus Pilar, aula 12». */
function whatAndWhen(item: UpcomingItem): string {
  const time = timeOf(item.date)
  if (item.kind === 'entrega') return `Entrega · vence ${time}`
  return [KIND[item.kind], time, item.location].filter(Boolean).join(' · ')
}

/** Una fecha: día, qué es, de qué materia, a qué hora, dónde y de dónde viene. Lleva a donde dice
    `dateHref`. Las pasadas, atenuadas y con «ya pasó». */
export function UpcomingRow({ item, viewer = 'alumno' }: { item: UpcomingItem; viewer?: Role }) {
  return (
    <ListItem
      href={dateHref(item, viewer)}
      className={cn('items-center', item.past && 'text-muted-foreground')}
      start={<DateBlock item={item} />}
      title={
        <>
          {item.name}
          {item.past && <span className='font-medium'> · ya pasó</span>}
        </>
      }
      description={item.examPeriod ? `${item.subjectName} · ${item.examPeriod}` : item.subjectName}
      meta={
        <span>
          <span className='sr-only'>{longDay(item.date)}, </span>
          {whatAndWhen(item)}
        </span>
      }
      end={<OriginBadge origin={item.source} />}
    />
  )
}

function Fold({ summary, open, children }: { summary: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className='group border-t border-border first:border-t-0'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-[0.8125rem] font-semibold text-muted-foreground focus-ring-inset [&::-webkit-details-marker]:hidden'>
        <ChevronRight
          aria-hidden='true'
          className='size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none'
        />
        {summary}
      </summary>
      <List className='border-t border-border'>{children}</List>
    </details>
  )
}

const rows = (items: UpcomingItem[]) => items.map((item) => <UpcomingRow key={item.id} item={item} />)

/** Resumen de lo que queda plegado: «Más adelante (2) · Ya pasaron (3)». */
function foldSummary(parts: [string, number][]): string {
  return parts
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} (${n})`)
    .join(' · ')
}

/** Vacío de las próximas 2 semanas. Si el próximo parcial cae en ellas, está arriba: no se dice «no tenés nada». */
function NothingSoon({ agenda }: { agenda: Agenda }) {
  const until = shortDay(agenda.soonUntil)
  const after = agenda.later[0]
  let detail = 'Cuando el SIU o Moodle tengan fechas nuevas, las vas a ver acá.'
  if (after) detail = `Lo próximo es ${after.name.toLowerCase()} de ${after.subjectName}, el ${shortDate(after.date)}.`
  else if (agenda.nextIsSoon) detail = 'Fuera de lo de arriba, no tenés fechas en estas 2 semanas.'
  return (
    <EmptyState
      icon={CalendarCheck}
      title={agenda.nextIsSoon ? `Nada más hasta el ${until}` : `No tenés parciales ni entregas hasta el ${until}`}
    >
      {detail}
    </EmptyState>
  )
}

/** Celular: las próximas 2 semanas (4 a la vista), y plegado lo que viene después y lo que ya pasó. */
export function UpcomingAgenda({ agenda }: { agenda: Agenda }) {
  const { soon, later, past } = agenda
  const hidden = soon.slice(VISIBLE)
  const folded = foldSummary([
    ['Más adelante', later.length],
    ['Ya pasaron', past.length]
  ])
  return (
    <>
      {soon.length === 0 && <NothingSoon agenda={agenda} />}
      {soon.length > 0 || folded ? (
        <Card>
          {soon.length > 0 && <List>{rows(soon.slice(0, VISIBLE))}</List>}
          {hidden.length > 0 && <Fold summary={`Ver ${hidden.length} más en estas 2 semanas`}>{rows(hidden)}</Fold>}
          {folded && <Fold summary={folded}>{rows([...later, ...past])}</Fold>}
        </Card>
      ) : null}
    </>
  )
}

/** Compu: esta semana y la próxima, con 2 cosas por día y el resto como «+N más»; debajo, lo de después y lo que ya pasó. */
export function TwoWeekCalendar({ calendar }: { calendar: Calendar }) {
  const { days, after, before } = calendar
  const folded = foldSummary([
    ['Después', after.length],
    ['Ya pasaron', before.length]
  ])
  return (
    <>
      <Card className='p-3'>
        <div aria-hidden='true' className='grid grid-cols-7 gap-1.5 pb-1.5'>
          {WEEKDAYS.map((d) => (
            <span key={d} className='px-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase'>
              {d}
            </span>
          ))}
        </div>
        <div className='grid grid-cols-7 gap-1.5'>
          {days.map((d) => (
            <CalendarDay key={d.day} day={d.number} today={d.today} past={d.past} events={d.events} />
          ))}
        </div>
      </Card>
      {folded && (
        <Card>
          <Fold summary={folded} open>
            {rows([...after, ...before])}
          </Fold>
        </Card>
      )}
    </>
  )
}
