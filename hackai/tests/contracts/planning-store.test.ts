/* Batería de contrato del almacén de Planning (el seam `PlanningStore`). La
   misma corre contra el almacén en memoria y contra una base de prueba de
   verdad solo si están HACKAI_TEST_SUPABASE_URL y
   HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/migrations/0013_planning.sql aplicada. Reemplazar borra todo el
   planning de la base de prueba: es la operación que se prueba. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { createMemoryPlanningStore } from '@/lib/adapters/memoria/planning-store'
import { createSupabasePlanningStore } from '@/lib/adapters/supabase/planning-store'
import type { PlanningEntryInput } from '@/lib/core/planning'
import type { PlanningStore } from '@/lib/core/planning/store'
import type { Result } from '@/lib/result'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const entry = (subject: string, overrides: Partial<PlanningEntryInput> = {}): PlanningEntryInput => ({
  subject,
  section: 'A',
  school: 'FI',
  campus: 'Pilar',
  building: 'Edificio Olivo',
  wing: 'Módulo A',
  room: 'Aula A9',
  weekday: 'lunes',
  date: null,
  start: 540,
  end: 780,
  cancelled: false,
  ...overrides
})

const withoutId = ({ id: _id, ...rest }: PlanningEntryInput & { id: string }) => rest
const bySubject = (a: PlanningEntryInput, b: PlanningEntryInput) => a.subject.localeCompare(b.subject)

function planningStoreContract(name: string, make: () => PlanningStore, skip: string | false = false) {
  const it = (title: string, fn: (store: PlanningStore) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, () => fn(make()))

  it('reemplaza todo el planning y lo lee de vuelta, con un id por clase', async (store) => {
    const first = [entry('Física I'), entry('Química', { weekday: null, date: '2026-11-13', cancelled: true })]
    assert.equal(value(await store.replace(first)), 2)
    const read = value(await store.entries())
    assert.deepEqual(read.map(withoutId).sort(bySubject), first)
    assert.equal(new Set(read.map((e) => e.id)).size, 2)

    assert.equal(value(await store.replace([entry('Termodinámica', { section: null, school: '' })])), 1)
    assert.deepEqual(value(await store.entries()).map(withoutId), [
      entry('Termodinámica', { section: null, school: '' })
    ])
  })

  it('suma clases sin tocar las que había y borra una por su id', async (store) => {
    value(await store.replace([entry('Física I')]))
    assert.equal(value(await store.add([entry('Química'), entry('Termodinámica')])), 2)
    const read = value(await store.entries())
    assert.deepEqual(read.map((e) => e.subject).sort(), ['Física I', 'Química', 'Termodinámica'])

    const quimica = read.find((e) => e.subject === 'Química')!
    assert.equal(value(await store.remove(quimica.id)), true)
    assert.equal(value(await store.remove(quimica.id)), false)
    assert.deepEqual(
      value(await store.entries())
        .map((e) => e.subject)
        .sort(),
      ['Física I', 'Termodinámica']
    )
  })
}

planningStoreContract('almacén en memoria', () => createMemoryPlanningStore())

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
planningStoreContract(
  'almacén de Supabase',
  () =>
    createSupabasePlanningStore({
      client: createClient(url ?? '', key ?? '', { auth: { persistSession: false, autoRefreshToken: false } })
    }),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)

/* Un cliente de Supabase de mentira para `replace`: anota cada pedido a `planning_entries` y falla el borrado de las
   cargas anteriores (`delete().neq('batch', …)`), para probar que la carga nueva se deshace. */
function failingDeleteClient() {
  const calls: string[] = []
  const builder = (op: string) => {
    const chain = {
      eq: (column: string, value: string) => {
        calls.push(`${op} ${column}=${value}`)
        return chain
      },
      neq: (column: string) => {
        calls.push(`${op} ${column}<>`)
        return { abortSignal: () => Promise.resolve({ data: null, error: { message: 'caída', code: '57P01' } }) }
      },
      abortSignal: () => Promise.resolve({ data: null, error: null })
    }
    return chain
  }
  const client = {
    from: () => ({
      insert: (rows: { batch: string }[]) => {
        calls.push(`insert batch=${rows[0].batch}`)
        return builder('insert')
      },
      delete: () => builder('delete')
    })
  }
  return { client: client as unknown as SupabaseClient, calls }
}

test('almacén de Supabase: si falla el borrado de lo anterior, la carga nueva se deshace y no quedan dos mezcladas', async () => {
  const { client, calls } = failingDeleteClient()
  const store = createSupabasePlanningStore({ client, log: () => {} })
  assert.deepEqual(await store.replace([entry('Física I')]), { ok: false, error: 'falla-externa' })
  const batch = calls[0].replace('insert batch=', '')
  assert.deepEqual(calls, [`insert batch=${batch}`, 'delete batch<>', `delete batch=${batch}`])
})
