import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gradeKey, seenAtFrom, seenFrom, seenValue, unseenGrades, withSeen } from '@/lib/grades-seen'

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

const grade = (assessmentName: string, subjectId = 'am1') => ({
  source: 'historia' as const,
  subjectId,
  assessmentName,
  date: '2026-11-05T12:00:00.000Z'
})

test('tocar una nota la marca como vista solo a ella: las otras siguen como nuevas', () => {
  const value = withSeen(undefined, 'p-taguirre', [gradeKey(grade('Primer parcial'))])

  const seen = seenFrom(value, 'p-taguirre')

  assert.equal(seen.at, null)
  assert.deepEqual(
    unseenGrades([grade('Primer parcial'), grade('TP 1'), grade('Primer parcial', 'fi1')], seen).map((g) => [
      g.subjectId,
      g.assessmentName
    ]),
    [
      ['am1', 'TP 1'],
      ['fi1', 'Primer parcial']
    ]
  )
})

test('marcar una suelta conserva hasta cuándo vio todas, y ver todas olvida las sueltas', () => {
  const all = seenValue('p-taguirre', '2026-11-13T15:30:00.000Z')
  const one = withSeen(all, 'p-taguirre', [gradeKey(grade('TP 1'))])

  assert.deepEqual(seenFrom(one, 'p-taguirre'), {
    at: '2026-11-13T15:30:00.000Z',
    keys: [gradeKey(grade('TP 1'))]
  })
  assert.deepEqual(seenFrom(seenValue('p-taguirre', '2026-11-14T10:00:00.000Z'), 'p-taguirre').keys, [])
})

test('las sueltas de otra persona del mismo navegador no cuentan, y la cookie guarda como mucho 40', () => {
  const other = withSeen(undefined, 'p-lbenitez', [gradeKey(grade('TP 1'))])
  assert.deepEqual(seenFrom(withSeen(other, 'p-taguirre', []), 'p-taguirre'), { at: null, keys: [] })

  const many = Array.from({ length: 50 }, (_, i) => gradeKey(grade(`TP ${i}`)))
  const value = withSeen(undefined, 'p-taguirre', many)
  assert.equal(seenFrom(value, 'p-taguirre').keys.length, 40)
  assert.ok(value.length < 400, 'la cookie queda chica')
})
