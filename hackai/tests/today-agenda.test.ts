/* Cómo se reparten en la pantalla las fechas de Hoy: la lista de las próximas
   2 semanas del celular y el calendario de esta semana y la próxima de compu. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agendaOf, calendarOf } from '@/components/today/agenda'
import type { UpcomingItem } from '@/lib/core/studies'

// Domingo 15 de noviembre a las 23:00 en Buenos Aires: en UTC ya es lunes 16.
const SUNDAY_NIGHT = '2026-11-16T02:00:00.000Z'

const item = (id: string, date: string, past = false): UpcomingItem => ({
  id,
  kind: 'parcial',
  source: 'siu',
  subjectId: 'am1',
  subjectCode: 'AM1',
  subjectName: 'Análisis Matemático I',
  name: id,
  date,
  past
})

const ids = (items: { id?: string }[]) => items.map((i) => i.id)

test('el calendario va de lunes a domingo, esta semana y la próxima, según el día de Buenos Aires', () => {
  const next = item('proximo', '2026-11-17T11:00:00.000Z')
  const items = [
    item('antes', '2026-11-08T15:00:00.000Z', true),
    item('lunes', '2026-11-09T11:00:00.000Z', true),
    next,
    item('domingo-a-la-noche', '2026-11-23T02:00:00.000Z'),
    item('despues', '2026-11-23T11:00:00.000Z')
  ]

  const { days, before, after } = calendarOf(items, SUNDAY_NIGHT, next)

  assert.equal(days.length, 14)
  assert.equal(days[0].day, '2026-11-09')
  assert.equal(days[13].day, '2026-11-22')
  assert.deepEqual(
    days.filter((d) => d.today).map((d) => d.day),
    ['2026-11-15']
  )
  assert.equal(days[0].past, true)
  assert.equal(days[6].past, false)
  assert.deepEqual(ids(before), ['antes'])
  assert.deepEqual(ids(after), ['despues'])
  assert.deepEqual(
    ids(days[13].events),
    ['domingo-a-la-noche'],
    'el domingo 22 a las 23:00 cae el 22, aunque en UTC sea 23'
  )
  assert.equal(days[0].events[0].past, true, 'lo que ya pasó va marcado')
  assert.equal(days[8].events[0].next, true, 'el próximo parcial va marcado')
})

test('las próximas 2 semanas son 14 días contando hoy: el último día entra y el siguiente queda para después', () => {
  const next = item('proximo', '2026-11-17T11:00:00.000Z')
  const items = [
    item('pasado', '2026-11-10T11:00:00.000Z', true),
    next,
    item('ultimo-dia', '2026-11-29T02:00:00.000Z'),
    item('dia-siguiente', '2026-11-29T11:00:00.000Z')
  ]

  const agenda = agendaOf(items, SUNDAY_NIGHT, next)

  assert.equal(agenda.soonUntil, '2026-11-28')
  assert.deepEqual(ids(agenda.soon), ['ultimo-dia'], 'sin el próximo parcial, que va arriba')
  assert.equal(agenda.nextIsSoon, true)
  assert.deepEqual(ids(agenda.later), ['dia-siguiente'])
  assert.deepEqual(ids(agenda.past), ['pasado'])
})
