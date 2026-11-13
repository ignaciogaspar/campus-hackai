/* Cómo se dice la próxima clase de una comisión en «Alumnos y clases», cuando hoy no hay clase. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextClassText } from '@/components/subjects/attendance-format'

test('dice el día y el horario de la próxima clase', () => {
  const text = nextClassText(
    { classAt: '2026-11-11T11:00:00.000Z', endAt: '2026-11-11T13:00:00.000Z', termStartsOn: null },
    'A'
  )

  assert.equal(text, 'La próxima es el miércoles 11 de noviembre, de 08:00 a 10:00.')
})

test('con el período sin empezar, dice cuándo empieza la cursada y, si es otro día, la primera clase', () => {
  const sameDay = nextClassText(
    { classAt: '2027-01-11T12:00:00.000Z', endAt: '2027-01-11T16:00:00.000Z', termStartsOn: '2027-01-11' },
    'Verano'
  )
  const later = nextClassText(
    { classAt: '2027-01-12T17:00:00.000Z', endAt: '2027-01-12T21:00:00.000Z', termStartsOn: '2027-01-11' },
    'Verano tarde'
  )

  assert.equal(sameDay, 'La cursada empieza el lunes 11 de enero, con la primera clase de 09:00 a 13:00.')
  assert.equal(
    later,
    'La cursada empieza el lunes 11 de enero. La primera clase es el martes 12 de enero, de 14:00 a 18:00.'
  )
})

test('sin próxima clase, dice que la comisión no tiene más clases en el período', () => {
  assert.equal(nextClassText(null, 'A'), 'La comisión A no tiene más clases en este período.')
})
