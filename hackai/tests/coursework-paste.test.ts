import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { GradeScale } from '@/lib/core/coursework'
import { previewOf } from '@/lib/core/coursework/paste'

const students = [
  { personId: 'p-1', legajo: '30101', name: 'Aguirre, Tomás', email: 'tomas.aguirre@alumnos.example.edu.ar' },
  { personId: 'p-2', legajo: '30102', name: 'Benítez, Lucía', email: 'lucia.benitez@alumnos.example.edu.ar' },
  { personId: null, legajo: '30103', name: 'Escobar, Joaquín', email: 'joaquin.escobar@alumnos.example.edu.ar' },
  { personId: 'p-4', legajo: '30104', name: 'Pérez, Ana', email: 'ana.perez@alumnos.example.edu.ar' },
  // Homónima de la anterior: por nombre no se las distingue.
  { personId: 'p-5', legajo: '30105', name: 'Pérez, Ana', email: 'ana.perez2@alumnos.example.edu.ar' }
]

const outcomes = (text: string, scale: GradeScale = '1-10') =>
  previewOf(text, students, scale).rows.map((r) => [r.outcome, r.personId, r.value])

test('empareja por legajo y reporta los que no reconoce', () => {
  const preview = previewOf('30101\t8\n99999\t7\n30102\t9,5', students, '1-10')
  assert.deepEqual(
    preview.rows.map((r) => [r.outcome, r.personId, r.value, r.by]),
    [
      ['nota', 'p-1', 8, 'legajo'],
      ['no-reconocido', null, null, null],
      ['nota', 'p-2', 9.5, 'legajo']
    ]
  )
  assert.deepEqual(preview.counts, { ready: 2, absent: 0, unmatched: 1, invalid: 0, skipped: 0 })
  assert.equal(preview.rows[1].key, '99999')
})

test('empareja por mail y por nombre, en cualquier orden y sin tildes ni mayúsculas', () => {
  const read = (text: string) => previewOf(text, students, '1-10').rows.map((r) => [r.personId, r.by, r.value])
  assert.deepEqual(read('LUCIA.BENITEZ@alumnos.example.edu.ar\t7\nTomas Aguirre\t6'), [
    ['p-2', 'mail', 7],
    ['p-1', 'nombre', 6]
  ])
  // Apellido y nombre en columnas separadas, y «Apellido, Nombres» como figura en el SIU.
  assert.deepEqual(read('Benitez\tLucia\t5\nAguirre, Tomás\t4'), [
    ['p-2', 'nombre', 5],
    ['p-1', 'nombre', 4]
  ])
})

test('un nombre que coincide con dos alumnos no se empareja, pero su legajo sí', () => {
  assert.deepEqual(outcomes('Ana Pérez\t8\n30105\t7'), [
    ['ambiguo', null, null],
    ['nota', 'p-5', 7]
  ])
})

test('coma o punto decimal, y «A» es ausente', () => {
  assert.deepEqual(outcomes('30101\t7,5\n30102\t6.25\n30104\tA\n30105\tausente'), [
    ['nota', 'p-1', 7.5],
    ['nota', 'p-2', 6.25],
    ['ausente', 'p-4', null],
    ['ausente', 'p-5', null]
  ])
})

test('convierte de 0 a 100 a de 1 a 10, con 1 de piso', () => {
  const preview = previewOf('30101\t85\n30102\t60,5\n30104\t0\n30105\t120', students, '0-100')
  assert.deepEqual(
    preview.rows.map((r) => [r.outcome, r.value, r.raw]),
    [
      ['nota', 8.5, '85'],
      ['nota', 6.05, '60,5'],
      ['nota', 1, '0'],
      ['invalida', null, '120']
    ]
  )
})

test('en la escala de 1 a 10, lo que se sale de rango o no es número es inválido', () => {
  assert.deepEqual(outcomes('30101\t11\n30102\t0\n30104\tmuy bien\n30105\t'), [
    ['invalida', 'p-1', null],
    ['invalida', 'p-2', null],
    ['invalida', 'p-4', null],
    ['sin-nota', 'p-5', null]
  ])
})

test('un alumno sin cuenta se reconoce pero no se puede calificar', () => {
  assert.deepEqual(outcomes('30103\t8'), [['sin-cuenta', null, null]])
})

test('un alumno repetido usa la primera línea y marca la otra', () => {
  assert.deepEqual(outcomes('30101\t8\n30101\t9'), [
    ['nota', 'p-1', 8],
    ['repetido', 'p-1', null]
  ])
})

test('saltea el encabezado, las líneas vacías y los saltos de Windows', () => {
  const preview = previewOf('Legajo\tNota\r\n30101\t8\r\n\r\n', students, '1-10')
  assert.equal(preview.rows.length, 1)
  assert.equal(preview.rows[0].line, 2)
})
