/* Una fecha de Hoy como fila de lista: parciales y finales del SIU y, como
   complemento, las entregas de Moodle. La usan el Hoy del docente, para sus
   parciales y mesas, e Inscripciones, para el turno y el lugar de un final.
   (El Hoy del alumno las muestra en su calendario: components/today/calendar.tsx.)
   Cada fecha lleva al espacio de su materia, y cada final dice su turno y, si
   el SIU lo da, dónde se rinde. Solo muestra lo que da Hoy. */
import { dayParts, longDay, timeOf } from '@/components/dates'
import { dateHref } from '@/components/today/agenda'
import { ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import type { Role } from '@/lib/core/people'
import type { UpcomingItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'Trabajo práctico',
  final: 'Final',
  entrega: 'Entrega'
}

/** El fondo del bloque de la fecha, según de dónde viene. */
const DATE_BLOCK: Record<UpcomingItem['source'], string> = {
  siu: 'bg-background',
  moodle: 'bg-origin-moodle-background',
  hackai: 'bg-origin-hackai-background'
}

function DateBlock({ item }: { item: UpcomingItem }) {
  const { weekday, day, month } = dayParts(item.date)
  return (
    <span
      aria-hidden='true'
      className={cn(
        'flex w-12 flex-none flex-col items-center rounded-xl py-1 leading-tight',
        item.past && 'border border-dashed border-gray-light',
        !item.past && DATE_BLOCK[item.source]
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
