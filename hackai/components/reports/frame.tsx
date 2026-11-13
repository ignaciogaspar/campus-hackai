/* Lo común a las tres vistas de Reportes: el encabezado, el riel de vistas, las
   acciones (imprimir) y los filtros, arriba de lo que filtran. Al imprimir no
   van el encabezado navy ni los controles: va un título con el corte. */
import { type ReactNode, Suspense } from 'react'
import { FilterBar, type ReportView } from '@/components/reports/filter-bar'
import { cutoffText } from '@/components/reports/format'
import { PrintButton } from '@/components/reports/print-button'
import { ReportTabs } from '@/components/reports/report-tabs'
import { FiltersSkeleton } from '@/components/reports/skeletons'
import { PageHeader } from '@/components/shell/page-header'
import { ErrorNotice } from '@/components/ui/states'
import type { ReportOptions, ReportsError } from '@/lib/core/reports'

export const REPORTS_ERROR: Record<ReportsError, string> = {
  'solo-secretaria': 'Los reportes son solo para secretaría.',
  'persona-desconocida': 'No encontramos tus datos. Salí y volvé a entrar.',
  'falla-externa': 'No pudimos leer el padrón del SIU porque no responde. Probá de nuevo en un rato.'
}

const TITLES: Record<ReportView, string> = {
  tablero: 'Tablero de alumnos',
  alumnos: 'Listado de alumnos',
  seguimiento: 'Alumnos en seguimiento'
}

/** «Alumnos de grado al 13 nov» o «al cierre de 2021». */
export function subtitleOf(options: ReportOptions): string {
  const { year } = options.filters
  const cutoff = year === options.currentYear ? options.today : `${year}-12-31`
  return `Alumnos de grado ${cutoffText(year, cutoff)}`
}

export function ReportsFrame({
  view,
  options,
  children
}: {
  view: ReportView
  options: { ok: true; value: ReportOptions } | { ok: false; error: ReportsError }
  children: ReactNode
}) {
  const subtitle = options.ok ? subtitleOf(options.value) : 'Alumnos de grado'
  return (
    <>
      <PageHeader title='Reportes' subtitle={subtitle} art='academico' hideBackOnDesktop />
      <main data-print-root className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <div className='hidden print:block'>
          <p className='text-xl font-extrabold'>{TITLES[view]}</p>
          <p className='text-sm'>{subtitle}</p>
        </div>
        <div data-print='hide' className='flex flex-wrap items-center justify-between gap-3'>
          <ReportTabs active={view} filters={options.ok ? options.value.filters : null} />
          <div className='max-sm:hidden'>
            <PrintButton />
          </div>
        </div>
        {options.ok ? (
          <>
            <Suspense fallback={<FiltersSkeleton />}>
              <FilterBar options={options.value} filters={options.value.filters} view={view} />
            </Suspense>
            {children}
          </>
        ) : (
          <ErrorNotice>{REPORTS_ERROR[options.error]}</ErrorNotice>
        )}
      </main>
    </>
  )
}
