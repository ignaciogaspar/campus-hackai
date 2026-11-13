import assert from 'node:assert/strict'
import { test } from 'node:test'
import { memoRead } from '@/lib/request-memo'
import { fail, ok } from '@/lib/result'

test('comparte la promesa por clave y reintenta una falla', async () => {
  const entries = new Map<string, Promise<unknown>>()
  let calls = 0
  const read = memoRead(
    () => entries,
    'read',
    async (id: string) => {
      calls += 1
      return calls === 1 ? fail('falla-externa') : ok(id)
    }
  )
  const first = read('a')
  assert.equal(read('a'), first)
  assert.deepEqual(await first, fail('falla-externa'))
  assert.deepEqual(await read('a'), ok('a'))
  assert.deepEqual(await read('a'), ok('a'))
  assert.deepEqual(await read('b'), ok('b'))
  assert.equal(calls, 3)
  entries.clear()
  assert.deepEqual(await read('a'), ok('a'))
  assert.equal(calls, 4)
})
