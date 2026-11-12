/* El enlace a la oferta de una materia: sus comisiones, o sus mesas de examen. */
import type { OpenEnrollment } from '@/lib/core/studies'

export function offerHref(subjectId: string, kind: OpenEnrollment['kind']): string {
  const subject = `/inscripciones/${encodeURIComponent(subjectId)}`
  return kind === 'examen' ? `${subject}/final` : subject
}
