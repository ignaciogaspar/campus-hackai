/* El cupo de una comisión o una mesa y el cierre de una inscripción, en palabras, con lo que calcula Cursada. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  byAvailability,
  capacityText,
  closingText,
  creditsText,
  elsewhereText,
  spotsLeftText
} from '@/components/enrollment/format'

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

test('los créditos de una actividad van en singular o en plural', () => {
  assert.equal(creditsText(1), '1 crédito')
  assert.equal(creditsText(3), '3 créditos')
})

test('inscripto en otra comisión, sugiere la baja solo si todavía se puede dar de baja', () => {
  assert.equal(
    elsewhereText({ name: 'A', period: 'Grado 2do Cuatrimestre 2026', canDrop: true }, 'Grado 2do Cuatrimestre 2026'),
    'Ya estás inscripto en la comisión A. Para cambiarte, primero date de baja de esa.'
  )
  assert.equal(
    elsewhereText({ name: 'A', period: 'Grado 2do Cuatrimestre 2026', canDrop: false }, 'Grado 2do Cuatrimestre 2026'),
    'Ya estás inscripto en la comisión A y su inscripción cerró, así que no te podés cambiar.'
  )
})

test('inscripto en una comisión de otro período, explica que no se puede estar en dos de la misma materia', () => {
  assert.equal(
    elsewhereText({ name: 'A', period: 'Grado 2do Cuatrimestre 2026', canDrop: false }, 'Curso de Verano 2027'),
    'Ya estás inscripto en la comisión A, del 2do Cuatrimestre 2026, y no podés estar en dos comisiones de la misma materia.'
  )
  assert.equal(
    elsewhereText({ name: 'A', period: 'Grado 2do Cuatrimestre 2026', canDrop: true }, 'Curso de Verano 2027'),
    'Ya estás inscripto en la comisión A, del 2do Cuatrimestre 2026, y no podés estar en dos comisiones de la misma materia. Para anotarte en esta, primero date de baja de esa.'
  )
})

test('si no se sabe nada de la otra comisión, no sugiere la baja', () => {
  assert.equal(
    elsewhereText({ name: 'A', period: null, canDrop: false }, 'Curso de Verano 2027'),
    'Ya estás inscripto en la comisión A.'
  )
})

test('las comisiones van con la inscripta primero, después las abiertas con lugar y al final las demás', () => {
  const item = (name: string, fields: { alreadyEnrolled?: boolean; spotsLeft?: number | null; window?: string }) => ({
    name,
    alreadyEnrolled: fields.alreadyEnrolled ?? false,
    spotsLeft: fields.spotsLeft === undefined ? 10 : fields.spotsLeft,
    enrollmentWindow: (fields.window ?? 'abierta') as 'abierta' | 'cerrada' | 'no-abrio'
  })
  const sorted = byAvailability([
    item('Sin cupo', { spotsLeft: 0 }),
    item('Cerrada', { window: 'cerrada' }),
    item('Con lugar', {}),
    item('Sin tope', { spotsLeft: null }),
    item('Inscripta', { alreadyEnrolled: true, window: 'cerrada' })
  ])
  assert.deepEqual(
    sorted.map((i) => i.name),
    ['Inscripta', 'Con lugar', 'Sin tope', 'Sin cupo', 'Cerrada']
  )
})
