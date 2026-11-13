/* Reportes › Alumnos: el listado con los filtros del tablero más estado e
   indicadores de riesgo, buscable, ordenable y paginado, para exportar a CSV.
   A cada alumno se llega a su ficha. Solo secretaría. */
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { REPORTS_ERROR, ReportsFrame } from '@/components/reports/frame'
import {
  filtersFromParams,
  type ListParams,
  listFromParams,
  paramsOf,
  queryOf,
  type SearchParams
} from '@/components/reports/params'
import { ListSkeleton } from '@/components/reports/skeletons'
import { StudentsList } from '@/components/reports/students-list'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PersonId } from '@/lib/core/people'
import type { ReportFilters } from '@/lib/core/reports'

export const metadata: Metadata = { title: 'Alumnos · Reportes · Campus HackAI' }

async function ListData({ personId, filters, list }: { personId: PersonId; filters: ReportFilters; list: ListParams }) {
  const page = await system().reports.students(personId, filters, queryOf(list))
  if (!page.ok) return <ErrorNotice>{REPORTS_ERROR[page.error]}</ErrorNotice>
  return (
    <StudentsList
      page={page.value}
      list={list}
      path='/reportes/alumnos'
      empty='Probá con otra búsqueda, otro estado u otro año del reporte, o sacá algún filtro.'
    />
  )
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession('secretaria')
  const params = await searchParams
  const options = await system().reports.options(session.personId, filtersFromParams(params))
  const list = listFromParams(params)
  return (
    <ReportsFrame view='alumnos' options={options}>
      {options.ok && (
        <Suspense key={paramsOf({ ...options.value.filters, ...list }).toString()} fallback={<ListSkeleton />}>
          <ListData personId={session.personId} filters={options.value.filters} list={list} />
        </Suspense>
      )}
    </ReportsFrame>
  )
}
