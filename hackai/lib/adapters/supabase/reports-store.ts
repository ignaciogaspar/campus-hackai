/* Almacén de Reportes sobre Supabase: los alumnos en seguimiento, en la tabla
   propia `reports_follow_ups` (supabase/migrations/0014_reports_follow_ups.sql).
   Se porta como el almacén en memoria y pasa la misma batería de contrato
   (tests/contracts/reports-store.test.ts). Cada consulta tiene tiempo máximo, y
   una caída o un error de la base vuelve como `falla-externa`. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type { FollowUp } from '@/lib/core/reports'
import type { ReportsStore } from '@/lib/core/reports/store'
import { fail, ok } from '@/lib/result'

export type SupabaseReportsStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

type FollowUpRow = { student_id: string; note: string; created_by: string; updated_at: string }

const COLUMNS = 'student_id, note, created_by, updated_at'

const toFollowUp = (row: FollowUpRow): FollowUp => ({
  studentId: row.student_id,
  note: row.note,
  by: row.created_by,
  at: new Date(row.updated_at).toISOString()
})

export function createSupabaseReportsStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabaseReportsStoreOptions): ReportsStore {
  const run = createQueryRunner({ name: 'reports-store', timeoutMs, log })

  return {
    async followUps() {
      const found = await run<FollowUpRow[]>('alumnos en seguimiento', (s) =>
        client.from('reports_follow_ups').select(COLUMNS).limit(10_000).abortSignal(s)
      )
      return found.ok ? ok((found.value ?? []).map(toFollowUp)) : fail('falla-externa')
    },

    async saveFollowUp(followUp) {
      const row = {
        student_id: followUp.studentId,
        note: followUp.note,
        created_by: followUp.by,
        updated_at: followUp.at
      }
      const saved = await run('guardar seguimiento', (s) =>
        client.from('reports_follow_ups').upsert(row, { onConflict: 'student_id' }).abortSignal(s)
      )
      return saved.ok ? ok(undefined) : fail('falla-externa')
    },

    async removeFollowUp(studentId) {
      const removed = await run<{ student_id: string }[]>('sacar del seguimiento', (s) =>
        client.from('reports_follow_ups').delete().eq('student_id', studentId).select('student_id').abortSignal(s)
      )
      return removed.ok ? ok((removed.value ?? []).length > 0) : fail('falla-externa')
    }
  }
}
