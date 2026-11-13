import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapLimited } from '@/lib/concurrency'

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('mapLimited devuelve los resultados en el orden de la lista, aunque terminen en otro orden', async () => {
  const result = await mapLimited([30, 10, 20], 2, async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    return ms * 2
  })
  assert.deepEqual(result, [60, 20, 40])
})

test('mapLimited no corre más tareas a la vez que el tope', async () => {
  let running = 0
  let most = 0
  await mapLimited(
    Array.from({ length: 10 }, (_, i) => i),
    3,
    async () => {
      running++
      most = Math.max(most, running)
      await tick()
      await tick()
      running--
    }
  )
  assert.equal(most, 3)
})

test('mapLimited con una lista vacía devuelve una lista vacía, y si una tarea falla, falla todo', async () => {
  assert.deepEqual(await mapLimited([], 4, async () => 1), [])
  await assert.rejects(
    mapLimited([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('falló la 2')
      return n
    }),
    /falló la 2/
  )
})
