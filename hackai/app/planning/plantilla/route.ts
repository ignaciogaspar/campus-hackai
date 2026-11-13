/* La planilla de ejemplo del Planning, en .xlsx: el encabezado con las columnas
   que se reconocen y tres filas de muestra (una semanal, un cambio de aula de
   un día y una clase suspendida). Secretaría la descarga, la completa y la sube
   en /cargar-clases. */

import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { XLSX_CONTENT_TYPE, xlsxFile } from '@/lib/xlsx'

const SAMPLE = [
  ['Análisis Matemático I', 'A', 'FI', 'Pilar - Edificio Olivo', 'Aula A9', 'lunes', '', '9:00', '13:00', ''],
  ['Análisis Matemático I', 'A', 'FI', 'Pilar - Edificio Olivo', 'Aula A10', '', '16/11/2026', '9:00', '13:00', ''],
  ['Física I', 'B', 'FI', 'Pilar - Edificio Olivo', 'Laboratorio 2', '', '18/11/2026', '14:00', '17:00', 'suspendida']
]

export async function GET() {
  if (!(await getSession())) return new Response('Iniciá sesión para descargar la planilla.', { status: 401 })
  const file = xlsxFile([{ name: 'Clases', rows: [system().planning.columns.map((c) => c.header), ...SAMPLE] }])
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': 'attachment; filename="planning-clases.xlsx"',
      'Cache-Control': 'no-store'
    }
  })
}
