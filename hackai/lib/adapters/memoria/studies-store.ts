/* Almacén de Cursada en memoria. Arranca vacío. Se porta como el de Supabase y
   pasa la misma batería de contrato (tests/contracts/studies-store.test.ts). */
import type { StoredClass, StudiesStore } from '@/lib/core/studies/store'
import { ok } from '@/lib/result'

export function createMemoryStudiesStore(): StudiesStore {
  const classes = new Map<string, StoredClass>()
  const zoom = new Map<string, string>()
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
      return ok(copy([...classes.values()].filter((c) => c.pass === 'pendiente').sort(byClassAt)))
    },

    async saveClass(input) {
      const saved: StoredClass = {
        ...copy(input),
        absent: [...new Set(input.absent)],
        pass: 'pendiente',
        passedAt: null
      }
      classes.set(keyOf(input.sectionId, input.classAt), saved)
      return ok(copy(saved))
    },

    async setPass(sectionId, classAt, pass, passedAt) {
      const found = classes.get(keyOf(sectionId, classAt))
      if (found) {
        found.pass = pass
        found.passedAt = passedAt
      }
      return ok(null)
    },

    async zoomLinks(sectionIds) {
      const found = sectionIds.flatMap((id) => {
        const url = zoom.get(id)
        return url ? [[id, url] as const] : []
      })
      return ok(Object.fromEntries(found))
    },

    async setZoomLink(sectionId, url) {
      if (url === null) zoom.delete(sectionId)
      else zoom.set(sectionId, url)
      return ok(null)
    }
  }
}
