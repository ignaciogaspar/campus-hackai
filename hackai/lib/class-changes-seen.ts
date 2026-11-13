/* Los cambios de clase en la campana y en Novedades: cuáles ya vio quien entró,
   para que la campana deje de contarlos. Como las notas vistas
   (lib/grades-seen.ts), va en una cookie por navegador y guarda la persona,
   porque en la demo varias entran desde el mismo navegador. Qué cambio hay lo
   decide Hoy (`classChanges`); acá solo se guarda y se lee qué vio. */
import type { PlanningClass } from '@/lib/core/planning'

export const CLASS_CHANGES_SEEN_COOKIE = 'hackai_cambios_vistos'

/** Lo que dura la cookie: más que la semana en que se avisa un cambio. */
export const CLASS_CHANGES_SEEN_MAX_AGE = 30 * 24 * 60 * 60

/** Cuántos cambios vistos guarda la cookie, para que no crezca: los más viejos se olvidan. */
const MAX_KEYS = 40

type ChangeId = Pick<PlanningClass, 'id' | 'change' | 'room' | 'start' | 'end'>

/** Un id corto y estable de un cambio: FNV-1a de 32 bits en base 36. Lleva el aula y el horario, así un cambio
    distinto de la misma clase vuelve a avisarse. */
export function changeKey(change: ChangeId): string {
  const text = [change.id, change.change ?? '', change.room, change.start, change.end].join('\u0000')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Los cambios que vio quien entró, si la cookie es suya; si no, ninguno. */
export function seenChangesFrom(value: string | undefined, personId: string): string[] {
  const [owner, keys] = value?.split('|') ?? []
  return owner === personId && keys ? keys.split('.').filter(Boolean) : []
}

/** El valor de la cookie con esos cambios vistos además de los que ya tenía. */
export function withSeenChanges(value: string | undefined, personId: string, keys: string[]): string {
  const all = [...new Set([...seenChangesFrom(value, personId), ...keys])]
  return `${personId}|${all.slice(-MAX_KEYS).join('.')}`
}

/** Los cambios sin los que ya vio. */
export function unseenChanges<T extends ChangeId>(changes: T[], seen: string[]): T[] {
  const keys = new Set(seen)
  return changes.filter((c) => !keys.has(changeKey(c)))
}
