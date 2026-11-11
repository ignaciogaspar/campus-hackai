/* El SIU simulado sin base: cómo se porta cuando la base no responde. Lo que
   lee y escribe con la base andando lo prueba la batería de contrato
   (tests/contracts/siu.test.ts), que necesita una base de prueba. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createSimulatedSiu } from '@/lib/adapters/siu-simulado'
import { syntheticData } from '@/lib/adapters/synthetic-data'

function siuWith(fetch: typeof globalThis.fetch, timeoutMs = 1000) {
  const logs: string[] = []
  const client = createClient('http://siu-simulado.test', 'clave-de-prueba', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  })
  const siu = createSimulatedSiu({
    client,
    clock: createFixedClock(syntheticData.now),
    selfServiceBaseUrl: syntheticData.siu.selfServiceBaseUrl,
    timeoutMs,
    log: (message) => logs.push(message),
  })
  return { siu, logs }
}

test('declara que puede inscribir y que tiene cronograma', () => {
  const { siu } = siuWith(async () => new Response('[]'))
  assert.deepEqual(siu.capabilities, { canEnroll: true, hasAssessmentSchedule: true, enrolsInClassroom: false })
})

test('si la base no responde a tiempo devuelve «falla externa» en vez de quedarse esperando', async () => {
  const { siu, logs } = siuWith(() => new Promise<Response>(() => {}), 50)

  const started = Date.now()
  assert.deepEqual(await siu.person('30101'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.terms(), { ok: false, error: 'falla-externa' })
  assert.ok(Date.now() - started < 1000)
  assert.equal(logs.length, 2)
})

test('si la red falla, cada operación devuelve «falla externa» sin tirar', async () => {
  const { siu, logs } = siuWith(async () => { throw new TypeError('fetch failed') })

  assert.deepEqual(await siu.courseEnrollments('30101', { historic: true }), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.sections({ subjectId: 'am1' }), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.enroll('30102', { kind: 'comision', sectionId: 'sec-pr1-fi-v' }), { ok: false, error: 'falla-externa' })
  assert.ok(logs.every((line) => !line.includes('30101') && !line.includes('30102')), 'los logs no llevan ids de personas')
})

test('si la base responde con error devuelve «falla externa»', async () => {
  const { siu } = siuWith(async () => new Response(JSON.stringify({ code: '42P01', message: 'relation does not exist' }), { status: 404 }))

  assert.deepEqual(await siu.subject('am1'), { ok: false, error: 'falla-externa' })
})
