import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countsLabel,
  createdTaskHref,
  dueAtFromInput,
  dueLabel,
  durationLabel,
  gradeFromInput,
  gradeInputValue,
  gradesHref,
  inputValueOf,
  newTaskHref,
  nextStudent,
  notesLabel,
  pastedText,
  pasteGradesHref,
  relativeDue,
  rowStatus,
  sectionsLabel,
  subjectNotesHref,
  submissionHref,
  submissionStatus,
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

test('después de crear una tarea se vuelve a la lista de su comisión, marcando cuál es la nueva', () => {
  assert.equal(
    createdTaskHref('am1', 'sec-am1-fi-a', 'tarea 7'),
    '/materias/am1/tareas?comision=sec-am1-fi-a&creada=tarea+7'
  )
  assert.equal(createdTaskHref('am1', undefined, 'tarea-7'), '/materias/am1/tareas?creada=tarea-7')
})

test('el alumno ve las pestañas Espacio y Tareas y el docente además Alumnos', () => {
  assert.deepEqual(
    tabsFor('alumno').map((t) => t.id),
    ['espacio', 'tareas']
  )
  assert.deepEqual(
    tabsFor('profesor').map((t) => t.id),
    ['espacio', 'alumnos', 'tareas', 'calificaciones']
  )
  const tareas = tabsFor('alumno')[1]
  assert.equal(subjectTabHref('am1', tareas), '/materias/am1/tareas')
  assert.equal(subjectTabHref('am1', tareas, 'sec-am1-fi-b'), '/materias/am1/tareas?comision=sec-am1-fi-b')
})

test('el enlace a Calificaciones lleva lo que se mira y escapa los ids', () => {
  assert.equal(gradesHref('am1'), '/materias/am1/calificaciones')
  assert.equal(
    gradesHref('am1', { comision: 'sec-am1-fi-a', columna: 'tarea:t 1', alumno: 'p-taguirre' }),
    '/materias/am1/calificaciones?comision=sec-am1-fi-a&columna=tarea%3At+1&alumno=p-taguirre'
  )
  assert.equal(
    gradesHref('am1', { columna: 'evaluacion:ev-4', listo: true }),
    '/materias/am1/calificaciones?columna=evaluacion%3Aev-4&listo=si'
  )
})

test('la nota se lee con coma o con punto, y lo que no es un número no pasa', () => {
  assert.equal(gradeFromInput('8,5'), 8.5)
  assert.equal(gradeFromInput(' 7.25 '), 7.25)
  assert.equal(gradeFromInput('10'), 10)
  assert.equal(gradeFromInput(''), null)
  assert.equal(gradeFromInput('   '), null)
  for (const bad of ['abc', '8,5,1', '-3', '1e3', '8 puntos']) assert.ok(Number.isNaN(gradeFromInput(bad)), bad)
  assert.equal(gradeInputValue(8.5), '8,5')
  assert.equal(gradeInputValue(7), '7')
  assert.equal(gradeInputValue(null), '')
})

test('después de calificar a un alumno viene el siguiente de la lista; el último no tiene siguiente', () => {
  const ids = ['p-a', 'p-b', 'p-c']
  assert.equal(nextStudent(ids, 'p-a'), 'p-b')
  assert.equal(nextStudent(ids, 'p-b'), 'p-c')
  assert.equal(nextStudent(ids, 'p-c'), null)
  assert.equal(nextStudent(ids, 'p-x'), null)
})

test('la fecha límite dice si vence o venció, en la hora de Buenos Aires', () => {
  const dueAt = '2026-11-14T02:59:00.000Z'
  assert.match(dueLabel({ dueAt, past: false }), /^Vence vie.*13 nov.*23:59$/)
  assert.match(dueLabel({ dueAt, past: true }), /^Venció vie.*13 nov.*23:59$/)
})

test('la fecha límite de una tarea de otro año dice de qué año es', () => {
  const now = '2026-11-13T12:00:00-03:00'
  assert.equal(dueLabel({ dueAt: '2025-03-02T04:00:00.000Z', past: true }, now), 'Venció dom, 2 mar 2025, 01:00')
  assert.equal(dueLabel({ dueAt: '2026-11-14T02:59:00.000Z', past: false }, now), 'Vence vie, 13 nov, 23:59')
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

test('un atraso se escribe en la unidad que se entiende: minutos, horas con minutos, días con horas', () => {
  assert.equal(durationLabel(1), '1 min')
  assert.equal(durationLabel(45), '45 min')
  assert.equal(durationLabel(60), '1 h')
  assert.equal(durationLabel(150), '2 h 30 min')
  assert.equal(durationLabel(24 * 60), '1 día')
  assert.equal(durationLabel(24 * 60 + 4 * 60 + 20), '1 día 4 h')
  assert.equal(durationLabel(3 * 24 * 60), '3 días')
  assert.equal(durationLabel(0), '1 min')
})

test('el estado de una entrega dice si fue a tiempo o atrasada y cuánto', () => {
  assert.equal(submissionStatus({ late: null }), 'Entregada')
  assert.equal(submissionStatus({ late: { minutes: 150 } }), 'Atrasada · 2 h 30 min')
})

test('el enlace de una entrega conserva la comisión y escapa los ids', () => {
  assert.equal(
    submissionHref('am1', 'tarea-1', 'entrega-2', 'sec-am1-fi-a'),
    '/materias/am1/tareas/tarea-1/entregas/entrega-2?comision=sec-am1-fi-a'
  )
  assert.equal(submissionHref('a/b', 't 1', 'e/2'), '/materias/a%2Fb/tareas/t%201/entregas/e%2F2')
})

test('el estado de cada alumno dice si entregó, si fue tarde y cuánto, o que no entregó', () => {
  assert.equal(rowStatus({ submission: null }), 'No entregó')
  assert.equal(rowStatus({ submission: { late: null } }), 'Entregada')
  assert.equal(rowStatus({ submission: { late: { minutes: 150 } } }), 'Atrasada · 2 h 30 min')
})

test('el resumen de quién entregó cuenta las atrasadas como entregadas y solo las nombra si hay', () => {
  assert.equal(countsLabel({ onTime: 2, late: 1, missing: 3 }), '3 entregaron · 1 atrasada · 3 sin entregar')
  assert.equal(countsLabel({ onTime: 1, late: 0, missing: 1 }), '1 entregó · 1 sin entregar')
  assert.equal(countsLabel({ onTime: 0, late: 2, missing: 0 }), '2 entregaron · 2 atrasadas · 0 sin entregar')
})

test('los enlaces de pegar notas llevan la comisión y la columna, y Calificaciones cuenta las notas pegadas', () => {
  assert.equal(pasteGradesHref('am1'), '/materias/am1/calificaciones/pegar')
  assert.equal(
    pasteGradesHref('am1', { comision: 'sec-a', columna: 'evaluacion:ev-4' }),
    '/materias/am1/calificaciones/pegar?comision=sec-a&columna=evaluacion%3Aev-4'
  )
  assert.equal(
    gradesHref('am1', { comision: 'sec-a', pegadas: 12 }),
    '/materias/am1/calificaciones?comision=sec-a&pegadas=12'
  )
  assert.equal(notesLabel(1), '1 nota')
  assert.equal(notesLabel(12), '12 notas')
})

test('el texto pegado es el mismo venga con saltos de Windows, de Mac viejo o de Unix', () => {
  // El navegador manda el textarea con CRLF y el estado del cliente lo tiene con LF: los dos tienen que coincidir.
  assert.equal(pastedText('30101\t8,5\r\n30102\t7\r\n30103\tA'), '30101\t8,5\n30102\t7\n30103\tA')
  assert.equal(pastedText('30101\t8\r30102\t7'), '30101\t8\n30102\t7')
  assert.equal(pastedText('30101\t8\n30102\t7'), '30101\t8\n30102\t7')
})

test('cuánto falta para una fecha límite se dice en días de Buenos Aires', () => {
  // Martes 10/11/2026 a las 23:00 en Buenos Aires.
  const now = '2026-11-11T02:00:00.000Z'
  assert.equal(relativeDue('2026-11-10T23:59:00-03:00', now), 'vence hoy')
  assert.equal(relativeDue('2026-11-11T00:30:00-03:00', now), 'vence mañana')
  assert.equal(relativeDue('2026-11-13T23:59:00-03:00', now), 'vence en 3 días')
  assert.equal(relativeDue('2026-11-10T22:00:00-03:00', now), 'venció')
})

test('la nota de una tarea se busca en Notas, con la materia elegida', () => {
  assert.equal(subjectNotesHref('am1'), '/notas?materia=am1')
  assert.equal(subjectNotesHref('a/b'), '/notas?materia=a%2Fb')
})
