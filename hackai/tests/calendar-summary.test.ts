/* Lo que responde el calendario arriba de la semana: qué vence esta semana y
   cuál es el próximo parcial y el próximo final, y la lista de próximas fechas
   que no los deja afuera. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inDays, nextDatesOf, summaryOf } from '@/components/today/calendar-summary'
import type { UpcomingItem } from '@/lib/core/studies'

const item = (id: string, date: string, kind: UpcomingItem['kind'] = 'entrega', past = false): UpcomingItem => ({
  id,
  kind,
  source: kind === 'entrega' ? 'moodle' : 'siu',
  subjectId: 'am1',
  subjectCode: 'AM1',
  subjectName: 'Análisis Matemático I',
  name: id,
  date,
  past,
  examPeriod: null,
  location: null,
  hasSection: true
})

// Miércoles 11 de noviembre de 2026, 12:00 en Buenos Aires.
const NOW = '2026-11-11T15:00:00.000Z'

test('esta semana vence lo que cae de hoy al domingo; el próximo parcial y el próximo final, aunque estén lejos', () => {
  const items = [
    item('vencida', '2026-11-10T02:59:00.000Z', 'entrega', true),
    item('guía 3', '2026-11-13T02:59:00.000Z'),
    item('domingo', '2026-11-16T02:59:00.000Z'),
    item('la otra semana', '2026-11-18T02:59:00.000Z'),
    item('primer parcial', '2026-11-05T12:00:00.000Z', 'parcial', true),
    item('segundo parcial', '2026-11-24T12:00:00.000Z', 'parcial'),
    item('final', '2026-12-10T12:00:00.000Z', 'final')
  ]

  const summary = summaryOf(items, NOW)

  assert.deepEqual(
    summary.dueThisWeek.map((i) => i.id),
    ['guía 3', 'domingo']
  )
  assert.equal(summary.nextExam?.id, 'segundo parcial')
  assert.equal(summary.nextFinal?.id, 'final')
})

test('sin entregas ni exámenes por delante, no hay nada que resumir', () => {
  const summary = summaryOf([item('vencida', '2026-11-10T02:59:00.000Z', 'entrega', true)], NOW)

  assert.deepEqual(summary, { dueThisWeek: [], nextExam: null, nextFinal: null })
})

test('las próximas fechas cortan en 6, pero el próximo parcial y el próximo final siempre entran', () => {
  const entregas = Array.from({ length: 8 }, (_, i) =>
    item(`entrega ${i + 1}`, `2026-11-${String(12 + i).padStart(2, '0')}T02:59:00.000Z`)
  )
  const parcial = item('parcial', '2026-11-25T12:00:00.000Z', 'parcial')
  const final = item('final', '2026-12-10T12:00:00.000Z', 'final')
  const segundoFinal = item('otro final', '2026-12-15T12:00:00.000Z', 'final')

  const next = nextDatesOf([
    item('vencida', '2026-11-10T02:59:00.000Z', 'entrega', true),
    ...entregas,
    parcial,
    final,
    segundoFinal
  ])

  assert.deepEqual(
    next.map((i) => i.id),
    ['entrega 1', 'entrega 2', 'entrega 3', 'entrega 4', 'entrega 5', 'entrega 6', 'parcial', 'final']
  )
})

test('cuánto falta se dice en días de calendario de Buenos Aires', () => {
  assert.equal(inDays('2026-11-11T23:00:00.000Z', NOW), 'hoy')
  assert.equal(inDays('2026-11-12T03:30:00.000Z', NOW), 'mañana')
  assert.equal(inDays('2026-11-24T12:00:00.000Z', NOW), 'en 13 días')
})
