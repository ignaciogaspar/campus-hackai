/* A dónde lleva una fecha de Hoy: al espacio de su materia o, si rinde libre, a la mesa. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateHref } from '@/components/today/agenda'
import type { UpcomingItem } from '@/lib/core/studies'

const item = (id: string): UpcomingItem => ({
  id,
  kind: 'parcial',
  source: 'siu',
  subjectId: 'am1',
  subjectCode: 'AM1',
  subjectName: 'Análisis Matemático I',
  name: id,
  date: '2026-11-16T02:00:00.000Z',
  past: false,
  examPeriod: null,
  location: null,
  hasSection: true
})

test('una fecha lleva al espacio de su materia; un final sin comisión, a la mesa para el alumno y a ningún lado para el docente', () => {
  const parcial = item('p')
  const libre = { ...item('f'), kind: 'final' as const, subjectId: 'fi1', hasSection: false }

  assert.equal(dateHref(parcial, 'alumno'), '/materias/am1')
  assert.equal(dateHref(parcial, 'profesor'), '/materias/am1')
  assert.equal(dateHref(libre, 'alumno'), '/inscripciones?tab=examenes&materia=fi1')
  assert.equal(dateHref(libre, 'profesor'), undefined)
})
