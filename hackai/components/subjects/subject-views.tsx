'use client'

import { Archive, BookOpen, Hourglass } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { SubjectGrid } from '@/components/subjects/subject-grid'
import { Pagination } from '@/components/ui/pagination'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 9

type View = 'en-curso' | 'final-pendiente' | 'archivadas'

const VIEWS: { view: View; label: string; students: boolean }[] = [
  { view: 'en-curso', label: 'En curso', students: false },
  { view: 'final-pendiente', label: 'Final pendiente', students: true },
  { view: 'archivadas', label: 'Archivadas', students: false }
]

function href(view: View, page = 1): string {
  const params = new URLSearchParams()
  if (view !== 'en-curso') params.set('ver', view)
  if (page > 1) params.set('pagina', String(page))
  const query = params.toString()
  return query ? `/materias?${query}` : '/materias'
}

/* Las vistas, en un riel alineado con la grilla: «En curso» siempre; las otras, con cuántas hay, para elegirlas. */
function ViewTabs({ current, counts, student }: { current: View; counts: Record<View, number>; student: boolean }) {
  return (
    <nav aria-label='Qué materias ver' className={cn(railTrack({ size: 'sm' }), 'w-full max-w-xl')}>
      {VIEWS.filter((v) => student || !v.students).map(({ view, label }) => (
        <Link
          key={view}
          href={href(view)}
          prefetch={false}
          onNavigate={(event) => {
            event.preventDefault()
            window.history.pushState(null, '', href(view))
          }}
          aria-current={view === current ? 'page' : undefined}
          className={cn(
            railItem({ size: 'sm' }),
            'group/tab max-sm:flex-auto max-sm:gap-1.5 max-sm:px-3 max-sm:text-[0.75rem]'
          )}
        >
          {label}
          {/* En el celular el número va como texto, sin globo: así «Final pendiente» entra con aire a los costados. */}
          <span className='grid h-5 min-w-5 place-items-center rounded-full bg-ink/8 px-1.5 text-[0.6875rem] text-ink/70 tabular-nums group-aria-[current=page]/tab:bg-blue group-aria-[current=page]/tab:text-white max-sm:h-auto max-sm:min-w-0 max-sm:bg-transparent max-sm:px-0 max-sm:text-[0.75rem] max-sm:text-muted-foreground max-sm:group-aria-[current=page]/tab:bg-transparent max-sm:group-aria-[current=page]/tab:text-blue'>
            {counts[view]}
          </span>
        </Link>
      ))}
    </nav>
  )
}

const EMPTY: Record<View, { icon: typeof BookOpen; title: string; text: string }> = {
  'en-curso': {
    icon: BookOpen,
    title: 'Sin materias en curso',
    text: 'No tenés materias en curso ni del próximo período. Inscribite a una desde Inscripciones.'
  },
  'final-pendiente': {
    icon: Hourglass,
    title: 'No tenés finales pendientes',
    text: 'Cuando regularices una cursada y te falte el final, aparece acá con el acceso a la mesa.'
  },
  archivadas: {
    icon: Archive,
    title: 'Sin materias archivadas',
    text: 'Las materias de cuatrimestres que ya terminaron se guardan acá.'
  }
}

export function SubjectViews({ views, student }: { views: Record<View, ReactNode[]>; student: boolean }) {
  const params = useSearchParams()
  const requested = params.get('ver')
  const view = requested === 'archivadas' || (student && requested === 'final-pendiente') ? requested : 'en-curso'
  const cards = views[view]
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Math.trunc(Number(params.get('pagina'))) || 1), pages)
  const empty = EMPTY[view]
  const counts = {
    'en-curso': views['en-curso'].length,
    'final-pendiente': views['final-pendiente'].length,
    archivadas: views.archivadas.length
  }

  return (
    <>
      <ViewTabs current={view} counts={counts} student={student} />
      {cards.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title}>
          {empty.text}
        </EmptyState>
      ) : (
        <SubjectGrid>{cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}</SubjectGrid>
      )}
      <Pagination page={page} pages={pages} hrefFor={(n) => href(view, n)} label='Páginas de materias' local />
    </>
  )
}
