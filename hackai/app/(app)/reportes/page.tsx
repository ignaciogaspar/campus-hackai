/* Reportes: el tablero de alumnos de grado para la Dirección de Estudios, solo
   secretaría. Activos, ingresantes, graduados y bajas con filtros libres (varias
   facultades, carreras, sedes y cohortes, al cierre de cualquier año), por
   facultad, por año, por cohorte, por avance y por créditos de Vida
   Universitaria. Los filtros viven en la URL. Sin reglas de negocio: los
   números los cuenta Reportes. */
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DashboardScreen } from '@/components/reports/dashboard'
import { REPORTS_ERROR, ReportsFrame } from '@/components/reports/frame'
import { filtersFromParams, paramsOf, type SearchParams } from '@/components/reports/params'
import { DashboardSkeleton } from '@/components/reports/skeletons'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PersonId } from '@/lib/core/people'
import type { ReportFilters } from '@/lib/core/reports'

export const metadata: Metadata = { title: 'Reportes · Campus HackAI' }

async function DashboardData({ personId, filters }: { personId: PersonId; filters: ReportFilters }) {
  const view = await system().reports.dashboard(personId, filters)
  if (!view.ok) return <ErrorNotice>{REPORTS_ERROR[view.error]}</ErrorNotice>
  return <DashboardScreen view={view.value} />
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession('secretaria')
  const options = await system().reports.options(session.personId, filtersFromParams(await searchParams))
  return (
    <ReportsFrame view='tablero' options={options}>
      {options.ok && (
        // La key nueva con cada filtro vuelve a mostrar la forma mientras se cuenta.
        <Suspense key={paramsOf(options.value.filters).toString()} fallback={<DashboardSkeleton />}>
          <DashboardData personId={session.personId} filters={options.value.filters} />
        </Suspense>
      )}
    </ReportsFrame>
  )
}
