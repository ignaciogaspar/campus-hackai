import { ORIGINS, type Origin } from '@/components/ui/origin-badge'
import { cn } from '@/lib/utils'

export type CalendarEvent = { code: string; title: string; origin: Extract<Origin, 'siu' | 'moodle'>; next?: boolean }

const MAX_VISIBLE = 2

/* Un día del calendario de 2 semanas de Hoy (compu). Muestra hasta 2 cosas y el resto como «+N más». */
export function CalendarDay({
  day,
  today,
  past,
  events
}: {
  day: number
  today?: boolean
  past?: boolean
  events: CalendarEvent[]
}) {
  const hidden = events.length - MAX_VISIBLE
  return (
    <div
      className={cn(
        'flex min-h-24 min-w-0 flex-col gap-1 rounded-lg bg-background p-1.5',
        today && 'bg-accent inset-ring-2 inset-ring-blue-light'
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-[0.8125rem] font-extrabold',
          past && 'font-semibold text-muted-foreground'
        )}
      >
        {day}
        {today && <span className='text-[10px] font-bold tracking-wider text-blue uppercase'>Hoy</span>}
      </span>
      {events.slice(0, MAX_VISIBLE).map((e) => (
        <span
          key={e.code + e.title}
          title={`${e.code} · ${e.title} · ${ORIGINS[e.origin].label}`}
          className={cn(
            'line-clamp-3 rounded-md px-1.5 py-0.5 text-[11px] leading-snug break-words hyphens-auto',
            e.next ? 'bg-blue text-white' : ORIGINS[e.origin].className
          )}
        >
          <b className='block font-extrabold'>{e.code}</b>
          {e.title}
          <span className='sr-only'>
            , {e.next ? 'próximo, ' : ''}
            {ORIGINS[e.origin].label}
          </span>
        </span>
      ))}
      {hidden > 0 && <span className='px-1.5 text-[11px] font-bold text-blue'>+{hidden} más</span>}
    </div>
  )
}

/* Qué quiere decir cada color del calendario. */
export function CalendarLegend() {
  return (
    <p className='flex flex-wrap gap-1.5 text-[11px]'>
      <span className={cn('rounded-md px-1.5 py-0.5', ORIGINS.siu.className)}>Parcial o final · SIU</span>
      <span className={cn('rounded-md px-1.5 py-0.5', ORIGINS.moodle.className)}>Entrega · Moodle</span>
      <span className='rounded-md bg-blue px-1.5 py-0.5 text-white'>Próximo parcial</span>
    </p>
  )
}
