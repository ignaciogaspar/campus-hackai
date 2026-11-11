/* Por qué una pantalla de inscripción no pudo leer del SIU, en palabras del
   alumno. `what` es lo que se quería traer: «las inscripciones», «las comisiones». */
import type { StudiesReadError } from '@/lib/core/studies'

export function readErrorText(error: StudiesReadError, what: string): string {
  if (error === 'falla-externa') return `No pudimos traer ${what} del SIU. Probá de nuevo en un rato.`
  if (error === 'persona-desconocida') return 'No encontramos tus datos en el SIU.'
  return `Algo salió mal al traer ${what}.`
}
