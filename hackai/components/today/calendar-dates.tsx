/* Las fechas del calendario en texto: arriba de la semana, qué vence esta
   semana y cuál es el próximo parcial y el próximo final (components/today/calendar-summary.ts);
   al costado, las próximas fechas en lista. Cada una lleva a donde lleva su
   fecha en Hoy (`dateHref`). */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { dueTime } from '@/components/dates'
import { dateHref } from '@/components/today/agenda'
import { inDays, nextDatesOf, summaryOf } from '@/components/today/calendar-summary'
import type { Role } from '@/lib/core/people'
import type { UpcomingItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'TP',
  final: 'Final',
  entrega: 'Entrega'
}

const DOT: Record<'entrega' | 'parcial' | 'final', string> = {
  entrega: 'bg-kind-entrega',
  parcial: 'bg-kind-parcial',
  final: 'bg-kind-final'
}

/* Una línea del resumen: qué se pregunta, la respuesta y, si tiene destino, el enlace. */
function SummaryLine({
  label,
  dot,
  href,
  children,
  detail
}: {
  label: string
  dot: string
  href?: string
  children: ReactNode
  detail?: ReactNode
}) {
  const body = (
    <>
      <span className='flex items-center gap-1.5 text-[0.75rem] font-semibold text-muted-foreground'>
        <span aria-hidden='true' className={cn('size-2 flex-none rounded-full', dot)} />
        {label}
      </span>
      <span className='text-[0.875rem] leading-snug font-semibold text-pretty text-ink'>{children}</span>
      {detail && <span className='text-[0.8125rem] text-muted-foreground'>{detail}</span>}
    </>
  )
  const className = 'flex min-h-11 min-w-0 flex-col justify-center gap-0.5 bg-card px-4 py-2.5'
  return href ? (
    <Link href={href} className={cn(className, 'transition-colors hover:bg-background focus-ring-inset')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/* Lo que se responde de un vistazo, antes de la semana: qué vence esta semana y
   cuál es el próximo parcial y el próximo final, con cuánto falta. */
export function CalendarSummary({ items, now, viewer }: { items: UpcomingItem[]; now: string; viewer: Role }) {
  const { dueThisWeek, nextExam, nextFinal } = summaryOf(items, now)
  const [first, ...rest] = dueThisWeek
  const when = (i: UpcomingItem) => (
    <>
      <time dateTime={i.date}>{dueTime(i.date)}</time> · {inDays(i.date, now)}
    </>
  )
  return (
    <section
      aria-label='Lo próximo'
      className='grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3'
    >
      <SummaryLine
        label='Esta semana'
        dot={DOT.entrega}
        href={first && dateHref(first, viewer)}
        detail={first && (rest.length > 0 ? `y ${rest.length} más · vence ${dueTime(first.date)}` : when(first))}
      >
        {first ? `${first.name} · ${first.subjectCode}` : 'Nada por entregar'}
      </SummaryLine>
      <SummaryLine
        label='Próximo parcial'
        dot={DOT.parcial}
        href={nextExam ? dateHref(nextExam, viewer) : undefined}
        detail={nextExam && when(nextExam)}
      >
        {nextExam ? `${nextExam.name} · ${nextExam.subjectName}` : 'No hay parciales por delante'}
      </SummaryLine>
      <SummaryLine
        label='Próximo final'
        dot={DOT.final}
        href={nextFinal ? dateHref(nextFinal, viewer) : undefined}
        detail={nextFinal && when(nextFinal)}
      >
        {nextFinal ? nextFinal.subjectName : 'No hay finales por delante'}
      </SummaryLine>
    </section>
  )
}

/* Las próximas fechas, en lista: lo mismo que el calendario, para leerlo de un vistazo. Cortan en 6, pero el
   próximo parcial y el próximo final siempre están. */
export function NextDates({ items, viewer }: { items: UpcomingItem[]; viewer: Role }) {
  const next = nextDatesOf(items)
  return (
    <section aria-labelledby='proximas' className='rounded-2xl border border-border bg-card p-4'>
      <h2 id='proximas' className='pb-2 text-[0.9375rem] font-semibold text-ink'>
        Próximas fechas
      </h2>
      {next.length === 0 ? (
        <p className='text-[0.8125rem] text-muted-foreground'>No hay parciales, finales ni entregas por delante.</p>
      ) : (
        <ul className='flex flex-col divide-y divide-border'>
          {next.map((i) => {
            const href = dateHref(i, viewer)
            const body = (
              <>
                <span className='text-[0.8125rem] font-semibold text-ink'>
                  {KIND[i.kind]} · {i.subjectName}
                </span>
                <span className='text-[0.75rem] text-muted-foreground'>
                  {i.name} · <time dateTime={i.date}>{dueTime(i.date)}</time>
                </span>
              </>
            )
            return (
              <li key={i.id}>
                {href ? (
                  <Link
                    href={href}
                    className='-mx-2 flex min-h-11 flex-col justify-center gap-0.5 rounded-lg px-2 py-2 transition-colors hover:bg-background focus-ring'
                  >
                    {body}
                  </Link>
                ) : (
                  <span className='flex flex-col gap-0.5 py-2'>{body}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
