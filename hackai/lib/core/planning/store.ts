/* El almacén de Planning: las clases que cargó secretaría. Es el seam interno
   del módulo (hackai/docs/ARQUITECTURA.md): un adaptador de Supabase y otro en
   memoria, que pasan la misma batería de contrato (tests/contracts/planning-store.test.ts). */
import type { PlanningEntry, PlanningEntryInput } from '@/lib/core/planning'
import type { Result } from '@/lib/result'

export type PlanningStore = {
  /** Todo lo cargado, sin orden fijo. */
  entries(): Promise<Result<PlanningEntry[], 'falla-externa'>>
  /** Reemplaza todo lo cargado por estas clases. Si falla, queda lo que había. Devuelve cuántas guardó. */
  replace(entries: PlanningEntryInput[]): Promise<Result<number, 'falla-externa'>>
  /** Suma estas clases a lo cargado. Devuelve cuántas guardó. */
  add(entries: PlanningEntryInput[]): Promise<Result<number, 'falla-externa'>>
  /** Borra una clase. `false` si no existía. */
  remove(id: string): Promise<Result<boolean, 'falla-externa'>>
}
