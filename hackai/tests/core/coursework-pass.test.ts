/* Pase de notas al SIU de Seguimiento (B5): publicar pasa las notas de las evaluaciones del SIU, si falla quedan
   pendientes y pasan en el reintento sin duplicarse, y con un SIU que no deja escribir quedan «sin pasar» y el alumno
   las ve igual. Por la interfaz del módulo, con Personas y Cursada reales sobre los puertos en memoria. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework, type NewGrade, type NewTask } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import type { SiuCapabilities, SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'
import { movableClock } from '@/tests/core/helpers'

const A = 'sec-am1-fi-a'
const SEGUNDO_PARCIAL = 'evaluacion:ev-5'
const PRIMER_PARCIAL = 'evaluacion:ev-4'
const siuId = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.siuId

/** El SIU en memoria, con las escrituras que se pueden hacer fallar y contar. */
function build(capabilities: Partial<SiuCapabilities> = {}) {
  const { clock, advance } = movableClock(syntheticData.now)
  const memory = createMemorySiu(syntheticData, clock, { capabilities })
  const state = { failWrites: false, writes: 0 }
  const siu: SiuPort = {
    ...memory,
    async writeAssessmentGrade(...args) {
      state.writes += 1
      return state.failWrites ? fail('falla-externa') : memory.writeAssessmentGrade(...args)
    }
  }
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
  const studies = createStudies({ people, siu, classroom: createMemoryClassroom(syntheticData), clock })
  const coursework = createCoursework({
    studies,
    files: createMemoryFiles(),
    clock,
    store: createMemoryCourseworkStore()
  })
  return { coursework, siu, state, advance }
}

const gradeOf = (fields: Partial<NewGrade> = {}): NewGrade => ({
  sectionId: A,
  columnId: SEGUNDO_PARCIAL,
  studentId: 'p-taguirre',
  value: 8,
  absent: false,
  comment: '',
  ...fields
})

const taskOf = (fields: Partial<NewTask> = {}): NewTask => ({
  subjectId: 'am1',
  sectionIds: [A],
  name: 'Práctica 3',
  instructions: 'Resolvé los ejercicios 1 a 10.',
  dueAt: '2026-11-13T23:59:00-03:00',
  graded: true,
  ...fields
})

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

/** Lo que tiene cargado el SIU de una evaluación para el alumno. */
async function siuGrades(siu: SiuPort, personId: string, assessmentId: string) {
  const read = value(await siu.provisionalResults(siuId(personId)))
  return read.filter((r) => r.assessmentId === assessmentId).map((r) => r.grade)
}

async function cellOf(coursework: ReturnType<typeof build>['coursework'], personId: string, columnId: string) {
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  return book.students.find((s) => s.personId === personId)?.cells[columnId]
}

// --- Publicar pasa las notas ---------------------------------------------------

test('publicar una evaluación del SIU pasa sus notas al SIU y cada una queda «pasada»', async () => {
  const { coursework, siu } = build()
  value(await coursework.grade('p-mledesma', gradeOf({ value: 8 })))
  value(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-lbenitez', value: 6.5 })))
  value(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-jescobar', value: null, absent: true })))
  // Mientras es un borrador no se pasa nada.
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [])
  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, null)

  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))

  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [8])
  assert.deepEqual(await siuGrades(siu, 'p-lbenitez', 'ev-5'), [6.5])
  assert.deepEqual(await siuGrades(siu, 'p-jescobar', 'ev-5'), [null])
  for (const student of ['p-taguirre', 'p-lbenitez', 'p-jescobar'])
    assert.equal((await cellOf(coursework, student, SEGUNDO_PARCIAL))?.pass, 'pasado')
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.equal(book.pendingPass, 0)
})

test('una tarea con nota no existe en el SIU: queda solo en HackAI, sin estado de pase', async () => {
  const { coursework, siu, state } = build()
  const task = value(await coursework.createTask('p-mledesma', taskOf()))
  const column = `tarea:${task.id}`
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: column })))

  value(await coursework.publish('p-mledesma', A, column))

  assert.equal(state.writes, 0)
  assert.equal((await cellOf(coursework, 'p-taguirre', column))?.pass, null)
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [])
})

test('una nota que se cambia en una columna publicada vuelve a pasar con el valor nuevo, sin dejar dos', async () => {
  const { coursework, siu } = build()
  value(await coursework.grade('p-mledesma', gradeOf({ value: 4 })))
  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))

  const changed = value(await coursework.grade('p-mledesma', gradeOf({ value: 9 })))

  assert.equal(changed.pass, 'pasado')
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [9])
})

// --- Si el SIU falla -----------------------------------------------------------

test('si el SIU falla al pasar, la nota queda publicada y pendiente, y pasa en el reintento sin duplicarse', async () => {
  const { coursework, siu, state } = build()
  value(await coursework.grade('p-mledesma', gradeOf({ value: 7 })))
  state.failWrites = true

  const published = value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))

  assert.equal(published.published, 1)
  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, 'pendiente')
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1')).pendingPass, 1)
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [])
  // El alumno la ve igual.
  assert.equal(value(await coursework.publishedFor('p-taguirre'))[0].value, 7)

  // Mientras sigue caído, el reintento no pasa nada y la nota sigue pendiente.
  assert.deepEqual(value(await coursework.retryPass()), { passed: 0, pending: 1 })

  state.failWrites = false
  assert.deepEqual(value(await coursework.retryPass()), { passed: 1, pending: 0 })
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [7])
  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, 'pasado')
  // Reintentar de nuevo no repite ni escribe de más.
  const writes = state.writes
  assert.deepEqual(value(await coursework.retryPass()), { passed: 0, pending: 0 })
  assert.equal(state.writes, writes)
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [7])
})

test('el reintento pasa las notas en el orden en que se publicaron y corta en cuanto el SIU falla', async () => {
  const { coursework, siu, state, advance } = build()
  state.failWrites = true
  value(await coursework.grade('p-mledesma', gradeOf({ columnId: PRIMER_PARCIAL, value: 5 })))
  value(await coursework.grade('p-mledesma', gradeOf({ value: 9 })))
  // Se publica primero el segundo parcial, después el primero.
  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))
  advance(60_000)
  value(await coursework.publish('p-mledesma', A, PRIMER_PARCIAL))
  const order: string[] = []
  const memory = siu.writeAssessmentGrade
  siu.writeAssessmentGrade = async (person, section, assessment, grade) => {
    order.push(assessment)
    return memory(person, section, assessment, grade)
  }

  state.failWrites = false
  assert.deepEqual(value(await coursework.retryPass()), { passed: 2, pending: 0 })

  assert.deepEqual(order, ['ev-5', 'ev-4'])
})

test('una comisión que queda pendiente porque el docente ya no la dicta no frena el reintento de las demás', async () => {
  const { coursework, siu, state, advance } = build()
  const AGA = 'sec-aga-fi-a'
  state.failWrites = true
  value(await coursework.grade('p-mledesma', gradeOf({ value: 6 })))
  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))
  advance(60_000)
  value(await coursework.grade('p-mledesma', gradeOf({ sectionId: AGA, columnId: 'evaluacion:ev-1', value: 9 })))
  value(await coursework.publish('p-mledesma', AGA, 'evaluacion:ev-1'))
  // La primera comisión publicada deja de ser suya.
  const taught = siu.teacherSections
  siu.teacherSections = async (id) => {
    const sections = await taught(id)
    return sections.ok ? { ok: true, value: sections.value.filter((s) => s.id !== A) } : sections
  }

  state.failWrites = false
  assert.deepEqual(value(await coursework.retryPass()), { passed: 1, pending: 1 })
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-1'), [9])
})

test('el docente reintenta el pase de su comisión desde Calificaciones; no el de otra', async () => {
  const { coursework, state } = build()
  value(await coursework.grade('p-mledesma', gradeOf()))
  state.failWrites = true
  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))
  state.failWrites = false

  assert.deepEqual(await coursework.retryPassOf('p-gferreyra', A), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.retryPassOf('p-taguirre', A), { ok: false, error: 'solo-docentes' })
  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, 'pendiente')

  assert.deepEqual(value(await coursework.retryPassOf('p-mledesma', A)), { passed: 1, pending: 0 })
  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, 'pasado')
})

// --- Si el SIU no deja escribir ------------------------------------------------

test('con un SIU que no deja escribir notas, la nota queda «sin pasar al SIU» y el alumno la ve igual', async () => {
  const { coursework, siu } = build({ canWriteGrades: false })
  value(await coursework.grade('p-mledesma', gradeOf({ value: 7 })))

  value(await coursework.publish('p-mledesma', A, SEGUNDO_PARCIAL))

  assert.equal((await cellOf(coursework, 'p-taguirre', SEGUNDO_PARCIAL))?.pass, 'no-permitido')
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1')).pendingPass, 0)
  assert.deepEqual(await siuGrades(siu, 'p-taguirre', 'ev-5'), [])
  const seen = value(await coursework.publishedFor('p-taguirre'))
  assert.deepEqual(
    seen.map((g) => [g.refId, g.value]),
    [['ev-5', 7]]
  )
  // No se reintenta lo que el SIU no permite.
  assert.deepEqual(value(await coursework.retryPass()), { passed: 0, pending: 0 })
})

// --- Cursada --------------------------------------------------------------------

test('Cursada pasa notas solo para un docente de la comisión y no para alumnos que no la cursan', async () => {
  const studies = createStudiesFor()

  const grades = [{ studentId: 'p-taguirre', target: { kind: 'evaluacion' as const, assessmentId: 'ev-5' }, value: 7 }]
  assert.deepEqual(await studies.passGrades('p-gferreyra', A, grades), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await studies.passGrades('p-taguirre', A, grades), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(
    value(
      await studies.passGrades('p-mledesma', A, [
        ...grades,
        // Matías Cabrera cursa Análisis I, pero en la B.
        { studentId: 'p-mcabrera', target: { kind: 'evaluacion' as const, assessmentId: 'ev-5' }, value: 7 }
      ])
    ),
    ['pasado', 'no-permitido']
  )
})

test('Cursada pasa la nota de cursada y la lee la historia del SIU', async () => {
  const { siu } = build()
  const studies = createStudiesFor(siu)

  const outcome = value(
    await studies.passGrades('p-mledesma', A, [{ studentId: 'p-taguirre', target: { kind: 'cursada' }, value: 6 }])
  )

  assert.deepEqual(outcome, ['pasado'])
  const history = value(await siu.history(siuId('p-taguirre')))
  assert.deepEqual(
    history.filter((h) => h.type === 'cursada' && h.subjectId === 'am1').map((h) => [h.grade, h.result]),
    [[6, 'regular']]
  )
})

function createStudiesFor(siu: SiuPort = build().siu) {
  const { clock } = movableClock(syntheticData.now)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
  return createStudies({ people, siu, classroom: createMemoryClassroom(syntheticData), clock })
}
