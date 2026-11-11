import { cn } from '@/lib/utils'

export type CalendarEvent = { code: string; title: string; origin: 'siu' | 'moodle'; next?: boolean }

const MAX_VISIBLE = 2

/* Un día del calendario de 2 semanas de Hoy (compu). Muestra hasta 2 cosas y el resto como «+N más». */
export function CalendarDay({ day, today, past, events }: { day: number; today?: boolean; past?: boolean; events: CalendarEvent[] }) {
  const hidden = events.length - MAX_VISIBLE
  return (
    <div className={cn('flex min-h-24 min-w-0 flex-col gap-1 rounded-lg bg-background p-1.5', past && 'opacity-50', today && 'bg-accent inset-ring-2 inset-ring-azul-claro')}>
      <span className='flex items-center gap-1.5 text-[0.8125rem] font-extrabold'>
        {day}
        {today && <span className='text-[10px] font-bold tracking-wider text-azul uppercase'>Hoy</span>}
      </span>
      {events.slice(0, MAX_VISIBLE).map((e) => (
        <span
          key={e.code + e.title}
          title={`${e.code} · ${e.title}`}
          className={cn(
            'line-clamp-3 rounded-md px-1.5 py-0.5 text-[11px] leading-snug break-words hyphens-auto',
            e.next ? 'bg-azul text-white' : e.origin === 'siu' ? 'bg-hielo text-azul' : 'bg-origin-moodle-background text-origin-moodle',
          )}
        >
          <b className='block font-extrabold'>{e.code}</b>
          {e.title}
        </span>
      ))}
      {hidden > 0 && <span className='px-1.5 text-[11px] font-bold text-azul'>+{hidden} más</span>}
    </div>
  )
}
