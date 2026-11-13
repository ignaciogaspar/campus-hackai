/* Cómo se resume en la lista de Notas el avance de una materia en curso. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessmentsProgress } from '@/components/grades/format'
import type { SubjectAssessment } from '@/lib/core/studies'

const assessment = (name: string, fields: Partial<SubjectAssessment>): SubjectAssessment => ({
  id: null,
  name,
  kind: 'parcial',
  date: '2026-09-21T08:00:00-03:00',
  grade: null,
  graded: false,
  past: false,
  source: null,
  comment: null,
  ...fields
})

test('una materia en curso muestra la nota de cada parcial y cuántos tienen nota, sin el recuperatorio sin rendir', () => {
  const progress = assessmentsProgress([
    assessment('Primer parcial', { grade: 7, graded: true, past: true, source: 'actuacion-provisoria' }),
    assessment('Segundo parcial', {}),
    assessment('Recuperatorio', { kind: 'recuperatorio' })
  ])
  assert.deepEqual(progress, {
    items: [
      { name: 'Primer parcial', result: '7' },
      { name: 'Segundo parcial', result: '—' }
    ],
    count: '1 de 2 con nota'
  })
})

test('un recuperatorio rendido cuenta, un ausente se nombra sin nota y las notas con decimales van con coma', () => {
  const progress = assessmentsProgress([
    assessment('TP integrador', { kind: 'tp', grade: 8.5, graded: true, past: true }),
    assessment('Parcial', { graded: true, past: true }),
    assessment('Recuperatorio', { kind: 'recuperatorio', grade: 6, graded: true, past: true })
  ])
  assert.deepEqual(progress, {
    items: [
      { name: 'TP integrador', result: '8,5' },
      { name: 'Parcial', result: 'Ausente' },
      { name: 'Recuperatorio', result: '6' }
    ],
    count: '2 de 3 con nota'
  })
})

test('sin evaluaciones no hay nada que resumir', () => {
  assert.equal(assessmentsProgress([]), null)
  assert.equal(assessmentsProgress([assessment('Recuperatorio', { kind: 'recuperatorio' })]), null)
})
