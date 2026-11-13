/* A dónde lleva una fecha de Hoy (al espacio de su materia, a la mesa si rinde libre o, para el docente, a la
   semana del Calendario) y cómo se dice qué es y a qué hora. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateHref, whatAndWhen } from '@/components/today/agenda'
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

test('una fecha lleva al alumno al espacio de su materia y, si rinde libre, a la mesa', () => {
  const parcial = item('p')
  const libre = { ...item('f'), kind: 'final' as const, subjectId: 'fi1', hasSection: false }

  assert.equal(dateHref(parcial, 'alumno'), '/materias/am1')
  assert.equal(dateHref(libre, 'alumno'), '/inscripciones?tab=examenes&materia=fi1')
})

test('al docente, un parcial o una mesa lo llevan a la semana de esa fecha en el Calendario, en la hora de Buenos Aires', () => {
  const parcial = item('p')
  const mesa = { ...item('f'), kind: 'final' as const, subjectId: 'aga', date: '2026-12-09T12:00:00.000Z' }

  // El parcial es el domingo 15 a las 23 en Buenos Aires, aunque en UTC ya sea el 16.
  assert.equal(dateHref(parcial, 'profesor'), '/calendario?semana=2026-11-15')
  assert.equal(dateHref(mesa, 'profesor'), '/calendario?semana=2026-12-09')
})

test('qué es y a qué hora no repite el tipo cuando ya está en el nombre', () => {
  const at = (name: string, kind: UpcomingItem['kind'], location: string | null = null): UpcomingItem => ({
    ...item(name),
    kind,
    location,
    date: '2026-11-16T11:00:00.000Z'
  })

  assert.equal(whatAndWhen(at('Segundo parcial', 'parcial')), '08:00')
  assert.equal(whatAndWhen(at('Final', 'final', 'Campus Pilar, aula 12')), '08:00 · Campus Pilar, aula 12')
  assert.equal(whatAndWhen(at('Recuperatorio', 'recuperatorio')), '08:00')
  assert.equal(whatAndWhen(at('TP integrador', 'tp')), '08:00')
  assert.equal(whatAndWhen(at('Evaluación integradora', 'parcial')), 'Parcial · 08:00')
  assert.equal(whatAndWhen(at('Guía 3', 'entrega')), 'Entrega · vence 08:00')
})

test('una tarea de HackAI lleva a la tarea, donde se entrega, con el id sin el prefijo', () => {
  const task: UpcomingItem = { ...item('tarea-hackai:abc-123'), kind: 'entrega', source: 'hackai' }

  assert.equal(dateHref(task, 'alumno'), '/materias/am1/tareas/abc-123')
})
