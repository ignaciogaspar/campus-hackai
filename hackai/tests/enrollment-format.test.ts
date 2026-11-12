/* El cupo de una comisión o una mesa y el cierre de una inscripción, en palabras, con lo que calcula Cursada. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capacityText, closingText, spotsLeftText } from '@/components/enrollment/format'

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

test('en la lista, cuántos días faltan para que cierre una inscripción: hoy, mañana o en N días', () => {
  assert.equal(closingText(0), 'cierra hoy')
  assert.equal(closingText(1), 'cierra mañana')
  assert.equal(closingText(24), 'cierra en 24 días')
  // Lo último que se leyó, si el SIU no responde, puede ser de una que ya cerró.
  assert.equal(closingText(-2), 'ya cerró')
})

test('en la lista, cuántos lugares quedan entre las comisiones o mesas abiertas de la materia', () => {
  assert.deepEqual(spotsLeftText(12), { text: 'Quedan 12 lugares', full: false })
  assert.deepEqual(spotsLeftText(1), { text: 'Queda 1 lugar', full: false })
  assert.deepEqual(spotsLeftText(0), { text: 'Sin cupo', full: true })
  assert.deepEqual(spotsLeftText(null), { text: 'Sin límite de cupo', full: false })
})
