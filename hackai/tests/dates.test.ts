import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, dayKey, daysBetween, weekdayIndex } from '@/lib/dates'

// Domingo 15 de noviembre a las 23:00 en Buenos Aires: en UTC ya es lunes 16.
const SUNDAY_NIGHT = '2026-11-16T02:00:00.000Z'

test('el día de un instante es el de Buenos Aires, no el de UTC', () => {
  assert.equal(dayKey(SUNDAY_NIGHT), '2026-11-15')
  assert.equal(dayKey('2026-11-16T03:00:00.000Z'), '2026-11-16')
})

test('los días que faltan se cuentan por fecha de Buenos Aires: del domingo a la noche al lunes a la mañana hay uno', () => {
  assert.equal(daysBetween(SUNDAY_NIGHT, '2026-11-16T11:00:00.000Z'), 1)
  assert.equal(daysBetween('2026-11-16T03:30:00.000Z', '2026-11-16T11:00:00.000Z'), 0)
  assert.equal(daysBetween(SUNDAY_NIGHT, '2026-12-09T12:00:00.000Z'), 24)
})

test('sumar días cruza fin de mes y también resta', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-11-16', -7), '2026-11-09')
})

test('la semana empieza el lunes', () => {
  assert.equal(weekdayIndex('2026-11-16'), 0)
  assert.equal(weekdayIndex('2026-11-15'), 6)
})
