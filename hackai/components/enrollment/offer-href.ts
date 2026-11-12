/* El enlace a la oferta de una materia en Inscripciones: sus comisiones, en la
   pestaña de materias, o sus mesas, en la de exámenes. Una actividad con
   créditos se inscribe como una cursada. */
import type { OpenEnrollment } from '@/lib/core/studies'

export function offerHref(subjectId: string, kind: OpenEnrollment['kind']): string {
  const params = new URLSearchParams()
  if (kind === 'examen') params.set('tab', 'examenes')
  params.set('materia', subjectId)
  return `/inscripciones?${params}`
}
