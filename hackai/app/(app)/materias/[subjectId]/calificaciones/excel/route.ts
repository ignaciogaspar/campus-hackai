/* «Descargar Excel de la materia»: un .xlsx con una hoja por cada comisión del
   docente, con sus alumnos y sus calificaciones. Va en `/calificaciones/excel`
   porque `/calificaciones` es la pantalla. Quién lo puede bajar lo decide
   Seguimiento: un alumno o alguien de otra materia no recibe nada. */
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { gradesWorkbook } from '@/lib/grades-workbook'
import { XLSX_CONTENT_TYPE } from '@/lib/xlsx'

const plain = (text: string, status: number) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_request: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  const session = await requireSession()
  const { subjectId } = await params
  const result = await gradesWorkbook(system().coursework, session.personId, subjectId)
  if (!result.ok) {
    if (result.error === 'falla-externa') {
      return plain('No pudimos armar el Excel ahora. Probá de nuevo en un rato.', 502)
    }
    return plain('No encontramos esa materia entre las que dictás.', 404)
  }
  const { file, fileName } = result.value
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, no-store'
    }
  })
}
