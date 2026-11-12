/* El id de la materia del segmento `[materia]` de las ofertas de comisiones y
   de mesas. Un `%` mal formado no es una materia: 404. */
import { notFound } from 'next/navigation'

export function subjectIdFrom(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    notFound()
  }
}
