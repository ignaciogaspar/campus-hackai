'use client'

import { ChevronLeft, ChevronRight, ClipboardList, MousePointerClick } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, startTransition, useOptimistic } from 'react'
import {
  asKind,
  href,
  KINDS,
  type Kind,
  kindCounts,
  type ListItem,
  matches,
  TABS,
  type Tab
} from '@/components/enrollment/list-filters'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { cn } from '@/lib/utils'

function SubjectRow({
  tab,
  kind,
  item,
  active,
  select
}: {
  tab: Tab
  kind: Kind
  item: ListItem
  active: boolean
  select: (id: string) => void
}) {
  return (
    <li>
      <Link
        href={href(tab, item.subjectId, kind)}
        prefetch={false}
        onNavigate={(event) => {
          event.preventDefault()
          select(item.subjectId)
        }}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus-ring',
          active ? 'bg-accent' : 'hover:bg-ink/4'
        )}
      >
        <SubjectIcon name={item.subjectName} size='md' tone={active ? 'solid' : 'soft'} />
        <span className='min-w-0 flex-1'>
          <span className='block text-[0.875rem] leading-snug font-semibold text-ink'>{item.subjectName}</span>
          <span
            className={cn(
              'block text-[0.75rem]',
              item.urgent ? 'font-semibold text-warning-foreground' : 'text-muted-foreground'
            )}
          >
            {item.detail}
          </span>
        </span>
        <ChevronRight
          aria-hidden='true'
          className={cn(
            'size-4.5 flex-none transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none',
            active ? 'text-blue' : 'text-gray-light'
          )}
          strokeWidth={2}
        />
      </Link>
    </li>
  )
}

function ListGroup({
  title,
  tab,
  kind,
  items,
  selected,
  select
}: {
  title: string
  tab: Tab
  kind: Kind
  items: ListItem[]
  selected: string | undefined
  select: (id: string) => void
}) {
  return (
    <div className='flex flex-col gap-1'>
      <h2 className='flex items-baseline justify-between px-3 pt-2 pb-1 text-[0.75rem] font-bold tracking-wide text-muted-foreground uppercase'>
        {title}
        <span className='font-semibold tabular-nums'>{items.length}</span>
      </h2>
      <ul className='flex flex-col gap-1'>
        {items.map((item) => (
          <SubjectRow
            select={select}
            key={item.subjectId}
            tab={tab}
            kind={kind}
            item={item}
            active={item.subjectId === selected}
          />
        ))}
      </ul>
    </div>
  )
}

/* Los tipos, en un riel de una fila arriba de la lista (fuera del scroll): con cuántas abiertas hay de cada uno. */
function KindFilter({
  current,
  counts,
  selected
}: {
  current: Kind
  counts: Record<Kind, number>
  selected: string | undefined
}) {
  return (
    <nav
      aria-label='Tipo de materia'
      className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto [scrollbar-width:none]')}
    >
      {KINDS.map(({ kind, label, short }) => (
        <Link
          key={kind}
          href={href('materias', selected, kind)}
          prefetch={false}
          onNavigate={(event) => {
            event.preventDefault()
            window.history.replaceState(null, '', href('materias', selected, kind))
          }}
          aria-current={kind === current ? 'page' : undefined}
          className={railItem({
            size: 'sm',
            className: 'group/kind flex-auto shrink-0 gap-1 px-2.5 text-[0.75rem] max-sm:px-1.5'
          })}
        >
          {short ? (
            <>
              <span className='sm:hidden'>{short}</span>
              <span className='max-sm:hidden'>{label}</span>
            </>
          ) : (
            label
          )}
          <span className='text-[0.6875rem] text-muted-foreground tabular-nums group-aria-[current=page]/kind:text-blue'>
            {counts[kind]}
          </span>
        </Link>
      ))}
    </nav>
  )
}

function emptyText(tab: Tab, kind: Kind): string {
  if (tab === 'examenes') return 'Ahora no hay mesas abiertas de materias que tengas regulares o estés cursando.'
  if (kind === 'todas') return 'Ahora no hay inscripciones a cursada que te sirvan. Cuando abra una, aparece acá.'
  return 'No hay inscripciones abiertas de este tipo. Probá con otro filtro.'
}

function SubjectList({
  tab,
  kind,
  open,
  mine,
  mineError,
  selected,
  select
}: {
  tab: Tab
  kind: Kind
  open: ListItem[]
  mine: ListItem[]
  mineError: string | null
  selected: string | undefined
  select: (id: string) => void
}) {
  const filter = matches(tab === 'materias' ? kind : 'todas')
  const shownOpen = open.filter(filter)
  const shownMine = mine.filter(filter)
  return (
    <div className='flex flex-col gap-2'>
      {shownOpen.length === 0 ? (
        <EmptyState icon={ClipboardList} title='No hay inscripciones abiertas'>
          {emptyText(tab, kind)}
        </EmptyState>
      ) : (
        <ListGroup
          select={select}
          title='Con inscripción abierta'
          tab={tab}
          kind={kind}
          items={shownOpen}
          selected={selected}
        />
      )}
      {shownMine.length > 0 && (
        <ListGroup
          select={select}
          title={tab === 'materias' ? 'Tus cursadas' : 'Tus finales'}
          tab={tab}
          kind={kind}
          items={shownMine}
          selected={selected}
        />
      )}
      {mineError && <ErrorNotice>{mineError}</ErrorNotice>}
    </div>
  )
}

/* La lista a la izquierda y el detalle a la derecha; en el celular, uno por vez.
   En compu el tablero tiene el alto de la ventana y cada columna scrollea sola,
   así la pantalla no se mueve. Las columnas son `relative`: si no, los textos
   para lector de pantalla (posición absoluta) se escapan del scroll y estiran la página. */
type EnrollmentList = { open: ListItem[]; mine: ListItem[]; mineError: string | null }

export function EnrollmentLists({
  lists,
  detail,
  detailTab,
  detailSubject,
  error
}: {
  lists: Record<Tab, EnrollmentList>
  detail: ReactNode
  detailTab: Tab
  detailSubject: string | undefined
  error: string | null
}) {
  const params = useSearchParams()
  const router = useRouter()
  const tab = params.get('tab') === 'examenes' ? 'examenes' : 'materias'
  const selected = params.get('materia') ?? undefined
  const kind = asKind(params.get('tipo') ?? undefined)
  const listKind = tab === 'materias' ? kind : 'todas'
  const [pendingSubject, setPendingSubject] = useOptimistic(selected)
  const { open, mine, mineError } = lists[tab]
  const select = (id: string) => {
    startTransition(() => {
      setPendingSubject(id)
      router.push(href(tab, id, kind))
    })
  }

  return (
    <>
      <nav aria-label='Tipo de inscripción' className={cn(railTrack({ size: 'sm' }), 'mx-auto w-full max-w-xl')}>
        {TABS.map((item) => {
          const target = href(item.tab, item.tab === tab ? selected : undefined, kind)
          return (
            <Link
              key={item.tab}
              href={target}
              prefetch={false}
              onNavigate={(event) => {
                event.preventDefault()
                window.history.replaceState(null, '', target)
              }}
              aria-current={item.tab === tab ? 'page' : undefined}
              className={railItem({ size: 'sm' })}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      {error ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : (
        <div className='grid grid-cols-[minmax(0,1fr)] gap-5 lg:h-[max(30rem,calc(100dvh-17.5rem))] lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] lg:gap-6'>
          <section
            aria-label='Materias'
            className={cn(
              'flex min-h-0 flex-col gap-2 rounded-2xl border border-border bg-card p-2',
              selected && 'max-lg:hidden'
            )}
          >
            {tab === 'materias' && <KindFilter current={listKind} counts={kindCounts(open)} selected={selected} />}
            <div className='relative min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]'>
              <SubjectList
                tab={tab}
                kind={kind}
                open={open}
                mine={mine}
                mineError={mineError}
                selected={pendingSubject}
                select={select}
              />
            </div>
          </section>

          <section
            aria-label='Detalle de la materia'
            className={cn(
              'relative min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]',
              !selected && 'max-lg:hidden'
            )}
          >
            {selected && (
              <Link
                href={href(tab, undefined, kind)}
                prefetch={false}
                onNavigate={(event) => {
                  event.preventDefault()
                  window.history.replaceState(null, '', href(tab, undefined, kind))
                }}
                className='mb-3 inline-flex min-h-10 items-center gap-1 text-[0.875rem] font-semibold text-blue lg:hidden'
              >
                <ChevronLeft aria-hidden='true' className='size-4' strokeWidth={2} />
                Todas las materias
              </Link>
            )}
            {selected && selected === detailSubject && tab === detailTab ? (
              detail
            ) : (
              <EmptyState icon={MousePointerClick} title='Elegí una materia'>
                {tab === 'materias'
                  ? 'Tocá una materia de la lista para ver sus comisiones, horarios, cupo y docentes.'
                  : 'Tocá una materia de la lista para ver sus mesas, fechas y tribunal.'}
              </EmptyState>
            )}
          </section>
        </div>
      )}
    </>
  )
}
