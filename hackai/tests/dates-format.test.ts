import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closesAt, dueTime, fullDate, readTime } from '@/components/dates'

test('las fechas límite y las lecturas muestran la hora en 24 horas, como se escribe acá', () => {
  assert.equal(dueTime('2026-11-13T23:59:00-03:00'), 'vie, 13 nov, 23:59')
  // Un final a las dos de la tarde no se puede leer como de madrugada.
  assert.equal(dueTime('2026-12-07T14:00:00-03:00'), 'lun, 7 dic, 14:00')
  assert.equal(readTime('2026-11-10T15:40:00-03:00'), '10 nov, 15:40')
})

test('una fecha con año se escribe igual siempre, sin «de», en el día de Buenos Aires', () => {
  assert.equal(fullDate('2026-11-04T12:00:00-03:00'), '4 nov 2026')
  assert.equal(fullDate('2026-09-02T09:30:00-03:00'), '2 sept 2026')
  // A las 23:30 de Buenos Aires ya es otro día en UTC: vale el de acá.
  assert.equal(fullDate('2026-11-13T23:30:00-03:00'), '13 nov 2026')
})

test('una fecha límite de otro año lleva el año; una de este año, no', () => {
  const now = '2026-11-13T12:00:00-03:00'
  assert.equal(dueTime('2026-01-01T01:00:00-03:00', now), 'jue, 1 ene, 01:00')
  assert.equal(dueTime('2027-01-02T00:05:00-03:00', now), 'sáb, 2 ene 2027, 00:05')
  assert.equal(dueTime('2025-12-31T23:59:00-03:00', now), 'mié, 31 dic 2025, 23:59')
})

test('el cierre de una entrega se dice con el día, el mes y la hora', () => {
  assert.equal(closesAt('2026-11-13T23:59:00-03:00'), '13/11 a las 23:59')
  assert.equal(closesAt('2026-12-01T08:05:00-03:00'), '1/12 a las 08:05')
})
