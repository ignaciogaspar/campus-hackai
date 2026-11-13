import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dueTime, fullDate, readTime } from '@/components/dates'

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
