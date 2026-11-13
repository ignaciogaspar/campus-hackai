import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seenAtFrom, seenValue } from '@/lib/grades-seen'

test('la cookie guarda hasta cuándo vio sus notas quien entró, y se lee de vuelta', () => {
  const value = seenValue('p-taguirre', '2026-11-13T15:30:00.000Z')

  assert.equal(seenAtFrom(value, 'p-taguirre'), '2026-11-13T15:30:00.000Z')
})

test('si la cookie es de otra persona del mismo navegador, no cuenta', () => {
  const value = seenValue('p-lbenitez', '2026-11-13T15:30:00.000Z')

  assert.equal(seenAtFrom(value, 'p-taguirre'), null)
})

test('sin cookie o con una que no se entiende, no vio nada', () => {
  assert.equal(seenAtFrom(undefined, 'p-taguirre'), null)
  assert.equal(seenAtFrom('p-taguirre', 'p-taguirre'), null)
  assert.equal(seenAtFrom('p-taguirre|ayer', 'p-taguirre'), null)
})
