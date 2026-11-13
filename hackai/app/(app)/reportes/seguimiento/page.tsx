/* Reportes › En seguimiento: los alumnos que la Dirección de Estudios marcó para
   acompañar, con su nota, en cualquier estado. Se marcan desde la ficha. Solo
   secretaría. */
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

export const metadata: Metadata = { title: 'En seguimiento · Reportes · Campus HackAI' }

async function FollowedData({
  personId,
  filters,
  list
}: {
  personId: PersonId
  filters: ReportFilters
  list: ListParams
}) {
  const page = await system().reports.students(personId, { ...filters, followed: true }, queryOf(list))
  if (!page.ok) return <ErrorNotice>{REPORTS_ERROR[page.error]}</ErrorNotice>
  return (
    <StudentsList
      page={page.value}
      list={list}
      path='/reportes/seguimiento'
      notes
      empty='Todavía no marcaste a nadie, o nadie coincide con los filtros. Desde la ficha de un alumno, «Seguir a este alumno» lo suma acá con una nota.'
    />
  )
}

export default async function FollowedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession('secretaria')
  const params = await searchParams
  const options = await system().reports.options(session.personId, filtersFromParams(params))
  const list = listFromParams(params)
  return (
    <ReportsFrame view='seguimiento' options={options}>
      {options.ok && (
        <Suspense key={paramsOf({ ...options.value.filters, ...list }).toString()} fallback={<ListSkeleton />}>
          <FollowedData personId={session.personId} filters={options.value.filters} list={list} />
        </Suspense>
      )}
    </ReportsFrame>
  )
}
