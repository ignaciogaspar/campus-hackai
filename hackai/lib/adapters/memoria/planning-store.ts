/* Almacén de Planning en memoria. Arranca con las clases que se le pasen (el
   set sintético en la demo local). Se porta como el de Supabase y pasa la
   misma batería de contrato (tests/contracts/planning-store.test.ts). */
import { randomUUID } from 'node:crypto'
import type { PlanningEntry, PlanningEntryInput } from '@/lib/core/planning'
import type { PlanningStore } from '@/lib/core/planning/store'
import { ok } from '@/lib/result'

export function createMemoryPlanningStore(initial: PlanningEntryInput[] = []): PlanningStore {
  const withId = (entry: PlanningEntryInput): PlanningEntry => ({ ...structuredClone(entry), id: randomUUID() })
  let entries = initial.map(withId)

  return {
    async entries() {
      return ok(structuredClone(entries))
    },

    async replace(input) {
      entries = input.map(withId)
      return ok(input.length)
    },

    async add(input) {
      entries = [...entries, ...input.map(withId)]
      return ok(input.length)
    },

    async remove(id) {
      const before = entries.length
      entries = entries.filter((e) => e.id !== id)
      return ok(entries.length < before)
    }
  }
}
