/* API de Storage de mentira para los chequeos de la base de la demo: un
   `fetch` que responde como Supabase Storage sobre buckets en memoria, sin
   red. Entiende lo que usan esos chequeos: ver un bucket
   (`GET /storage/v1/bucket/<id>`), listar sus objetos de a páginas
   (`POST /storage/v1/object/list/<id>`) y borrarlos
   (`DELETE /storage/v1/object/<id>` con `{ prefixes }`). Cualquier otro pedido
   es un 400, así un pedido con otra forma hace fallar el test. */
import { randomUUID } from 'node:crypto'

export type FakeBucket = { public: boolean; file_size_limit: number | null; objects: string[] }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const notFound = () => json({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }, 400)

export function createFakeStorage(buckets: Record<string, FakeBucket>) {
  const requests: string[] = []

  function list(id: string, body: { prefix: string; limit: number; offset: number }) {
    const bucket = buckets[id]
    if (!bucket) return notFound()
    const page = [...bucket.objects].sort().slice(body.offset, body.offset + body.limit)
    return json(page.map((name) => ({ name, id: randomUUID(), metadata: { size: 1 } })))
  }

  function remove(id: string, body: { prefixes: string[] }) {
    const bucket = buckets[id]
    if (!bucket) return notFound()
    const removed = body.prefixes.filter((name) => bucket.objects.includes(name))
    bucket.objects = bucket.objects.filter((name) => !removed.includes(name))
    return json(removed.map((name) => ({ name, bucket_id: id })))
  }

  function info(id: string) {
    const bucket = buckets[id]
    if (!bucket) return notFound()
    return json({ id, name: id, public: bucket.public, file_size_limit: bucket.file_size_limit })
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? 'GET'
    requests.push(`${method} ${url.pathname}`)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    const path = url.pathname.replace(/^\/storage\/v1\//, '')
    const [kind, action, id] = path.split('/').map(decodeURIComponent)
    if (method === 'GET' && kind === 'bucket' && action) return info(action)
    if (method === 'POST' && kind === 'object' && action === 'list' && id) return list(id, body)
    if (method === 'DELETE' && kind === 'object' && action && !id) return remove(action, body)
    return json({ statusCode: '400', error: 'pedido desconocido' }, 400)
  }

  return { fetch, buckets, requests }
}
