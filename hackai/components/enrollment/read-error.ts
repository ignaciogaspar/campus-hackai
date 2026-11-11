/* Por qué una pantalla de inscripción no pudo leer del SIU, en palabras del
   alumno. `what` es lo que se quería traer: «las inscripciones», «las comisiones». */
import type { StudiesReadError } from '@/lib/core/studies'

export const UNKNOWN_PERSON_TEXT = 'No encontramos tus datos en el SIU.'

export function readErrorText(error: StudiesReadError, what: string): string {
  if (error === 'falla-externa') return `No pudimos traer ${what} del SIU. Probá de nuevo en un rato.`
  if (error === 'persona-desconocida') return UNKNOWN_PERSON_TEXT
  return `Algo salió mal al traer ${what}.`
}
