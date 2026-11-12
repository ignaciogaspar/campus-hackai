import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET, POST } from '@/app/api/cron/sync/route'
import type { SyncReport } from '@/lib/core/spaces'
import { handlePeriodicSync } from '@/lib/periodic-sync'
import { fail, ok } from '@/lib/result'

const SECRET = 'secreto-de-prueba-0123456789'
const URL = 'http://localhost/api/cron/sync'

function request(authorization?: string) {
  return new Request(URL, { headers: authorization === undefined ? {} : { authorization } })
}

/** Una sincronización que cuenta cuántas veces la llamaron. */
function spySync(report: SyncReport = { channels: 3, imported: 5, sent: 2, pending: 1 }) {
  const calls = { count: 0 }
  const syncAll = async () => {
    calls.count++
    return ok(report)
  }
  return { syncAll, calls }
}

test('sin el secreto en el pedido responde «no autorizado» y no sincroniza', async () => {
  const { syncAll, calls } = spySync()

  const response = await handlePeriodicSync(request(), { secret: SECRET, syncAll, log: () => {} })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'no-autorizado' })
  assert.equal(calls.count, 0)
})

test('con el secreto correcto sincroniza todos los espacios y devuelve el resumen', async () => {
  const { syncAll, calls } = spySync({ channels: 3, imported: 5, sent: 2, pending: 1 })

  const response = await handlePeriodicSync(request(`Bearer ${SECRET}`), { secret: SECRET, syncAll, log: () => {} })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { channels: 3, imported: 5, sent: 2, pending: 1 })
  assert.equal(calls.count, 1)
})

test('con otro secreto, o con el secreto sin «Bearer», responde «no autorizado» y no sincroniza', async () => {
  const { syncAll, calls } = spySync()

  for (const authorization of [`Bearer ${SECRET}x`, 'Bearer otro', SECRET, `Basic ${SECRET}`, 'Bearer ']) {
    const response = await handlePeriodicSync(request(authorization), { secret: SECRET, syncAll, log: () => {} })
    assert.equal(response.status, 401, authorization)
  }
  assert.equal(calls.count, 0)
})

test('si falta CRON_SECRET en el entorno la ruta queda cerrada y avisa que no está configurada', async () => {
  const { syncAll, calls } = spySync()
  const logs: string[] = []

  for (const secret of [undefined, '', '  ']) {
    const response = await handlePeriodicSync(request('Bearer '), { secret, syncAll, log: (m) => logs.push(m) })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'sin-configurar' })
  }
  assert.equal(calls.count, 0)
  assert.match(logs[0], /CRON_SECRET/)
})

test('si el almacén de Espacios no responde, devuelve 502 con el error, sin romper', async () => {
  const logs: string[] = []

  const response = await handlePeriodicSync(request(`Bearer ${SECRET}`), {
    secret: SECRET,
    syncAll: async () => fail('falla-externa'),
    log: (m) => logs.push(m)
  })

  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), { error: 'falla-externa' })
  assert.deepEqual(logs, ['[corrida-periodica] falla-externa'])
})

test('ni la respuesta ni el log llevan el secreto ni lo que trajo el pedido', async () => {
  const logs: string[] = []
  const log = (m: string) => logs.push(m)
  const { syncAll } = spySync()

  const bodies = await Promise.all(
    [`Bearer ${SECRET}`, 'Bearer adivinanza-123'].map(async (authorization) => {
      const response = await handlePeriodicSync(request(authorization), { secret: SECRET, syncAll, log })
      return response.text()
    })
  )

  for (const text of [...bodies, ...logs]) {
    assert.doesNotMatch(text, /secreto-de-prueba|adivinanza/)
  }
  assert.deepEqual(logs, ['[corrida-periodica] ok: 3 canales, 5 importados, 2 enviados, 1 pendientes'])
})

// La ruta de verdad, con el sistema armado sobre los adaptadores en memoria.

test('la ruta toma el secreto de CRON_SECRET y sincroniza los canales vinculados', async () => {
  process.env.CRON_SECRET = SECRET
  try {
    assert.equal((await GET(request())).status, 401)
    assert.equal((await GET(request('Bearer otro'))).status, 401)

    const get = await GET(request(`Bearer ${SECRET}`))
    const post = await POST(request(`Bearer ${SECRET}`))

    // En memoria arranca sin canales vinculados: no hay nada que sincronizar.
    const nothing = { channels: 0, imported: 0, sent: 0, pending: 0 }
    assert.deepEqual([get.status, await get.json()], [200, nothing])
    assert.deepEqual([post.status, await post.json()], [200, nothing])
  } finally {
    delete process.env.CRON_SECRET
  }
})
