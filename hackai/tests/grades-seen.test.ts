import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seenAtFrom, seenValue, shownNewGrades } from '@/lib/grades-seen'

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

test('las notas nuevas se muestran solo si se leyeron al día: con el SIU caído, la sección no aparece', () => {
  const grade = { assessmentName: 'Primer parcial' }
  const read = (stale: boolean) => ({
    ok: true as const,
    value: { data: [grade], readAt: '2026-11-13T15:00:00.000Z', stale }
  })

  assert.deepEqual(shownNewGrades(read(false)), [grade])
  assert.deepEqual(shownNewGrades(read(true)), [])
  assert.deepEqual(shownNewGrades({ ok: false as const, error: 'falla-externa' }), [])
})
