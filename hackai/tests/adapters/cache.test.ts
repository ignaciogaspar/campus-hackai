/* La caché de lecturas del SIU y del aula: lo fijo se guarda unos minutos, lo
   que cambia al inscribirse solo se comparte mientras está en vuelo, un error
   no se guarda y escribir pasa directo. Que con caché el SIU se porta igual lo
   cubre que solo envuelve: cada lectura devuelve lo mismo que el adaptador. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CLASSROOM_TTL_MS,
  MAX_ENTRIES,
  STATIC_TTL_MS,
  withClassroomCache,
  withPeopleStoreCache,
  withSiuCache
} from '@/lib/adapters/cache'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type { SiuPort } from '@/lib/ports/siu'
import { fail, ok } from '@/lib/result'

const TOMAS_SIU = syntheticData.people.find((p) => p.id === 'p-taguirre')!.siuId

/** El SIU en memoria, contando cuántas veces se llama cada lectura. */
function counted(overrides: Partial<SiuPort> = {}) {
  const base = { ...createMemorySiu(syntheticData, createFixedClock(syntheticData.now)), ...overrides }
  const calls = new Map<string, number>()
  const spy = Object.fromEntries(
    Object.entries(base).map(([name, value]) => [
      name,
      typeof value === 'function'
        ? (...args: unknown[]) => {
            calls.set(name, (calls.get(name) ?? 0) + 1)
            return (value as (...a: unknown[]) => unknown)(...args)
          }
        : value
    ])
  ) as SiuPort
  return { spy, calls }
}

function clock() {
  let now = 0
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

test('lo fijo se lee una vez y vuelve a leerse cuando vence', async () => {
  const { spy, calls } = counted()
  const time = clock()
  const siu = withSiuCache(spy, time)

  const first = await siu.subject('am1')
  const second = await siu.subject('am1')
  assert.deepEqual(second, first)
  assert.equal(calls.get('subject'), 1)

  await siu.subject('aga')
  assert.equal(calls.get('subject'), 2, 'otra materia es otra lectura')

  time.advance(STATIC_TTL_MS)
  await siu.subject('am1')
  assert.equal(calls.get('subject'), 3)
})

test('lo que cambia al inscribirse solo se comparte mientras está en vuelo', async () => {
  const { spy, calls } = counted()
  const siu = withSiuCache(spy, clock())

  const [a, b] = await Promise.all([siu.history(TOMAS_SIU), siu.history(TOMAS_SIU)])
  assert.deepEqual(a, b)
  assert.equal(calls.get('history'), 1)

  await siu.history(TOMAS_SIU)
  assert.equal(calls.get('history'), 2, 'una vez que llegó, la próxima vuelve a leer')
})

test('un error no se guarda: la próxima lectura vuelve a intentar', async () => {
  let down = true
  const memory = createMemorySiu(syntheticData, createFixedClock(syntheticData.now))
  const { spy, calls } = counted({
    terms: () => (down ? Promise.resolve(fail('falla-externa')) : memory.terms())
  })
  const siu = withSiuCache(spy, clock())

  assert.deepEqual(await siu.terms(), fail('falla-externa'))
  down = false
  const terms = await siu.terms()
  assert.ok(terms.ok)
  assert.equal(calls.get('terms'), 2)
})

test('inscribirse pasa directo y lo que se lee después ya lo ve', async () => {
  const { spy } = counted()
  const siu = withSiuCache(spy, clock())
  const target = { kind: 'comision', sectionId: 'sec-pr1-fi-v' } as const

  const before = await siu.courseEnrollments(TOMAS_SIU)
  const enrolled = await siu.enroll(TOMAS_SIU, target)
  assert.ok(enrolled.ok)
  const after = await siu.courseEnrollments(TOMAS_SIU)
  assert.ok(before.ok && after.ok)
  assert.equal(after.value.length, before.value.length + 1)
})

test('los recursos del aula se guardan un minuto', async () => {
  const memory = createMemoryClassroom(syntheticData)
  let reads = 0
  const time = clock()
  const classroom = withClassroomCache(
    {
      ...memory,
      contents: (courseId) => {
        reads += 1
        return memory.contents(courseId)
      }
    },
    time
  )
  const course = syntheticData.moodle.contents[0].courseId

  await classroom.contents(course)
  await classroom.contents(course)
  assert.equal(reads, 1)
  time.advance(CLASSROOM_TTL_MS)
  await classroom.contents(course)
  assert.equal(reads, 2)
})

test('la memoria no crece sin tope: pasado el máximo, se borra lo guardado', async () => {
  const { spy, calls } = counted({
    subject: (id) => Promise.resolve(ok({ id, code: id.toUpperCase(), name: id, credits: null }))
  })
  const siu = withSiuCache(spy, clock())

  await siu.subject('am1')
  for (let i = 0; i < MAX_ENTRIES; i++) await siu.subject(`m-${i}`)
  await siu.subject('am1')
  assert.equal(calls.get('subject'), MAX_ENTRIES + 2, 'am1 se borró al pasar el máximo y se vuelve a leer')
})

test('los vínculos de cada persona se leen una vez cada cinco minutos', async () => {
  let reads = 0
  const time = clock()
  const store = withPeopleStoreCache(
    {
      accountsOf: (personId) => {
        reads += 1
        return Promise.resolve(ok({ siu: `siu-${personId}` }))
      },
      ownerOf: () => Promise.resolve(ok(null))
    },
    time
  )

  assert.deepEqual(await store.accountsOf('p-1'), await store.accountsOf('p-1'))
  assert.equal(reads, 1)
  await store.accountsOf('p-2')
  assert.equal(reads, 2, 'otra persona es otra lectura')
  time.advance(STATIC_TTL_MS)
  await store.accountsOf('p-1')
  assert.equal(reads, 3)
})

test('con la caché en 0 segundos no se guarda nada: cada lectura va a la base', async () => {
  const { spy, calls } = counted()
  const siu = withSiuCache(spy, { ...clock(), staticTtlMs: 0 })

  await siu.subject('am1')
  await siu.subject('am1')
  assert.equal(calls.get('subject'), 2)
})
