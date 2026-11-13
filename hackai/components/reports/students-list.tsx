/* El listado de alumnos de Reportes: buscable, ordenable y paginado, con los
   filtros de arriba. En compu, una tabla con los encabezados que ordenan; en el
   celular, una tarjeta por alumno. Cada alumno lleva a su ficha. Todo con
   enlaces y un formulario GET: anda sin JavaScript y cada estado es una URL. */
import { ArrowDown, ArrowUp, BookmarkCheck, ChevronRight, Download, Search, Users } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { count } from '@/components/reports/format'
import { hrefOf, type ListParams, paramsOf } from '@/components/reports/params'
import { RiskBadges } from '@/components/reports/risk-badges'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import type { ReportFilters, StudentPage, StudentRow, StudentSort } from '@/lib/core/reports'
import { dayText, decimal, STATUS_LABEL } from '@/lib/reports-labels'
import { cn } from '@/lib/utils'

type Writable = Omit<ReportFilters, 'followed'> & ListParams

/** El enlace a la ficha: con el año del reporte y la lista de donde viene, para volver. */
export function studentHref(id: string, year: number, back: string): string {
  return `/reportes/alumnos/${encodeURIComponent(id)}?${new URLSearchParams({ anio: String(year), volver: back })}`
}

function SortHeader({
  sort,
  label,
  state,
  path,
  className
}: {
  sort: StudentSort
  label: string
  state: Writable
  path: string
  className?: string
}) {
  const current = state.sort === sort
  const next = current && state.order === 'asc' ? 'desc' : current ? 'asc' : sort === 'nombre' ? 'asc' : 'desc'
  const Icon = state.order === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope='col'
      aria-sort={current ? (state.order === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('px-2 py-2.5 font-semibold', className)}
    >
      <Link
        href={hrefOf(path, { ...state, sort, order: next, page: 1 })}
        scroll={false}
        className={cn('inline-flex items-center gap-1 rounded hover:text-ink focus-ring', current && 'text-ink')}
      >
        {label}
        {current && <Icon aria-hidden='true' className='size-3.5' strokeWidth={2.4} />}
      </Link>
    </th>
  )
}

/** La barra de avance chica de una fila, con el número al lado. */
function Progress({ value }: { value: number }) {
  return (
    <span className='flex items-center gap-2'>
      <span aria-hidden='true' className='h-1.5 w-16 flex-none overflow-hidden rounded-full bg-accent'>
        <span className='block h-full rounded-full bg-viz-1' style={{ width: `${value}%` }} />
      </span>
      <span className='tabular-nums'>{value} %</span>
    </span>
  )
}

function StatusText({ row }: { row: StudentRow }) {
  if (row.status === 'activo') return null
  return (
    <span className='text-[0.75rem] text-muted-foreground'>
      {STATUS_LABEL[row.status]} {dayText(row.statusDate)}
    </span>
  )
}

function FollowMark({ row }: { row: StudentRow }) {
  if (!row.followUp) return null
  return (
    <span title={row.followUp.note || 'En seguimiento'} className='inline-flex text-blue'>
      <BookmarkCheck aria-hidden='true' className='size-4' />
      <span className='sr-only'>En seguimiento{row.followUp.note ? `: ${row.followUp.note}` : ''}</span>
    </span>
  )
}

function Table({
  rows,
  state,
  path,
  href
}: {
  rows: StudentRow[]
  state: Writable
  path: string
  href: (id: string) => string
}) {
  const cell = 'px-2 py-3 align-top'
  return (
    <Card className='hidden lg:block'>
      <table className='w-full border-collapse text-[0.8125rem]'>
        <thead>
          <tr className='border-b border-border text-left text-[0.75rem] text-muted-foreground'>
            <SortHeader sort='nombre' label='Alumno' state={state} path={path} className='pl-4' />
            <th scope='col' className='px-2 py-2.5 font-semibold'>
              Carrera
            </th>
            <SortHeader sort='ingreso' label='Ingreso' state={state} path={path} />
            <SortHeader sort='avance' label='Avance' state={state} path={path} />
            <SortHeader sort='faltan' label='Faltan' state={state} path={path} />
            <SortHeader sort='creditos' label='Créditos VU' state={state} path={path} />
            <SortHeader sort='aplazos' label='Aplazos' state={state} path={path} />
            <SortHeader sort='promedio' label='Promedio' state={state} path={path} />
            <th scope='col' className='px-2 py-2.5 pr-4 font-semibold'>
              Indicadores
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className='border-b border-border/60 last:border-0 hover:bg-ice'>
              <th scope='row' className={cn(cell, 'pl-4 text-left font-normal')}>
                <span className='flex items-center gap-1.5'>
                  <Link
                    href={href(row.id)}
                    className='font-semibold text-ink hover:text-blue hover:underline focus-ring'
                  >
                    {row.name}
                  </Link>
                  <FollowMark row={row} />
                </span>
                <span className='block text-[0.75rem] text-muted-foreground tabular-nums'>Legajo {row.id}</span>
                <StatusText row={row} />
              </th>
              <td className={cell}>
                <span className='block max-w-56 leading-snug'>{row.program}</span>
                <span className='text-[0.75rem] text-muted-foreground'>
                  {row.school} · {row.campus}
                </span>
              </td>
              <td className={cn(cell, 'tabular-nums')}>{row.cohort}</td>
              <td className={cell}>
                <Progress value={row.progress} />
              </td>
              <td className={cn(cell, 'tabular-nums')}>{row.missing}</td>
              <td className={cn(cell, 'tabular-nums')}>
                {row.credits} <span className='text-muted-foreground'>/ {row.creditsRequired}</span>
              </td>
              <td className={cn(cell, 'tabular-nums')}>{row.failures}</td>
              <td className={cn(cell, 'tabular-nums')}>{decimal(row.average)}</td>
              <td className={cn(cell, 'pr-4')}>
                <RiskBadges risks={row.risks} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className='flex flex-col'>
      <span className='text-[0.6875rem] text-muted-foreground'>{label}</span>
      <span className='font-bold text-ink tabular-nums'>{children}</span>
    </span>
  )
}

function Cards({ rows, href, notes }: { rows: StudentRow[]; href: (id: string) => string; notes: boolean }) {
  return (
    <ul className='flex flex-col gap-2 lg:hidden'>
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={href(row.id)}
            className='flex items-start gap-3 rounded-[18px] bg-card p-4 shadow-card transition-shadow hover:shadow-raised focus-ring'
          >
            <span className='flex min-w-0 flex-1 flex-col gap-2'>
              <span>
                <span className='flex items-center gap-1.5 text-[0.9375rem] font-bold text-ink'>
                  {row.name}
                  <FollowMark row={row} />
                </span>
                <span className='block text-[0.75rem] text-muted-foreground'>
                  {row.program} · {row.school} · Ingreso {row.cohort}
                </span>
                <StatusText row={row} />
              </span>
              {notes && row.followUp?.note && (
                <span className='text-[0.8125rem] text-pretty text-ink'>«{row.followUp.note}»</span>
              )}
              <span className='grid grid-cols-4 gap-2 text-[0.8125rem]'>
                <Stat label='Avance'>{row.progress} %</Stat>
                <Stat label='Faltan'>{row.missing}</Stat>
                <Stat label='Créditos'>
                  {row.credits}/{row.creditsRequired}
                </Stat>
                <Stat label='Aplazos'>{row.failures}</Stat>
              </span>
              <RiskBadges risks={row.risks} />
            </span>
            <ChevronRight aria-hidden='true' className='mt-1 size-4 flex-none text-muted-foreground' />
          </Link>
        </li>
      ))}
    </ul>
  )
}

const MOBILE_SORTS: { sort: StudentSort; label: string; order: 'asc' | 'desc' }[] = [
  { sort: 'nombre', label: 'Nombre', order: 'asc' },
  { sort: 'avance', label: 'Menos avance', order: 'asc' },
  { sort: 'faltan', label: 'Más les falta', order: 'desc' },
  { sort: 'aplazos', label: 'Más aplazos', order: 'desc' },
  { sort: 'creditos', label: 'Menos créditos', order: 'asc' },
  { sort: 'ingreso', label: 'Ingreso más viejo', order: 'asc' }
]

/** En el celular no hay encabezados: el orden va en un riel de una línea que se desliza. */
function MobileSort({ state, path }: { state: Writable; path: string }) {
  return (
    <nav
      aria-label='Ordenar'
      className={cn(railTrack({ size: 'sm' }), 'overflow-x-auto [scrollbar-width:none] lg:hidden')}
    >
      {MOBILE_SORTS.map((s) => (
        <Link
          key={s.sort}
          href={hrefOf(path, { ...state, sort: s.sort, order: s.order, page: 1 })}
          scroll={false}
          aria-current={state.sort === s.sort && state.order === s.order ? 'page' : undefined}
          className={railItem({ size: 'sm', className: 'shrink-0' })}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  )
}

/** La búsqueda es un formulario GET que lleva los filtros en campos ocultos. */
function SearchForm({ state, path }: { state: Writable; path: string }) {
  const hidden = [...paramsOf({ ...state, search: '', page: 1 }).entries()]
  return (
    <form action={path} method='get' className='flex min-w-0 flex-1 items-center gap-2'>
      {hidden.map(([name, value]) => (
        <input key={name} type='hidden' name={name} value={value} />
      ))}
      <label className='relative min-w-0 flex-1'>
        <span className='sr-only'>Buscar por nombre, legajo, mail o carrera</span>
        <Search
          aria-hidden='true'
          className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
        />
        <input
          name='buscar'
          type='search'
          defaultValue={state.search}
          placeholder='Nombre, legajo, mail o carrera'
          className='min-h-11 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-[0.9375rem] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
        />
      </label>
      <button
        type='submit'
        className='min-h-11 rounded-xl bg-blue px-4 text-[0.875rem] font-semibold text-white hover:bg-blue-deep focus-ring'
      >
        Buscar
      </button>
    </form>
  )
}

export function StudentsList({
  page,
  list,
  path,
  notes = false,
  empty
}: {
  page: StudentPage
  list: ListParams
  /** La ruta del listado: `/reportes/alumnos` o `/reportes/seguimiento`. */
  path: string
  /** Mostrar la nota del seguimiento de cada alumno. */
  notes?: boolean
  empty: ReactNode
}) {
  const state: Writable = { ...page.filters, ...list, page: page.page }
  const here = hrefOf(path, state)
  const href = (id: string) => studentHref(id, page.filters.year, here)
  const exportHref = `/reportes/exportar?${paramsOf({ ...state, page: 1 })}${path.endsWith('seguimiento') ? '&seguimiento=si' : ''}`
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchForm state={state} path={path} />
        <a
          href={exportHref}
          data-print='hide'
          className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-[0.875rem] font-semibold text-ink hover:bg-ice focus-ring'
        >
          <Download aria-hidden='true' className='size-4' />
          Exportar CSV
        </a>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p role='status' className='text-[0.8125rem] text-muted-foreground'>
          <strong className='text-ink tabular-nums'>{count(page.total)}</strong>{' '}
          {page.total === 1 ? 'alumno' : 'alumnos'}
          {list.search && <> que coinciden con «{list.search}»</>}
        </p>
        <MobileSort state={state} path={path} />
      </div>
      {page.rows.length === 0 ? (
        <EmptyState icon={Users} title='No hay alumnos para mostrar'>
          {empty}
        </EmptyState>
      ) : (
        <>
          <Table rows={page.rows} state={state} path={path} href={href} />
          <Cards rows={page.rows} href={href} notes={notes} />
          <PagedNav page={page} state={state} path={path} />
        </>
      )}
    </div>
  )
}

/** Con muchas páginas, solo las cercanas: el paginado de la app muestra todas. */
function PagedNav({ page, state, path }: { page: StudentPage; state: Writable; path: string }) {
  if (page.pages <= 1) return null
  const hrefFor = (n: number) => hrefOf(path, { ...state, page: n })
  if (page.pages <= 7)
    return <Pagination page={page.page} pages={page.pages} hrefFor={hrefFor} label='Páginas del listado' />
  const link =
    'inline-flex min-h-11 items-center rounded-lg px-3 text-[0.8125rem] font-semibold text-ink hover:bg-ink/5 focus-ring'
  return (
    <nav aria-label='Páginas del listado' className='flex items-center justify-center gap-2'>
      {page.page > 1 && (
        <Link href={hrefFor(page.page - 1)} className={link}>
          Anterior
        </Link>
      )}
      <span className='text-[0.8125rem] text-muted-foreground tabular-nums'>
        Página {page.page} de {page.pages}
      </span>
      {page.page < page.pages && (
        <Link href={hrefFor(page.page + 1)} className={link}>
          Siguiente
        </Link>
      )}
    </nav>
  )
}
