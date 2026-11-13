/* Almacén de Cursada en memoria. Arranca vacío. Se porta como el de Supabase y
   pasa la misma batería de contrato (tests/contracts/studies-store.test.ts). */
import type { StoredClass, StudiesStore } from '@/lib/core/studies/store'
import { ok } from '@/lib/result'

export function createMemoryStudiesStore(): StudiesStore {
  const classes = new Map<string, StoredClass>()
  const keyOf = (sectionId: string, classAt: string) => `${sectionId}\u0000${classAt}`
  const copy = <T>(value: T): T => structuredClone(value)
  const byClassAt = (a: StoredClass, b: StoredClass) => a.classAt.localeCompare(b.classAt)

  return {
    async classAt(sectionId, classAt) {
      const found = classes.get(keyOf(sectionId, classAt))
      return ok(found ? copy(found) : null)
    },

    async classesOf(sectionIds) {
      return ok(copy([...classes.values()].filter((c) => sectionIds.includes(c.sectionId)).sort(byClassAt)))
    },

    async classesAbsent(siuId) {
      return ok(copy([...classes.values()].filter((c) => c.absent.includes(siuId)).sort(byClassAt)))
    },

    async pending() {
      return ok(copy([...classes.values()].filter((c) => c.pase === 'pendiente').sort(byClassAt)))
    },

    async saveClass(input) {
      const saved: StoredClass = { ...copy(input), absent: [...new Set(input.absent)], pase: 'pendiente', paseAt: null }
      classes.set(keyOf(input.sectionId, input.classAt), saved)
      return ok(copy(saved))
    },

    async setPase(sectionId, classAt, pase, paseAt) {
      const found = classes.get(keyOf(sectionId, classAt))
      if (found) {
        found.pase = pase
        found.paseAt = paseAt
      }
      return ok(null)
    }
  }
}
