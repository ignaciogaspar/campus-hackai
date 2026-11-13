'use client'

import { ChevronLeft, ChevronRight, ClipboardList, MousePointerClick } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  asKind,
  emptyList,
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
import { LinkPending } from '@/components/ui/link-pending'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { cn } from '@/lib/utils'

function SubjectRow({ tab, kind, item, active }: { tab: Tab; kind: Kind; item: ListItem; active: boolean }) {
  return (
    <li>
      {/* Un Link y no un <a>: con <a> cada toque recargaba la pantalla entera. Mientras llega el detalle, la
          lista queda donde estaba y la flecha de la fila se vuelve una ruedita. */}
      <Link
        href={href(tab, item.subjectId, kind)}
        prefetch={false}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus-ring',
          active ? 'bg-accent' : 'hover:bg-ink/4 active:bg-accent'
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
        <LinkPending className='size-4.5 text-blue'>
          <ChevronRight
            aria-hidden='true'
            className={cn(
              'size-4.5 flex-none transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none',
              active ? 'text-blue' : 'text-gray-light'
            )}
            strokeWidth={2}
          />
        </LinkPending>
      </Link>
    </li>
  )
}

function ListGroup({
  title,
  tab,
  kind,
  items,
  selected
}: {
  title: string
  tab: Tab
  kind: Kind
  items: ListItem[]
  selected: string | undefined
}) {
  return (
    <div className='flex flex-col gap-1'>
      <h2 className='flex items-baseline justify-between px-3 pt-2 pb-1 text-[0.75rem] font-bold tracking-wide text-muted-foreground uppercase'>
        {title}
        <span className='font-semibold tabular-nums'>{items.length}</span>
      </h2>
      <ul className='flex flex-col gap-1'>
        {items.map((item) => (
          <SubjectRow key={item.subjectId} tab={tab} kind={kind} item={item} active={item.subjectId === selected} />
        ))}
      </ul>
    </div>
  )
}

/* Los tipos, en un riel de una fila arriba de la lista (fuera del scroll): con cuántas abiertas hay de cada uno. En el
   celular, si no entran (con letra grande), el riel se desliza y el borde derecho se desvanece para mostrarlo. */
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
      className={cn(
        railTrack({ size: 'sm' }),
        'w-full overflow-x-auto [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]'
      )}
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
            className: 'group/kind min-h-11 flex-auto shrink-0 gap-1 px-2.5 text-[0.75rem] max-sm:px-1.5'
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

function SubjectList({
  tab,
  kind,
  open,
  mine,
  mineError,
  selected
}: {
  tab: Tab
  kind: Kind
  open: ListItem[]
  mine: ListItem[]
  mineError: string | null
  selected: string | undefined
}) {
  const filter = matches(tab === 'materias' ? kind : 'todas')
  const shownOpen = open.filter(filter)
  const shownMine = mine.filter(filter)
  const empty = shownOpen.length === 0 ? emptyList({ tab, kind, open, mine }) : null
  return (
    <div className='flex flex-col gap-2'>
      {empty ? (
        <EmptyState icon={ClipboardList} title={empty.title}>
          {empty.text}
        </EmptyState>
      ) : (
        <ListGroup title='Con inscripción abierta' tab={tab} kind={kind} items={shownOpen} selected={selected} />
      )}
      {shownMine.length > 0 && (
        <ListGroup
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

/* Lo que ocupa el detalle mientras no hay una materia elegida: un panel de todo el alto de la columna, con el aviso
   en el medio. Así la columna no queda vacía con el texto flotando arriba. */
function PickSubject({ tab }: { tab: Tab }) {
  return (
    <div className='grid h-full min-h-[22rem] place-items-center rounded-2xl border border-dashed border-ink/12 bg-ice/50 p-6'>
      <div className='flex max-w-sm flex-col items-center gap-3 text-center'>
        <span className='grid size-12 place-items-center rounded-2xl bg-card text-blue shadow-card'>
          <MousePointerClick aria-hidden='true' className='size-6' strokeWidth={1.8} />
        </span>
        <strong className='text-base font-semibold text-ink'>Elegí una materia</strong>
        <p className='text-[0.875rem] text-pretty text-muted-foreground'>
          {tab === 'materias'
            ? 'Tocá una materia de la lista para ver sus comisiones, horarios, cupo y docentes.'
            : 'Tocá una materia de la lista para ver sus mesas, fechas y tribunal.'}
        </p>
      </div>
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
  const tab = params.get('tab') === 'examenes' ? 'examenes' : 'materias'
  const selected = params.get('materia') ?? undefined
  const kind = asKind(params.get('tipo') ?? undefined)
  const listKind = tab === 'materias' ? kind : 'todas'
  const { open, mine, mineError } = lists[tab]
  // Sin nada en la lista, compu no invita a tocar una materia: la lista ocupa todo el ancho.
  const nothingToPick = !selected && ![...open, ...mine].some(matches(listKind))

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
              className={railItem({
                size: 'sm',
                className: 'min-h-11 py-1 text-center leading-tight whitespace-normal'
              })}
            >
              <span className='sm:hidden'>{item.short}</span>
              <span className='max-sm:hidden'>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      {error ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : (
        <div
          className={cn(
            'grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6',
            !nothingToPick && 'lg:h-[max(30rem,calc(100dvh-17.5rem))] lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)]'
          )}
        >
          <section
            aria-label='Materias'
            className={cn(
              'flex min-h-0 flex-col gap-2 rounded-2xl border border-border bg-card p-2',
              selected && 'max-lg:hidden'
            )}
          >
            {tab === 'materias' && <KindFilter current={listKind} counts={kindCounts(open)} selected={selected} />}
            <div className='relative min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]'>
              <SubjectList tab={tab} kind={kind} open={open} mine={mine} mineError={mineError} selected={selected} />
            </div>
          </section>

          {!nothingToPick && (
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
              {selected && selected === detailSubject && tab === detailTab ? detail : <PickSubject tab={tab} />}
            </section>
          )}
        </div>
      )}
    </>
  )
}
