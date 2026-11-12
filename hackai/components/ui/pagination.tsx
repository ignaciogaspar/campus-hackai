import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const ITEM =
  'grid size-9 place-items-center rounded-lg text-[0.8125rem] font-semibold tabular-nums transition-colors focus-ring'

/* Paginado con enlaces: cada página es una URL, así se puede compartir y el
   botón de atrás vuelve a la anterior. Con una sola página no se muestra. */
export function Pagination({
  page,
  pages,
  hrefFor,
  label = 'Páginas'
}: {
  /** La página actual, desde 1. */
  page: number
  pages: number
  hrefFor: (page: number) => string
  label?: string
}) {
  if (pages <= 1) return null
  const arrow = (to: number, text: string, Icon: typeof ChevronLeft) =>
    to < 1 || to > pages ? (
      <span aria-hidden='true' className={cn(ITEM, 'text-gray-light')}>
        <Icon className='size-4' strokeWidth={2} />
      </span>
    ) : (
      <Link href={hrefFor(to)} aria-label={text} className={cn(ITEM, 'text-ink hover:bg-ink/5')}>
        <Icon aria-hidden='true' className='size-4' strokeWidth={2} />
      </Link>
    )
  return (
    <nav aria-label={label} className='flex items-center justify-center gap-1'>
      {arrow(page - 1, 'Página anterior', ChevronLeft)}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-current={n === page ? 'page' : undefined}
          className={cn(ITEM, n === page ? 'bg-blue text-white' : 'text-ink hover:bg-ink/5')}
        >
          <span className='sr-only'>Página </span>
          {n}
        </Link>
      ))}
      {arrow(page + 1, 'Página siguiente', ChevronRight)}
    </nav>
  )
}
