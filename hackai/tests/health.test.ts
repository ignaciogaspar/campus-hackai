import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from '@/app/api/health/route'
import { compose } from '@/lib/composition'
import { healthResponse } from '@/lib/health'

test('si el sistema se arma, la salud responde ok', async () => {
  const response = healthResponse(() => compose({}), { log: () => {} })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('si el sistema no se puede armar, la salud deja de responder ok y el log nombra la variable, nunca un valor', async () => {
  const logs: string[] = []
  const env = { HACKAI_SIU: 'simulado', SUPABASE_SERVICE_ROLE_KEY: 'clave-que-no-se-muestra' }

  const response = healthResponse(() => compose(env), { log: (line) => logs.push(line) })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { status: 'error', reason: 'configuracion' })
  assert.equal(logs.length, 1)
  assert.match(logs[0], /NEXT_PUBLIC_SUPABASE_URL/)
  assert.doesNotMatch(logs[0], /clave-que-no-se-muestra/)
})

test('la ruta de salud responde ok sin variables de entorno, como en la prueba de humo de CI', async () => {
  const response = GET()

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
