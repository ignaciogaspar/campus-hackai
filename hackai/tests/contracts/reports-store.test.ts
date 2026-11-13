/* Batería de contrato del almacén de Reportes (el seam `ReportsStore`): los
   alumnos en seguimiento. La misma corre contra el almacén en memoria y contra
   una base de prueba de verdad solo si están HACKAI_TEST_SUPABASE_URL y
   HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/migrations/0014_reports_follow_ups.sql aplicada. Usa legajos de
   prueba que no existen en el padrón y los borra al terminar. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createMemoryReportsStore } from '@/lib/adapters/memoria/reports-store'
import { createSupabaseReportsStore } from '@/lib/adapters/supabase/reports-store'
import type { FollowUp } from '@/lib/core/reports'
import type { ReportsStore } from '@/lib/core/reports/store'
import type { Result } from '@/lib/result'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const followUp = (studentId: string, note: string, at = '2026-11-10T15:00:00.000Z'): FollowUp => ({
  studentId,
  note,
  by: 'p-secretaria-fi',
  at
})

const mine = (list: FollowUp[]) =>
  list.filter((f) => f.studentId.startsWith('test-')).sort((a, b) => a.studentId.localeCompare(b.studentId))

function reportsStoreContract(name: string, make: () => ReportsStore, skip: string | false = false) {
  const it = (title: string, fn: (store: ReportsStore) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, async () => {
      const store = make()
      try {
        await fn(store)
      } finally {
        await store.removeFollowUp('test-1')
        await store.removeFollowUp('test-2')
      }
    })

  it('guarda un alumno en seguimiento por legajo y lo lee de vuelta', async (store) => {
    value(await store.saveFollowUp(followUp('test-1', 'Pidió beca')))
    value(await store.saveFollowUp(followUp('test-2', '')))
    assert.deepEqual(mine(value(await store.followUps())), [followUp('test-1', 'Pidió beca'), followUp('test-2', '')])
  })

  it('guardarlo de nuevo cambia la nota y la fecha: uno solo por legajo', async (store) => {
    value(await store.saveFollowUp(followUp('test-1', 'Pidió beca')))
    value(await store.saveFollowUp(followUp('test-1', 'Le dieron la beca', '2026-11-12T15:00:00.000Z')))
    assert.deepEqual(mine(value(await store.followUps())), [
      followUp('test-1', 'Le dieron la beca', '2026-11-12T15:00:00.000Z')
    ])
  })

  it('sacarlo dice si estaba', async (store) => {
    value(await store.saveFollowUp(followUp('test-1', 'Pidió beca')))
    assert.equal(value(await store.removeFollowUp('test-1')), true)
    assert.equal(value(await store.removeFollowUp('test-1')), false)
    assert.deepEqual(mine(value(await store.followUps())), [])
  })
}

reportsStoreContract('almacén en memoria', () => createMemoryReportsStore())

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
reportsStoreContract(
  'almacén de Supabase',
  () =>
    createSupabaseReportsStore({
      client: createClient(url ?? '', key ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
    }),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)
