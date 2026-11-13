/* A dónde lleva una fecha de Hoy. Qué es un parcial, qué pasó y cuál es el
   próximo lo decide Hoy; cómo se ubica en la semana, calendar-layout.ts. */
import { taskHref } from '@/components/coursework/format'
import { offerHref } from '@/components/enrollment/offer-href'
import { spaceHref } from '@/components/spaces/format'
import type { Role } from '@/lib/core/people'
import type { UpcomingItem } from '@/lib/core/studies'
import { HACKAI_TASK_PREFIX } from '@/lib/core/today'

/** A dónde lleva una fecha: una tarea de HackAI, a la tarea, donde se entrega; el resto, al espacio de su materia
    si la persona tiene comisión. Si no (un final que rinde libre), el alumno va a la mesa, donde ve su
    inscripción; el docente, a ningún lado. */
export function dateHref(item: UpcomingItem, viewer: Role): string | undefined {
  if (item.source === 'hackai') return taskHref(item.subjectId, item.id.slice(HACKAI_TASK_PREFIX.length))
  if (item.hasSection) return spaceHref(item.subjectId)
  return viewer === 'alumno' && item.kind === 'final' ? offerHref(item.subjectId, 'examen') : undefined
}
