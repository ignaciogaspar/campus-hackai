import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absencesIn } from '@/lib/core/studies/absences'
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
