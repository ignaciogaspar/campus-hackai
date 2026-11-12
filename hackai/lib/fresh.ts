/* Lecturas que toleran caídas: lo último leído de un sistema de origen, con la
   hora de la lectura y si quedó desactualizado porque el sistema no respondió
   (ARQUITECTURA.md, «Lecturas que toleran caídas»). */
import type { Result } from '@/lib/result'

export type Fresh<T> = { data: T; readAt: string; stale: boolean }

/** La hora de la lectura más vieja entre las que vinieron desactualizadas, o `null`. */
export function staleSince(reads: Result<Fresh<unknown>, string>[]): string | null {
  return reads.flatMap((r) => (r.ok && r.value.stale ? [r.value.readAt] : [])).sort()[0] ?? null
}
