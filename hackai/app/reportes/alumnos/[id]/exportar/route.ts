/* Exportar la ficha de un alumno a CSV, al cierre del año del reporte
   (`?anio=`). Solo secretaría: Reportes lo decide. */
import { studentIdFrom } from '@/components/reports/params'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { CSV_CONTENT_TYPE, studentCsv } from '@/lib/reports-csv'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response('Iniciá sesión para exportar.', { status: 401 })
  const studentId = studentIdFrom((await params).id)
  if (studentId === null) return new Response('No pudimos armar la ficha.', { status: 404 })
  const year = Number(new URL(request.url).searchParams.get('anio')) || undefined
  const report = await system().reports.student(session.personId, studentId, year)
  if (!report.ok) {
    const status = report.error === 'solo-secretaria' ? 403 : report.error === 'falla-externa' ? 503 : 404
    return new Response('No pudimos armar la ficha.', { status })
  }
  return new Response(studentCsv(report.value), {
    headers: {
      'Content-Type': CSV_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="ficha-${report.value.profile.id}-${report.value.year}.csv"`,
      'Cache-Control': 'private, no-store'
    }
  })
}
