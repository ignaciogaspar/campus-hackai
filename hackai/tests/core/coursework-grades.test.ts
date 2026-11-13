/* Calificaciones de Seguimiento: las columnas de una comisión, la nota y el comentario, publicar y lo que ve el
   alumno. Todo por la interfaz del módulo, con Personas y Cursada reales sobre los puertos en memoria. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework, type NewGrade, type NewTask } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import { fallible, movableClock } from '@/tests/core/helpers'

const A = 'sec-am1-fi-a'
const B = 'sec-am1-fi-b'
const DUE = '2026-11-13T23:59:00-03:00'
const PARCIAL_1 = 'evaluacion:ev-4'

/** Análisis I con Gustavo Ferreyra también en la A, para una tarea de las dos comisiones. */
function withTwoSectionsForOneTeacher(): SyntheticData {
  const data = structuredClone(syntheticData)
  const section = data.siu.sections.find((s) => s.id === A)
  const gustavo = data.people.find((p) => p.id === 'p-gferreyra')
  assert.ok(section && gustavo)
  section.teacherIds.push(gustavo.siuId)
  return data
}

function build(data: SyntheticData = syntheticData) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(data, clock))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom: createMemoryClassroom(data), clock })
  const coursework = createCoursework({
    studies,
    files: createMemoryFiles(),
    clock,
    store: createMemoryCourseworkStore()
  })
  return { coursework, siuState, advance }
}

const taskOf = (fields: Partial<NewTask> = {}): NewTask => ({
  subjectId: 'am1',
  sectionIds: [A],
  name: 'Práctica 3',
  instructions: 'Resolvé los ejercicios 1 a 10.',
  dueAt: DUE,
  graded: true,
  ...fields
})

const gradeOf = (fields: Partial<NewGrade> = {}): NewGrade => ({
  sectionId: A,
  columnId: PARCIAL_1,
  studentId: 'p-taguirre',
  value: 8,
  absent: false,
  comment: 'Muy bien el punto 2.',
  ...fields
})

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const upload = (name: string) => ({ name, contentType: 'text/plain', bytes: new TextEncoder().encode(name) })

// --- Columnas ---------------------------------------------------------------

test('Calificaciones tiene una columna por tarea con nota y una por parcial del SIU, y una fila por alumno', async () => {
  const { coursework } = build()
  const task = value(await coursework.createTask('p-mledesma', taskOf()))
  value(await coursework.createTask('p-mledesma', taskOf({ name: 'Guía de apoyo', graded: false })))

  const book = value(await coursework.gradebook('p-mledesma', 'am1'))

  assert.equal(book.sectionId, A)
  assert.deepEqual(
    book.columns.map((c) => [c.id, c.name, c.kind, c.assessmentKind, c.publishedAt]),
    [
      ['evaluacion:ev-4', 'Primer parcial', 'evaluacion', 'parcial', null],
      [`tarea:${task.id}`, 'Práctica 3', 'tarea', null, null],
      ['evaluacion:ev-5', 'Segundo parcial', 'evaluacion', 'parcial', null],
      ['evaluacion:ev-6', 'Recuperatorio', 'evaluacion', 'recuperatorio', null]
    ]
  )
  assert.deepEqual(
    book.students.map((s) => [s.personId, s.name, Object.keys(s.cells).length]),
    [
      ['p-taguirre', 'Aguirre, Tomás', 0],
      ['p-lbenitez', 'Benítez, Lucía', 0],
      ['p-jescobar', 'Escobar, Joaquín', 0]
    ]
  )
})

test('una tarea sin nota no tiene columna', async () => {
  const { coursework } = build()
  value(await coursework.createTask('p-mledesma', taskOf({ name: 'Guía de apoyo', graded: false })))

  const book = value(await coursework.gradebook('p-mledesma', 'am1'))

  assert.ok(book.columns.every((c) => c.kind === 'evaluacion'))
})

test('una tarea de dos comisiones tiene una columna en cada una, y cada docente ve las suyas', async () => {
  const { coursework } = build(withTwoSectionsForOneTeacher())
  const task = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [A, B] })))
  value(await coursework.createTask('p-gferreyra', taskOf({ name: 'Solo de B', sectionIds: [B] })))

  const ofA = value(await coursework.gradebook('p-gferreyra', 'am1', A))
  const ofB = value(await coursework.gradebook('p-gferreyra', 'am1', B))

  assert.ok(ofA.columns.some((c) => c.id === `tarea:${task.id}`))
  assert.ok(!ofA.columns.some((c) => c.name === 'Solo de B'))
  assert.ok(ofB.columns.some((c) => c.name === 'Solo de B'))
  assert.deepEqual(
    ofA.sections.map((s) => s.sectionId),
    [A, B]
  )
})

test('un alumno o un docente de otra comisión no ven Calificaciones', async () => {
  const { coursework } = build()
  assert.deepEqual(await coursework.gradebook('p-taguirre', 'am1'), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await coursework.gradebook('p-mledesma', 'otra-materia'), { ok: false, error: 'sin-acceso' })
  // La comisión que pide no es suya: ve la primera de las suyas, nunca la ajena.
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1', B)).sectionId, A)
})

// --- Nota y comentario ------------------------------------------------------

test('el docente pone nota y comentario a un alumno y los ve en la fila', async () => {
  const { coursework } = build()

  const cell = value(await coursework.grade('p-mledesma', gradeOf({ value: 8.456 })))

  assert.deepEqual(cell, {
    value: 8.46,
    absent: false,
    comment: 'Muy bien el punto 2.',
    gradedAt: syntheticData.now,
    published: false
  })
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.deepEqual(book.students[0].cells[PARCIAL_1], cell)
  assert.equal(book.columns[0].graded, 1)
  assert.equal(book.columns[0].unpublished, 1)
})

test('volver a calificar reemplaza la nota; un ausente no lleva número', async () => {
  const { coursework } = build()
  value(await coursework.grade('p-mledesma', gradeOf()))

  const absent = value(await coursework.grade('p-mledesma', gradeOf({ value: 9, absent: true, comment: '' })))

  assert.equal(absent.value, null)
  assert.equal(absent.absent, true)
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.equal(book.columns[0].graded, 1)
})

test('rechaza una nota que no es de 1 a 10, la falta de nota y un comentario larguísimo', async () => {
  const { coursework } = build()
  for (const bad of [0, 10.5, Number.NaN, null]) {
    assert.deepEqual(await coursework.grade('p-mledesma', gradeOf({ value: bad })), {
      ok: false,
      error: 'nota-invalida'
    })
  }
  assert.deepEqual(await coursework.grade('p-mledesma', gradeOf({ comment: 'x'.repeat(2001) })), {
    ok: false,
    error: 'comentario-invalido'
  })
})

test('solo califica un docente de la comisión, a un alumno de la comisión y en una columna de la comisión', async () => {
  const { coursework } = build()
  const ofB = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [B] })))
  const noGrade = value(await coursework.createTask('p-mledesma', taskOf({ graded: false })))

  assert.deepEqual(await coursework.grade('p-taguirre', gradeOf()), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await coursework.grade('p-gferreyra', gradeOf()), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-mcabrera' })), {
    ok: false,
    error: 'alumno-desconocido'
  })
  for (const columnId of [`tarea:${ofB.id}`, `tarea:${noGrade.id}`, 'evaluacion:ev-7', 'basura']) {
    assert.deepEqual(await coursework.grade('p-mledesma', gradeOf({ columnId })), {
      ok: false,
      error: 'columna-desconocida'
    })
  }
})

test('calificar la entrega de una tarea cierra su reemplazo', async () => {
  const { coursework } = build()
  const task = value(await coursework.createTask('p-mledesma', taskOf()))
  value(await coursework.submit('p-taguirre', task.id, [upload('tp.txt')]))
  value(await coursework.submit('p-taguirre', task.id, [upload('tp-v2.txt')]))

  value(await coursework.grade('p-mledesma', gradeOf({ columnId: `tarea:${task.id}` })))

  assert.deepEqual(await coursework.submit('p-taguirre', task.id, [upload('tp-v3.txt')]), {
    ok: false,
    error: 'ya-calificada'
  })
  assert.equal(value(await coursework.task('p-taguirre', task.id)).submission?.graded, true)
})

// --- Publicar ---------------------------------------------------------------

test('un alumno no ve una nota de una columna sin publicar', async () => {
  const { coursework } = build()
  value(await coursework.grade('p-mledesma', gradeOf()))

  assert.deepEqual(value(await coursework.publishedFor('p-taguirre')), [])
  assert.deepEqual(value(await coursework.newGrades('p-taguirre', null)), [])
})

test('publicar una columna: el alumno ve la nota y el comentario entero, y le llega a la campana', async () => {
  const { coursework } = build()
  const comment = 'Muy bien el punto 2. '.repeat(30).trim()
  value(await coursework.grade('p-mledesma', gradeOf({ comment })))
  value(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-lbenitez', value: 6 })))
  assert.deepEqual(value(await coursework.newGrades('p-taguirre', null)), [])

  const result = value(await coursework.publish('p-mledesma', A, PARCIAL_1))

  assert.deepEqual(result, { published: 2 })
  const [mine, ...others] = value(await coursework.publishedFor('p-taguirre'))
  assert.equal(others.length, 0)
  assert.deepEqual(mine, {
    subjectId: 'am1',
    subjectName: 'Análisis Matemático I',
    sectionId: A,
    kind: 'evaluacion',
    refId: 'ev-4',
    name: 'Primer parcial',
    date: null,
    value: 8,
    absent: false,
    comment,
    publishedAt: syntheticData.now
  })
  assert.deepEqual(value(await coursework.newGrades('p-taguirre', null)), [mine])
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.equal(book.columns[0].publishedAt, syntheticData.now)
  assert.equal(book.columns[0].unpublished, 0)
})

test('publicar una tarea con nota muestra el nombre de la tarea y su fecha límite', async () => {
  const { coursework } = build()
  const task = value(await coursework.createTask('p-mledesma', taskOf({ name: 'Práctica 3' })))
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: `tarea:${task.id}`, value: 10 })))
  value(await coursework.publish('p-mledesma', A, `tarea:${task.id}`))

  const [grade] = value(await coursework.publishedFor('p-taguirre'))

  assert.equal(grade.kind, 'tarea')
  assert.equal(grade.name, 'Práctica 3')
  assert.equal(grade.date, new Date(DUE).toISOString())
  assert.equal(grade.value, 10)
})

test('publicar es por columna y por comisión, y no repite lo ya publicado', async () => {
  const { coursework, advance } = build(withTwoSectionsForOneTeacher())
  const task = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [A, B] })))
  const column = `tarea:${task.id}`
  value(await coursework.grade('p-gferreyra', gradeOf({ columnId: column })))
  value(await coursework.grade('p-gferreyra', gradeOf({ sectionId: B, columnId: column, studentId: 'p-mcabrera' })))
  value(await coursework.grade('p-gferreyra', gradeOf({ columnId: PARCIAL_1, value: 5 })))

  assert.deepEqual(value(await coursework.publish('p-gferreyra', A, column)), { published: 1 })
  advance(60)
  assert.deepEqual(value(await coursework.publish('p-gferreyra', A, column)), { published: 0 })

  // Ni la columna de la otra comisión ni la otra columna de la misma comisión salieron.
  assert.deepEqual(value(await coursework.publishedFor('p-mcabrera')), [])
  assert.deepEqual(
    value(await coursework.publishedFor('p-taguirre')).map((g) => g.refId),
    [task.id]
  )
  assert.equal(value(await coursework.publishedFor('p-taguirre'))[0].publishedAt, syntheticData.now)
})

test('no se publica una columna sin notas cargadas, ni la de otra comisión', async () => {
  const { coursework } = build()
  assert.deepEqual(await coursework.publish('p-mledesma', A, PARCIAL_1), { ok: false, error: 'sin-notas' })
  value(await coursework.grade('p-mledesma', gradeOf()))
  assert.deepEqual(await coursework.publish('p-taguirre', A, PARCIAL_1), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await coursework.publish('p-gferreyra', A, PARCIAL_1), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.publish('p-mledesma', A, 'evaluacion:ev-1'), {
    ok: false,
    error: 'columna-desconocida'
  })
})

test('una nota cargada o cambiada en una columna ya publicada se ve al toque', async () => {
  const { coursework, advance } = build()
  value(await coursework.grade('p-mledesma', gradeOf()))
  value(await coursework.publish('p-mledesma', A, PARCIAL_1))
  advance(30)

  const late = value(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-lbenitez', value: 7 })))
  value(await coursework.grade('p-mledesma', gradeOf({ value: 9, comment: 'Corregida' })))

  assert.equal(late.published, true)
  const mine = value(await coursework.publishedFor('p-taguirre'))
  assert.equal(mine[0].value, 9)
  assert.equal(mine[0].comment, 'Corregida')
  assert.equal(mine[0].publishedAt, '2026-11-10T15:30:00.000Z')
  assert.equal(value(await coursework.publishedFor('p-lbenitez')).length, 1)
})

// --- La campana -------------------------------------------------------------

test('las notas nuevas son las publicadas con número en la última semana y después de que el alumno las vio', async () => {
  const { coursework, advance } = build()
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: 'evaluacion:ev-4', value: 8 })))
  value(await coursework.publish('p-mledesma', A, 'evaluacion:ev-4'))
  advance(60)
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: 'evaluacion:ev-5', value: 6 })))
  value(await coursework.publish('p-mledesma', A, 'evaluacion:ev-5'))
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: 'evaluacion:ev-6', value: 1, absent: true })))
  value(await coursework.publish('p-mledesma', A, 'evaluacion:ev-6'))

  const all = value(await coursework.newGrades('p-taguirre', null))
  const afterSeen = value(await coursework.newGrades('p-taguirre', syntheticData.now))
  const seenAll = value(await coursework.newGrades('p-taguirre', '2026-11-10T16:00:00.000Z'))
  advance(8 * 24 * 60)
  const nextWeek = value(await coursework.newGrades('p-taguirre', null))

  // Más nueva primero, y el ausente no es una nota que llega.
  assert.deepEqual(
    all.map((g) => g.refId),
    ['ev-5', 'ev-4']
  )
  assert.deepEqual(
    afterSeen.map((g) => g.refId),
    ['ev-5']
  )
  assert.deepEqual(seenAll, [])
  assert.deepEqual(nextWeek, [])
  // El ausente sigue visible en lo publicado.
  assert.equal(value(await coursework.publishedFor('p-taguirre')).length, 3)
})

test('con el SIU caído no se pueden leer las comisiones: falla externa', async () => {
  const { coursework, siuState } = build()
  siuState.down = true
  assert.deepEqual(await coursework.gradebook('p-mledesma', 'am1'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await coursework.publishedFor('p-taguirre'), { ok: false, error: 'falla-externa' })
})
