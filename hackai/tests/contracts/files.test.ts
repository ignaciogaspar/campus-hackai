/* Batería de contrato del puerto de Archivos. La misma corre contra los
   archivos en memoria, contra Supabase Storage con una API de Storage de
   mentira (sin red), y contra un Supabase de prueba de verdad solo si están
   HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/migrations/0003_files.sql aplicada. Al final, cómo se porta el
   adaptador de Supabase cuando Storage no responde. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createSupabaseFiles, DEFAULT_BUCKET } from '@/lib/adapters/supabase/files'
import type { FilesPort } from '@/lib/ports/files'

const pdf = () => ({
  name: 'Resumen de derivadas (v2).pdf',
  contentType: 'application/pdf',
  bytes: new TextEncoder().encode('%PDF-1.4 resumen de derivadas')
})

function filesContract(
  name: string,
  make: () => { files: FilesPort; uploads: () => number },
  skip: string | false = false
) {
  const it = (title: string, fn: (made: ReturnType<typeof make>) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, () => fn(make()))

  it('guarda un archivo y lo devuelve con los mismos bytes y su tipo', async ({ files }) => {
    const file = pdf()
    const saved = await files.save(file)
    assert.ok(saved.ok)
    assert.equal(saved.value.name, file.name)
    assert.equal(saved.value.contentType, 'application/pdf')
    assert.equal(saved.value.size, file.bytes.byteLength)

    const read = await files.read(saved.value.id)
    assert.ok(read.ok)
    assert.deepEqual([...read.value.bytes], [...file.bytes])
    assert.equal(read.value.contentType, 'application/pdf')
    if (read.value.name !== undefined) assert.equal(read.value.name, file.name)
  })

  it('la URL es la ruta de la app, con el id y el nombre codificado', async ({ files }) => {
    const saved = await files.save(pdf())
    assert.ok(saved.ok)
    assert.match(saved.value.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    assert.equal(saved.value.url, `/archivos/${saved.value.id}/Resumen%20de%20derivadas%20(v2).pdf`)
  })

  it('cada archivo tiene su id, aunque se llame igual', async ({ files }) => {
    const first = await files.save(pdf())
    const second = await files.save({ ...pdf(), bytes: new TextEncoder().encode('otra versión') })
    assert.ok(first.ok && second.ok)
    assert.notEqual(first.value.id, second.value.id)
    const read = await files.read(first.value.id)
    assert.deepEqual(read.ok && [...read.value.bytes], [...pdf().bytes])
  })

  it('un archivo más grande que el máximo es «demasiado grande» y no sube nada', async ({ files, uploads }) => {
    const before = uploads()
    const big = { name: 'enorme.bin', contentType: 'application/octet-stream' }
    const result = await files.save({ ...big, bytes: new Uint8Array(files.capabilities.maxBytes + 1) })
    assert.deepEqual(result, { ok: false, error: 'demasiado-grande' })
    assert.equal(uploads(), before)
  })

  it('leer un id que no existe, o que no tiene forma de id, es «no encontrado»', async ({ files }) => {
    assert.deepEqual(await files.read(randomUUID()), { ok: false, error: 'no-encontrado' })
    assert.deepEqual(await files.read('../otro-bucket/secreto'), { ok: false, error: 'no-encontrado' })
  })

  it('borrar un archivo lo saca: leerlo después es «no encontrado», y los otros siguen', async ({ files }) => {
    const first = await files.save(pdf())
    const second = await files.save({ ...pdf(), bytes: new TextEncoder().encode('otra versión') })
    assert.ok(first.ok && second.ok)

    assert.deepEqual(await files.delete(first.value.id), { ok: true, value: null })

    assert.deepEqual(await files.read(first.value.id), { ok: false, error: 'no-encontrado' })
    assert.ok((await files.read(second.value.id)).ok)
  })

  it('borrar un id que no existe, o que no tiene forma de id, no es un error', async ({ files }) => {
    assert.deepEqual(await files.delete(randomUUID()), { ok: true, value: null })
    assert.deepEqual(await files.delete('../otro-bucket/secreto'), { ok: true, value: null })
    const saved = await files.save(pdf())
    assert.ok(saved.ok)
    assert.deepEqual(await files.delete(saved.value.id), { ok: true, value: null })
    assert.deepEqual(await files.delete(saved.value.id), { ok: true, value: null })
  })
}

/** API de Storage de mentira para un bucket: sube con POST y baja con GET
    `/storage/v1/object/<bucket>/<id>`, borra con DELETE
    `/storage/v1/object/<bucket>` y `{ prefixes: [ids] }` (como supabase-js), y
    responde como Storage cuando el objeto no existe. Cualquier otro pedido es un 400, así un pedido con otra
    forma hace fallar la batería. */
function fakeStorage(bucket: string) {
  const objects = new Map<string, { contentType: string; bytes: Uint8Array<ArrayBuffer> }>()
  let uploads = 0
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  async function upload(id: string, init: RequestInit | undefined) {
    uploads++
    const headers = new Headers(init?.headers)
    if (objects.has(id) || headers.get('x-upsert') !== 'false')
      return json({ statusCode: '409', error: 'Duplicate' }, 400)
    const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer())
    objects.set(id, { contentType: headers.get('content-type') ?? '', bytes })
    return json({ Id: randomUUID(), Key: `${bucket}/${id}` }, 200)
  }

  function download(id: string) {
    const object = objects.get(id)
    if (!object) return json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400)
    return new Response(object.bytes, { headers: { 'content-type': object.contentType } })
  }

  /** Como Storage, devuelve los objetos que borró: los que no existían no están. */
  async function remove(init: RequestInit | undefined) {
    const { prefixes } = JSON.parse(String(init?.body)) as { prefixes: string[] }
    const removed = prefixes.filter((id) => objects.delete(id))
    return json(
      removed.map((name) => ({ name, bucket_id: bucket })),
      200
    )
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (init?.method === 'DELETE' && url.pathname === `/storage/v1/object/${bucket}`) return remove(init)
    const prefix = `/storage/v1/object/${bucket}/`
    if (!url.pathname.startsWith(prefix)) return json({ statusCode: '400', error: 'pedido desconocido' }, 400)
    const id = decodeURIComponent(url.pathname.slice(prefix.length))
    const method = init?.method ?? 'GET'
    if (method === 'POST') return upload(id, init)
    if (method === 'GET') return download(id)
    return json({ statusCode: '400', error: 'método desconocido' }, 400)
  }

  return { fetch, uploads: () => uploads }
}

const supabaseClient = (url: string, key: string, fetch?: typeof globalThis.fetch) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(fetch ? { global: { fetch } } : {})
  })

filesContract('archivos en memoria', () => ({ files: createMemoryFiles(), uploads: () => 0 }))

filesContract('archivos en Supabase sin red', () => {
  const storage = fakeStorage(DEFAULT_BUCKET)
  const client = supabaseClient('http://files.test', 'clave-de-prueba', storage.fetch)
  return { files: createSupabaseFiles({ client }), uploads: storage.uploads }
})

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
filesContract(
  'archivos en Supabase',
  () => ({ files: createSupabaseFiles({ client: supabaseClient(url!, key!) }), uploads: () => 0 }),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)

function filesWith(fetch: typeof globalThis.fetch, timeoutMs = 1000) {
  const logs: string[] = []
  const client = supabaseClient('http://files.test', 'clave-de-prueba', fetch)
  return { files: createSupabaseFiles({ client, timeoutMs, log: (message) => logs.push(message) }), logs }
}

test('si Storage no responde a tiempo devuelve «falla externa» en vez de quedarse esperando', async () => {
  const { files, logs } = filesWith(() => new Promise<Response>(() => {}), 50)

  const started = Date.now()
  assert.deepEqual(await files.save(pdf()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await files.read(randomUUID()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await files.delete(randomUUID()), { ok: false, error: 'falla-externa' })
  assert.ok(Date.now() - started < 1000)
  assert.equal(logs.length, 3)
})

test('si la red falla o Storage responde con error devuelve «falla externa» sin tirar, y los logs no llevan nombres', async () => {
  const sinRed = filesWith(async () => {
    throw new TypeError('fetch failed')
  })
  assert.deepEqual(await sinRed.files.save(pdf()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await sinRed.files.read(randomUUID()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await sinRed.files.delete(randomUUID()), { ok: false, error: 'falla-externa' })

  const sinBucket = filesWith(
    async () =>
      new Response(JSON.stringify({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
  )
  assert.deepEqual(await sinBucket.files.save(pdf()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await sinBucket.files.read(randomUUID()), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await sinBucket.files.delete(randomUUID()), { ok: false, error: 'falla-externa' })

  const logs = [...sinRed.logs, ...sinBucket.logs]
  assert.equal(logs.length, 6)
  assert.ok(logs.every((line) => line.startsWith('[files] ') && !line.includes('derivadas')))
})
