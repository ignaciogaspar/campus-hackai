import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type AbsenceRecord, absencesIn, mergeAbsences } from '@/lib/core/studies/absences'
import type { SiuAbsences } from '@/lib/ports/siu'

const absence = (id: string) => ({
  id,
  personId: '30101',
  sectionId: 'sec-a',
  date: '2026-09-01T11:00:00.000Z',
  justified: false
})

const report = (count: number, max: number): SiuAbsences => ({
  absences: Array.from({ length: count }, (_, i) => absence(`in-${i}`)),
  limits: [{ sectionId: 'sec-a', max }]
})

test('sin faltas no hay aviso, aunque el máximo sea 1', () => {
  assert.deepEqual(absencesIn(report(0, 1), 'sec-a'), { count: 0, justified: 0, max: 1, left: 1, warning: null })
})

test('avisa «cerca» con alguna falta y una sola por delante, y «límite» al llegar al máximo', () => {
  assert.equal(absencesIn(report(2, 3), 'sec-a').warning, 'cerca')
  assert.equal(absencesIn(report(1, 3), 'sec-a').warning, null)
  assert.equal(absencesIn(report(1, 1), 'sec-a').warning, 'limite')
})

const record = (sectionId: string, date: string, source: 'siu' | 'hackai', justified = false): AbsenceRecord => ({
  sectionId,
  date,
  justified,
  source
})

test('mergeAbsences con HackAI vacío deja las faltas del SIU, por fecha', () => {
  const siu = [record('sec-a', '2026-11-04T14:00:00.000Z', 'siu'), record('sec-a', '2026-10-01T14:00:00.000Z', 'siu')]

  assert.deepEqual(
    mergeAbsences(siu, []).map((a) => a.date),
    ['2026-10-01T14:00:00.000Z', '2026-11-04T14:00:00.000Z']
  )
})

test('mergeAbsences: la falta de una clase tomada en HackAI reemplaza la del SIU de esa comisión y ese día', () => {
  const siu = [
    record('sec-a', '2026-11-04T14:00:00.000Z', 'siu'),
    record('sec-a', '2026-10-01T14:00:00.000Z', 'siu'),
    record('sec-b', '2026-11-04T14:00:00.000Z', 'siu')
  ]
  const hackai = [record('sec-a', '2026-11-04T15:00:00.000Z', 'hackai')]

  const merged = mergeAbsences(siu, hackai)

  assert.deepEqual(
    merged.map((a) => [a.sectionId, a.source]),
    [
      ['sec-a', 'siu'],
      ['sec-b', 'siu'],
      ['sec-a', 'hackai']
    ]
  )
})
