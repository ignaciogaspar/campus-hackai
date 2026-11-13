/* Batería de contrato del almacén de Planning (el seam `PlanningStore`). La
   misma corre contra el almacén en memoria y contra una base de prueba de
   verdad solo si están HACKAI_TEST_SUPABASE_URL y
   HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/migrations/0013_planning.sql aplicada. Reemplazar borra todo el
   planning de la base de prueba: es la operación que se prueba. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
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
  building: 'Pilar - Edificio Olivo',
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
