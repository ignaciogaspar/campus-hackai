/* Cuánto pasó desde una consulta, como lo muestra el Hoy del docente. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { timeAgo } from '@/components/dates'

const NOW = '2026-11-10T12:00:00.000Z'

/** El instante que está `minutes` minutos antes de NOW. */
const before = (minutes: number) => new Date(new Date(NOW).getTime() - minutes * 60_000).toISOString()

test('menos de un minuto es «recién», y una fecha futura por desfasaje del reloj también', () => {
  assert.equal(timeAgo(NOW, NOW), 'recién')
  assert.equal(timeAgo(before(0.5), NOW), 'recién')
  assert.equal(timeAgo(before(-5), NOW), 'recién')
})

test('hasta la hora se cuenta en minutos, y desde la hora en horas', () => {
  assert.equal(timeAgo(before(1), NOW), 'hace 1 min')
  assert.equal(timeAgo(before(59), NOW), 'hace 59 min')
  assert.equal(timeAgo(before(60), NOW), 'hace 1 h')
  assert.equal(timeAgo(before(23 * 60 + 59), NOW), 'hace 23 h')
})

test('desde las 24 horas se cuenta en días, con «1 día» en singular', () => {
  assert.equal(timeAgo(before(24 * 60), NOW), 'hace 1 día')
  assert.equal(timeAgo(before(47 * 60), NOW), 'hace 1 día')
  assert.equal(timeAgo(before(48 * 60), NOW), 'hace 2 días')
})
