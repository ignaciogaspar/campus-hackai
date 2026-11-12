import Link from 'next/link'
import { ORIGINS, type Origin } from '@/components/ui/origin-badge'
import { cn } from '@/lib/utils'

export type CalendarEvent = {
  id?: string
  code: string
  title: string
  origin: Extract<Origin, 'siu' | 'moodle'>
  /** A dónde lleva: el espacio de la materia. Sin enlace, se muestra como texto. */
  href?: string
  /** Dónde se rinde, si el SIU lo da. */
  location?: string | null
  next?: boolean
  /** Ya pasó: va atenuado, con borde punteado y «ya pasó» para el lector de pantalla. */
  past?: boolean
}

function eventStyle(e: CalendarEvent): string {
  if (e.past) return 'border border-dashed border-gray-light text-muted-foreground'
  return e.next ? 'bg-blue text-white' : ORIGINS[e.origin].className
}

const MAX_VISIBLE = 2

function Event({ event: e }: { event: CalendarEvent }) {
  const className = cn(
    'line-clamp-3 rounded-md px-1.5 py-0.5 text-[11px] leading-snug break-words hyphens-auto',
    eventStyle(e),
    e.href && 'focus-ring hover:brightness-95'
  )
  const where = e.location ? ` · ${e.location}` : ''
  const content = (
    <>
      <b className='block font-extrabold'>{e.code}</b>
      {e.title}
      <span className='sr-only'>
        , {e.past ? 'ya pasó, ' : ''}
        {e.next ? 'próximo, ' : ''}
        {e.location ? `${e.location}, ` : ''}
        {ORIGINS[e.origin].label}
      </span>
    </>
  )
  const title = `${e.code} · ${e.title}${where}${e.past ? ' · ya pasó' : ''} · ${ORIGINS[e.origin].label}`
  return e.href ? (
    <Link href={e.href} title={title} className={className}>
      {content}
    </Link>
  ) : (
    <span title={title} className={className}>
      {content}
    </span>
  )
}

const key = (e: CalendarEvent) => e.id ?? e.code + e.title

/* Un día del calendario de 2 semanas de Hoy (compu). Muestra hasta 2 cosas; el
   resto queda en «+N más», que se despliega en el mismo día con el teclado o
   con el mouse. */
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
  const hidden = events.slice(MAX_VISIBLE)
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
        <Event key={key(e)} event={e} />
      ))}
      {hidden.length > 0 && (
        <details className='group'>
          <summary className='cursor-pointer list-none rounded-md px-1.5 text-[11px] font-bold text-blue focus-ring [&::-webkit-details-marker]:hidden'>
            <span className='group-open:hidden'>+{hidden.length} más</span>
            <span className='hidden group-open:inline'>Ver menos</span>
          </summary>
          <div className='mt-1 flex flex-col gap-1'>
            {hidden.map((e) => (
              <Event key={key(e)} event={e} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

/* Qué quiere decir cada color del calendario. `next` es «Próximo parcial» o «Próximo final», según lo que
   venga; sin próximo, no va. */
export function CalendarLegend({ next }: { next?: string }) {
  return (
    <p className='flex flex-wrap gap-1.5 text-[11px]'>
      <span className={cn('rounded-md px-1.5 py-0.5', ORIGINS.siu.className)}>Parcial o final · SIU</span>
      <span className={cn('rounded-md px-1.5 py-0.5', ORIGINS.moodle.className)}>Entrega · Moodle</span>
      {next && <span className='rounded-md bg-blue px-1.5 py-0.5 text-white'>{next}</span>}
    </p>
  )
}
