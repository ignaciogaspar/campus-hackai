/* Almacén de Reportes en memoria: los alumnos en seguimiento. Se porta como el
   de Supabase y pasa la misma batería de contrato
   (tests/contracts/reports-store.test.ts). */
import type { FollowUp } from '@/lib/core/reports'
import type { ReportsStore } from '@/lib/core/reports/store'
import { ok } from '@/lib/result'

export function createMemoryReportsStore(initial: FollowUp[] = []): ReportsStore {
  const followUps = new Map(initial.map((f) => [f.studentId, { ...f }]))
  return {
    async followUps() {
      return ok([...followUps.values()].map((f) => ({ ...f })))
    },

    async saveFollowUp(followUp) {
      followUps.set(followUp.studentId, { ...followUp })
      return ok(undefined)
    },

    async removeFollowUp(studentId) {
      return ok(followUps.delete(studentId))
    }
  }
}
