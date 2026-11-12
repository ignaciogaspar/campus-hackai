/* Finales pendientes: lo regular sin aprobar, cada uno con su próxima mesa y
   cómo está su inscripción. Cada uno lleva a las mesas de la materia o, con
   `toSpace` (Mis materias), a su espacio para estudiar, con «Ver mesas» si la
   inscripción está abierta. Solo muestra lo que le da Cursada. */
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { approvalDate } from '@/components/academic/format'
import { longDay, shortDate, timeOf } from '@/components/dates'
import { spaceHref } from '@/components/spaces/format'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import type { PendingFinal } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function statusText(next: NonNullable<PendingFinal['next']>): { text: string; warn: boolean } {
  if (next.status === 'inscripto') return { text: 'Ya estás inscripto', warn: false }
  if (next.status === 'no-abrio')
    return { text: `La inscripción abre el ${shortDate(next.enrollmentStart)}`, warn: false }
  if (next.status === 'sin-cupo') return { text: 'Sin cupo en esta mesa', warn: true }
  return { text: `Inscripción abierta hasta el ${shortDate(next.enrollmentEnd)}`, warn: true }
}

const boardsHref = (subjectId: string) => `/inscripciones/${encodeURIComponent(subjectId)}/final`

function PendingFinalRow({ item, toSpace }: { item: PendingFinal; toSpace: boolean }) {
  const status = item.next ? statusText(item.next) : null
  return (
    <li className='border-b border-border last:border-b-0'>
      <Link
        href={toSpace ? spaceHref(item.subjectId) : boardsHref(item.subjectId)}
        className='group flex min-h-16 items-center gap-3 px-4 py-3.5 text-foreground hover:bg-blue/[0.04] focus-ring-inset'
      >
        <span className='min-w-0 flex-1'>
          <span className='block leading-snug font-semibold'>{item.subjectName}</span>
          <span className='block text-[0.8125rem] text-muted-foreground'>
            Regular desde <time dateTime={item.regularSince}>{approvalDate(item.regularSince)}</time>
          </span>
          {item.next && status ? (
            <>
              <span className='block text-[0.8125rem] text-muted-foreground'>
                {item.next.examPeriod} · <time dateTime={item.next.date}>{longDay(item.next.date)}</time>,{' '}
                {timeOf(item.next.date)} · {item.next.location}
              </span>
              <span className={cn('block text-[0.8125rem] font-semibold', status.warn && 'text-warning-foreground')}>
                {status.text}
              </span>
            </>
          ) : (
            <span className='block text-[0.8125rem] text-muted-foreground'>Todavía no hay mesa a la que anotarte</span>
          )}
        </span>
        <ChevronRight
          aria-hidden='true'
          className='size-5 flex-none text-gray-light group-hover:text-blue'
          strokeWidth={1.8}
        />
      </Link>
      {toSpace && item.next?.status === 'abierta' && (
        <Link
          href={boardsHref(item.subjectId)}
          className='-mt-2 ml-4 inline-flex min-h-11 items-center text-[0.8125rem] font-bold text-blue-light underline focus-ring'
        >
          Ver mesas
        </Link>
      )}
    </li>
  )
}

export function PendingFinals({ items, toSpace = false }: { items: PendingFinal[]; toSpace?: boolean }) {
  if (items.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title='No debés finales'>
        Cuando regularices una materia y te falte rendir el final, la vas a ver acá con su próxima mesa.
      </EmptyState>
    )
  }
  return (
    <Card>
      <ul>
        {items.map((item) => (
          <PendingFinalRow key={item.subjectId} item={item} toSpace={toSpace} />
        ))}
      </ul>
    </Card>
  )
}
