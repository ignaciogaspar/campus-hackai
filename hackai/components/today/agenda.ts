/* A dónde lleva una fecha de Hoy y cómo se dice qué es y a qué hora. Qué es
   un parcial, qué pasó y cuál es el próximo lo decide Hoy; cómo se ubica en la
   semana, calendar-layout.ts. */
import { taskHref } from '@/components/coursework/format'
import { timeOf } from '@/components/dates'
import { offerHref } from '@/components/enrollment/offer-href'
import { spaceHref } from '@/components/spaces/format'
import type { Role } from '@/lib/core/people'
import type { UpcomingItem } from '@/lib/core/studies'
import { HACKAI_TASK_PREFIX } from '@/lib/core/today'
import { dayKey } from '@/lib/dates'

/** A dónde lleva una fecha: una tarea de HackAI, a la tarea, donde se entrega. Al docente, un parcial o una mesa
    lo llevan a la semana de esa fecha en el Calendario: el espacio de la materia no dice nada de esa fecha, y
    una mesa puede ser de una materia que dictó otro período. Al alumno, al espacio de su materia si tiene
    comisión; si no (un final que rinde libre), a la mesa, donde ve su inscripción. */
export function dateHref(item: UpcomingItem, viewer: Role): string | undefined {
  if (item.source === 'hackai') return taskHref(item.subjectId, item.id.slice(HACKAI_TASK_PREFIX.length))
  if (viewer === 'profesor') return `/calendario?semana=${dayKey(item.date)}`
  if (item.hasSection) return spaceHref(item.subjectId)
  return item.kind === 'final' ? offerHref(item.subjectId, 'examen') : undefined
}

const KIND: Record<UpcomingItem['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  tp: 'Trabajo práctico',
  final: 'Final',
  entrega: 'Entrega'
}

/** Cómo puede aparecer cada tipo en el nombre de la fecha: si ya está, no se repite. */
const IN_NAME: Record<Exclude<UpcomingItem['kind'], 'entrega'>, RegExp> = {
  parcial: /parcial/i,
  recuperatorio: /recuperatorio/i,
  tp: /\btp\b|trabajo práctico/i,
  final: /final/i
}

/** Qué es y a qué hora, con el lugar si el SIU lo da: «Parcial · 08:00», o «08:00 · Campus Pilar, aula 12» si el
    nombre ya dice qué es («Final», «Segundo parcial»). Una entrega: «Entrega · vence 23:59». */
export function whatAndWhen(item: UpcomingItem): string {
  const time = timeOf(item.date)
  if (item.kind === 'entrega') return `Entrega · vence ${time}`
  const kind = IN_NAME[item.kind].test(item.name) ? null : KIND[item.kind]
  return [kind, time, item.location].filter(Boolean).join(' · ')
}
