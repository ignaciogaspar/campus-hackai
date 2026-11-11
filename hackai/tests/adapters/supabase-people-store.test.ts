/* El almacén de Personas sobre Supabase sin base: cómo se porta cuando la base
   no responde. Lo que lee con la base andando lo prueba la batería de
   contrato (tests/contracts/people-store.test.ts). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createSupabasePeopleStore } from '@/lib/adapters/supabase/people-store'

function storeWith(fetch: typeof globalThis.fetch, timeoutMs = 1000) {
  const logs: string[] = []
  const client = createClient('http://people.test', 'clave-de-prueba', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch }
  })
  const store = createSupabasePeopleStore({ client, timeoutMs, log: (message) => logs.push(message) })
  return { store, logs }
}

test('si la base no responde a tiempo devuelve «falla externa» en vez de quedarse esperando', async () => {
  const { store, logs } = storeWith(() => new Promise<Response>(() => {}), 50)

  const started = Date.now()
  assert.deepEqual(await store.accountsOf('p-taguirre'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await store.ownerOf('siu', '30101'), { ok: false, error: 'falla-externa' })
  assert.ok(Date.now() - started < 1000)
  assert.equal(logs.length, 2)
})

test('si la red falla o la base responde con error devuelve «falla externa» sin tirar, y los logs no llevan ids', async () => {
  const sinRed = storeWith(async () => {
    throw new TypeError('fetch failed')
  }, 100)
  assert.deepEqual(await sinRed.store.accountsOf('p-taguirre'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await sinRed.store.ownerOf('discord', '1290000000000000011'), { ok: false, error: 'falla-externa' })

  const sinTabla = storeWith(
    async () => new Response(JSON.stringify({ code: '42P01', message: 'relation does not exist' }), { status: 404 })
  )
  assert.deepEqual(await sinTabla.store.accountsOf('p-taguirre'), { ok: false, error: 'falla-externa' })

  const logs = [...sinRed.logs, ...sinTabla.logs]
  assert.equal(logs.length, 3)
  assert.ok(logs.every((line) => !line.includes('p-taguirre') && !line.includes('1290000000000000011')))
})

test('si la base devuelve dos dueñas para el mismo id, no elige una: es «falla externa»', async () => {
  const { store } = storeWith(
    async () =>
      new Response(JSON.stringify([{ person_id: 'p-a' }, { person_id: 'p-b' }]), {
        headers: { 'content-type': 'application/json' }
      })
  )

  assert.deepEqual(await store.ownerOf('siu', '30101'), { ok: false, error: 'falla-externa' })
})
