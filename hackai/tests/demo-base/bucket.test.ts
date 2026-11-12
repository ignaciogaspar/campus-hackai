import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { emptyBucket } from '@/lib/demo-base/bucket'
import { createFakeStorage } from './fake-storage'

const client = (fetch: typeof globalThis.fetch) =>
  createClient('http://demo.test', 'clave-de-prueba', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch }
  })

test('vacía el bucket aunque tenga más archivos que una página, y dice cuántos borró', async () => {
  const objects = Array.from({ length: 250 }, () => randomUUID())
  const storage = createFakeStorage({ 'hackai-files': { public: false, file_size_limit: 10, objects } })

  const result = await emptyBucket(client(storage.fetch), 'hackai-files', { pageSize: 100 })

  assert.deepEqual(result, { ok: true, value: 250 })
  assert.deepEqual(storage.buckets['hackai-files'].objects, [])
})

test('vaciar un bucket que ya está vacío no es un error: correrlo dos veces da lo mismo', async () => {
  const storage = createFakeStorage({ 'hackai-files': { public: false, file_size_limit: 10, objects: [randomUUID()] } })

  assert.deepEqual(await emptyBucket(client(storage.fetch), 'hackai-files'), { ok: true, value: 1 })
  assert.deepEqual(await emptyBucket(client(storage.fetch), 'hackai-files'), { ok: true, value: 0 })
})

test('si el bucket no existe lo dice por su nombre, sin tirar', async () => {
  const storage = createFakeStorage({})

  const result = await emptyBucket(client(storage.fetch), 'hackai-files')

  assert.equal(result.ok, false)
  assert.match(!result.ok ? result.error : '', /hackai-files/)
})

test('si Storage no borra lo que lista, frena en vez de dar vueltas para siempre', async () => {
  const storage = createFakeStorage({ 'hackai-files': { public: false, file_size_limit: 10, objects: [randomUUID()] } })
  const stuck: typeof globalThis.fetch = (input, init) =>
    init?.method === 'DELETE'
      ? Promise.resolve(new Response('[]', { headers: { 'content-type': 'application/json' } }))
      : storage.fetch(input, init)

  const result = await emptyBucket(client(stuck), 'hackai-files')

  assert.equal(result.ok, false)
})
