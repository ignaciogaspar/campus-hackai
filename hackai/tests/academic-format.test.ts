import assert from 'node:assert/strict'
import { test } from 'node:test'
import { termLabel } from '@/components/academic/format'

test('el período se nombra sin el «Grado» del SIU, y los otros quedan como vienen', () => {
  assert.equal(termLabel('Grado 2do Cuatrimestre 2026'), '2do Cuatrimestre 2026')
  assert.equal(termLabel('Grado 1er Cuatrimestre 2026'), '1er Cuatrimestre 2026')
  assert.equal(termLabel('Curso de Verano 2027'), 'Curso de Verano 2027')
  assert.equal(termLabel('Posgrado 2026'), 'Posgrado 2026')
})
