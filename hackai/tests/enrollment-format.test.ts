/* El cupo de una comisión o una mesa en palabras, con los lugares que calcula Cursada. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capacityText } from '@/components/enrollment/format'

test('el cupo dice cuántos lugares quedan, con el verbo en singular si queda uno', () => {
  assert.deepEqual(capacityText({ capacity: 40, spotsLeft: 12 }), { text: 'Quedan 12 lugares de 40', full: false })
  assert.deepEqual(capacityText({ capacity: 2, spotsLeft: 1 }), { text: 'Queda 1 lugar de 2', full: false })
})

test('sin lugares es «sin cupo», y sin tope, «sin límite de cupo»', () => {
  assert.deepEqual(capacityText({ capacity: 2, spotsLeft: 0 }), {
    text: 'Sin cupo · 2 de 2 lugares ocupados',
    full: true
  })
  assert.deepEqual(capacityText({ capacity: null, spotsLeft: null }), { text: 'Sin límite de cupo', full: false })
})
