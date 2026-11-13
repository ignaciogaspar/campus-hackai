'use client'

import { CheckCheck, SearchX } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { NEWS_KINDS, type NewsKind, newsBySubject, newsKindOf, newsTotal, unreadTotal } from '@/components/news/format'
import { NewsList } from '@/components/news/news-list'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import type { UnreadItem } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

const asKind = (value: string | undefined): NewsKind | 'todas' =>
  NEWS_KINDS.find((k) => k.kind === value)?.kind ?? 'todas'

/* Los tipos, en el riel de una fila como los demás filtros: solo los que tienen algo sin leer, con cuánto.
   En el celular, si no entran, el riel se desliza de costado. «Todas» cuenta también las notas nuevas. */
function KindFilter({ items, grades, current }: { items: UnreadItem[]; grades: number; current: NewsKind | 'todas' }) {
  const options = [
    { kind: 'todas' as const, label: 'Todas', count: newsTotal(items, grades) },
    ...NEWS_KINDS.map((k) => ({
      ...k,
      count: unreadTotal(items.filter((i) => newsKindOf(i.kind) === k.kind))
    }))
  ].filter((o) => o.count > 0 || o.kind === current)
  return (
    <nav
      aria-label='Tipo de novedad'
      className={cn(railTrack({ size: 'sm' }), 'mx-auto w-full max-w-xl overflow-x-auto [scrollbar-width:none]')}
    >
      {options.map(({ kind, label, count }) => (
        <Link
          key={kind}
          href={kind === 'todas' ? '/novedades' : `/novedades?tipo=${kind}`}
          prefetch={false}
          onNavigate={(event) => {
            event.preventDefault()
            window.history.replaceState(null, '', kind === 'todas' ? '/novedades' : `/novedades?tipo=${kind}`)
          }}
          aria-current={kind === current ? 'page' : undefined}
          className={railItem({ size: 'sm', className: 'group/kind shrink-0 gap-1.5' })}
        >
          {label}
          <span className='text-[0.6875rem] text-muted-foreground tabular-nums group-aria-[current=page]/kind:text-blue'>
            {count}
          </span>
        </Link>
      ))}
    </nav>
  )
}

export function NewsFilter({
  items,
  grades,
  gradeNews
}: {
  items: UnreadItem[]
  grades: number
  gradeNews: ReactNode
}) {
  const kind = asKind(useSearchParams().get('tipo') ?? undefined)
  return <News items={items} kind={kind} grades={grades} gradeNews={gradeNews} />
}

/* Primero el filtro, después las notas nuevas (solo en «Todas») y al final lo sin leer de cada materia. */
function News({
  items,
  kind,
  grades,
  gradeNews
}: {
  items: UnreadItem[]
  kind: NewsKind | 'todas'
  grades: number
  gradeNews: ReactNode
}) {
  if (items.length === 0 && grades === 0) {
    return (
      <EmptyState icon={CheckCheck} title='Estás al día'>
        Acá van a aparecer los avisos, las consultas y sus respuestas, el material nuevo y los mensajes directos de tus
        materias que todavía no leíste.
      </EmptyState>
    )
  }
  // Con notas nuevas no está al día, aunque no haya nada sin leer en los espacios: en «Todas» van solas, sin filtro.
  if (items.length === 0 && kind === 'todas') return gradeNews
  // Filtrando por otro tipo, las notas no salen: si no hay nada de ese tipo, el filtro y «Nada de este tipo».
  const shown = kind === 'todas' ? items : items.filter((i) => newsKindOf(i.kind) === kind)
  return (
    <>
      <KindFilter items={items} grades={grades} current={kind} />
      {kind === 'todas' && gradeNews}
      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title='Nada de este tipo'>
          No tenés novedades sin leer de este tipo. Probá con otro filtro.
        </EmptyState>
      ) : (
        <NewsList groups={newsBySubject(shown)} />
      )}
    </>
  )
}
