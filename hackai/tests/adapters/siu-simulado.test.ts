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
    global: { fetch }
  })
  const siu = createSimulatedSiu({
    client,
    clock: createFixedClock(syntheticData.now),
    selfServiceBaseUrl: syntheticData.siu.selfServiceBaseUrl,
    timeoutMs,
    log: (message) => logs.push(message)
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
  const { siu, logs } = siuWith(async () => {
    throw new TypeError('fetch failed')
  })

  assert.deepEqual(await siu.courseEnrollments('30101', { historic: true }), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.sections({ subjectId: 'am1' }), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.enroll('30102', { kind: 'comision', sectionId: 'sec-pr1-fi-v' }), {
    ok: false,
    error: 'falla-externa'
  })
  assert.ok(
    logs.every((line) => !line.includes('30101') && !line.includes('30102')),
    'los logs no llevan ids de personas'
  )
})

test('lee cuándo se cargó cada nota, y `null` si la columna viene vacía', async () => {
  const tables: Record<string, unknown[]> = {
    siu_persons: [{ id: '30101' }],
    siu_provisional_results: [
      {
        id: 'ap-1',
        person_id: '30101',
        section_id: 'sec-am1-fi-a',
        assessment_id: 'ev-3',
        grade: '7',
        date: '2026-09-21T11:00:00+00:00',
        loaded_at: '2026-11-10T12:00:00+00:00'
      },
      {
        id: 'ap-2',
        person_id: '30101',
        section_id: 'sec-am1-fi-a',
        assessment_id: 'ev-4',
        grade: null,
        date: '2026-11-16T11:00:00+00:00',
        loaded_at: null
      }
    ]
  }
  const { siu } = siuWith(async (input) => {
    const table = new URL(String(input)).pathname.split('/').at(-1) ?? ''
    return new Response(JSON.stringify(tables[table] ?? []), { headers: { 'content-type': 'application/json' } })
  })

  const result = await siu.provisionalResults('30101')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.map((r) => [r.id, r.grade, r.loadedAt]),
    [
      ['ap-1', 7, '2026-11-10T12:00:00.000Z'],
      ['ap-2', null, null]
    ]
  )
})

test('si la base responde con error devuelve «falla externa»', async () => {
  const { siu } = siuWith(
    async () => new Response(JSON.stringify({ code: '42P01', message: 'relation does not exist' }), { status: 404 })
  )

  assert.deepEqual(await siu.subject('am1'), { ok: false, error: 'falla-externa' })
})
