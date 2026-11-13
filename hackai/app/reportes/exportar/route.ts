/* Exportar el listado de Reportes a CSV, con los mismos filtros, búsqueda y
   orden que la pantalla (los parámetros de la URL) y sin paginar. Con
   `seguimiento=si`, solo los alumnos en seguimiento. Va en `/reportes/exportar`
   porque `/reportes` es la pantalla. Solo secretaría: Reportes lo decide. */
import { filtersFromParams, listFromParams } from '@/components/reports/params'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { CSV_CONTENT_TYPE, studentsCsv } from '@/lib/reports-csv'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return new Response('Iniciá sesión para exportar.', { status: 401 })
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const followed = params.seguimiento === 'si'
  const list = listFromParams(params)
  const page = await system().reports.students(
    session.personId,
    { ...filtersFromParams(params), followed },
    { search: list.search, sort: list.sort, order: list.order, all: true }
  )
  if (!page.ok) {
    const status = page.error === 'solo-secretaria' ? 403 : page.error === 'falla-externa' ? 503 : 404
    return new Response('No pudimos armar el listado.', { status })
  }
  const name = `${followed ? 'seguimiento' : 'alumnos'}-${page.value.filters.year}.csv`
  return new Response(studentsCsv(page.value.rows), {
    headers: {
      'Content-Type': CSV_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store'
    }
  })
}
