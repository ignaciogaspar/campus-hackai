import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dueAtFromInput,
  dueLabel,
  inputValueOf,
  newTaskHref,
  sectionsLabel,
  taskHref,
  tasksHref
} from '@/components/coursework/format'
import { subjectTabHref, tabsFor } from '@/components/subjects/subject-nav'

test('los enlaces de Seguimiento conservan la comisión elegida y escapan los ids', () => {
  assert.equal(tasksHref('am1'), '/materias/am1/tareas')
  assert.equal(tasksHref('am1', 'sec-am1-fi-b'), '/materias/am1/tareas?comision=sec-am1-fi-b')
  assert.equal(newTaskHref('am1', 'sec-am1-fi-a'), '/materias/am1/tareas/nueva?comision=sec-am1-fi-a')
  assert.equal(taskHref('am1', 'tarea-1', 'sec a'), '/materias/am1/tareas/tarea-1?comision=sec+a')
  assert.equal(tasksHref('a/b'), '/materias/a%2Fb/tareas')
})

test('el alumno ve las pestañas Espacio y Tareas y el docente además Alumnos', () => {
  assert.deepEqual(
    tabsFor('alumno').map((t) => t.id),
    ['espacio', 'tareas']
  )
  assert.deepEqual(
    tabsFor('profesor').map((t) => t.id),
    ['espacio', 'alumnos', 'tareas']
  )
  const tareas = tabsFor('alumno')[1]
  assert.equal(subjectTabHref('am1', tareas), '/materias/am1/tareas')
  assert.equal(subjectTabHref('am1', tareas, 'sec-am1-fi-b'), '/materias/am1/tareas?comision=sec-am1-fi-b')
})

test('la fecha límite dice si vence o venció, en la hora de Buenos Aires', () => {
  const dueAt = '2026-11-14T02:59:00.000Z'
  assert.match(dueLabel({ dueAt, past: false }), /^Vence vie.*13 nov.*23:59$/)
  assert.match(dueLabel({ dueAt, past: true }), /^Venció vie.*13 nov.*23:59$/)
})

test('lo que escribe la persona en el campo de fecha se toma en Buenos Aires y vuelve igual', () => {
  assert.equal(dueAtFromInput('2026-11-13T23:59'), '2026-11-14T02:59:00.000Z')
  assert.equal(dueAtFromInput('2026-11-13T23:59:30'), '2026-11-14T02:59:00.000Z')
  assert.equal(inputValueOf('2026-11-14T02:59:00.000Z'), '2026-11-13T23:59')
  assert.equal(inputValueOf(dueAtFromInput('2027-01-02T00:05') ?? ''), '2027-01-02T00:05')
})

test('una fecha que no es una fecha con hora no se acepta', () => {
  assert.equal(dueAtFromInput(''), null)
  assert.equal(dueAtFromInput('mañana'), null)
  assert.equal(dueAtFromInput('2026-11-13'), null)
  assert.equal(dueAtFromInput('2026-13-45T10:00'), null)
})

test('las comisiones de una tarea se nombran en una frase', () => {
  assert.equal(sectionsLabel(['A']), 'Comisión A')
  assert.equal(sectionsLabel(['A', 'B']), 'Comisiones A y B')
  assert.equal(sectionsLabel(['A', 'B', 'Verano']), 'Comisiones A, B y Verano')
})
