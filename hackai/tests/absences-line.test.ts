import assert from 'node:assert/strict'
import { test } from 'node:test'
import { absencesLine } from '@/components/absences/line'

test('con máximo, la línea dice cuántas faltas le quedan y abajo cuántas lleva', () => {
  assert.deepEqual(absencesLine({ count: 1, justified: 0, max: 3, left: 2, warning: null, classes: 12 }), {
    headline: 'Te quedan 2 faltas',
    detail: '1 de 3'
  })
  assert.deepEqual(absencesLine({ count: 1.5, justified: 0, max: 4, left: 2.5, warning: null, classes: 16 }), {
    headline: 'Te quedan 2,5 faltas',
    detail: '1,5 de 4'
  })
})

test('cerca del máximo, le queda una y el detalle aclara que la justificada cuenta', () => {
  assert.deepEqual(absencesLine({ count: 2, justified: 1, max: 3, left: 1, warning: 'cerca', classes: 12 }), {
    headline: 'Te queda 1 falta',
    detail: '2 de 3 · incluye 1 justificada'
  })
})

test('en el máximo dice que llegó, y si lo pasó, que lo pasó', () => {
  assert.deepEqual(absencesLine({ count: 3, justified: 0, max: 3, left: 0, warning: 'limite', classes: 12 }), {
    headline: 'Llegaste al máximo',
    detail: '3 de 3'
  })
  assert.deepEqual(absencesLine({ count: 7, justified: 2, max: 6, left: 0, warning: 'limite', classes: null }), {
    headline: 'Pasaste el máximo',
    detail: '7 de 6 · incluye 2 justificadas'
  })
})

test('sin máximo, dice solo cuántas lleva', () => {
  assert.deepEqual(absencesLine({ count: 1, justified: 0, max: null, left: null, warning: null, classes: null }), {
    headline: '1 falta',
    detail: null
  })
  assert.deepEqual(absencesLine({ count: 2, justified: 1, max: null, left: null, warning: null, classes: null }), {
    headline: '2 faltas',
    detail: 'incluye 1 justificada'
  })
  assert.deepEqual(absencesLine({ count: 0, justified: 0, max: null, left: null, warning: null, classes: null }), {
    headline: 'Sin faltas',
    detail: null
  })
})
