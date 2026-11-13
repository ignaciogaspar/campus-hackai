/* Pesos y nota de cursada de Seguimiento (B6): la nota de cursada pondera por peso, ignora las tareas sin nota y las
   columnas sin nota del alumno, respeta la que pisó el docente y, al publicarla, pasa al SIU con su estado de pase.
   Por la interfaz del módulo, con Personas y Cursada reales sobre los puertos en memoria. */
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
const PRIMER_PARCIAL = 'evaluacion:ev-4'
const SEGUNDO_PARCIAL = 'evaluacion:ev-5'
const siuId = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.siuId

function build(capabilities: Partial<SiuCapabilities> = {}) {
  const { clock, advance } = movableClock(syntheticData.now)
  const memory = createMemorySiu(syntheticData, clock, { capabilities })
  const state = { failWrites: false, writes: 0 }
  const siu: SiuPort = {
    ...memory,
    async writeCourseGrade(...args) {
      state.writes += 1
      return state.failWrites ? fail('falla-externa') : memory.writeCourseGrade(...args)
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

type Built = ReturnType<typeof build>

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const gradeOf = (
  columnId: string,
  studentId: string,
  grade: number | null,
  fields: Partial<NewGrade> = {}
): NewGrade => ({
  sectionId: A,
  columnId,
  studentId,
  value: grade,
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

async function courseOf({ coursework }: Built, personId: string) {
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  const student = book.students.find((s) => s.personId === personId)
  assert.ok(student)
  return student.course
}

async function siuCourseGrades({ siu }: Built, personId: string) {
  const history = value(await siu.history(siuId(personId)))
  return history.filter((h) => h.type === 'cursada' && h.subjectId === 'am1').map((h) => h.grade)
}

/** Dos parciales y una tarea con nota, con pesos 60, 20 y 20: Tomás tiene el primer parcial (8) y la tarea (10). */
async function withWeights(built: Built) {
  const { coursework } = built
  const task = value(await coursework.createTask('p-mledesma', taskOf()))
  value(await coursework.grade('p-mledesma', gradeOf(PRIMER_PARCIAL, 'p-taguirre', 8)))
  value(await coursework.grade('p-mledesma', gradeOf(`tarea:${task.id}`, 'p-taguirre', 10)))
  value(await coursework.grade('p-mledesma', gradeOf(PRIMER_PARCIAL, 'p-lbenitez', 5)))
  value(
    await coursework.setWeights('p-mledesma', A, [
      { columnId: PRIMER_PARCIAL, weight: 60 },
      { columnId: SEGUNDO_PARCIAL, weight: 20 },
      { columnId: `tarea:${task.id}`, weight: 20 }
    ])
  )
  return task
}

// --- El cálculo ------------------------------------------------------------------

test('la nota de cursada es el promedio ponderado y reparte el peso entre las columnas con nota del alumno', async () => {
  const built = build()
  await withWeights(built)

  // Tomás no tiene el segundo parcial: (8 * 60 + 10 * 20) / 80.
  assert.equal((await courseOf(built, 'p-taguirre')).calculated, 8.5)
  assert.equal((await courseOf(built, 'p-taguirre')).value, 8.5)
  // Lucía solo tiene el primer parcial.
  assert.equal((await courseOf(built, 'p-lbenitez')).calculated, 5)
  // Quien no tiene ninguna nota no tiene nota de cursada.
  assert.deepEqual(await courseOf(built, 'p-jescobar'), {
    calculated: null,
    value: null,
    edited: false,
    published: null,
    pass: null,
    condition: null
  })
})

test('un ausente, una columna sin peso y una tarea sin nota no cuentan', async () => {
  const built = build()
  const { coursework } = built
  const sinNota = value(await coursework.createTask('p-mledesma', taskOf({ name: 'Guía de apoyo', graded: false })))
  value(await coursework.grade('p-mledesma', gradeOf(PRIMER_PARCIAL, 'p-taguirre', 8)))
  value(await coursework.grade('p-mledesma', gradeOf(SEGUNDO_PARCIAL, 'p-taguirre', null, { absent: true })))
  value(
    await coursework.setWeights('p-mledesma', A, [
      { columnId: PRIMER_PARCIAL, weight: 50 },
      { columnId: SEGUNDO_PARCIAL, weight: 50 }
    ])
  )

  // El ausente no baja la nota ni cuenta como cero.
  assert.equal((await courseOf(built, 'p-taguirre')).calculated, 8)
  // La tarea sin nota no tiene columna y, por lo tanto, no tiene peso.
  const refused = await coursework.setWeights('p-mledesma', A, [{ columnId: `tarea:${sinNota.id}`, weight: 10 }])
  assert.deepEqual(refused, { ok: false, error: 'columna-desconocida' })
  // Sin peso, o con peso cero, la columna no cuenta.
  value(await coursework.setWeights('p-mledesma', A, [{ columnId: PRIMER_PARCIAL, weight: 0 }]))
  assert.equal((await courseOf(built, 'p-taguirre')).calculated, null)
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.deepEqual(
    book.columns.filter((c) => c.id !== 'evaluacion:ev-6').map((c) => [c.id, c.weight]),
    [
      [PRIMER_PARCIAL, null],
      [SEGUNDO_PARCIAL, 50]
    ]
  )
  assert.equal(book.course.weightTotal, 50)
})

test('el resumen cuenta cuántos alumnos tienen nota de cursada y la suma de los pesos', async () => {
  const built = build()
  await withWeights(built)

  const { course } = value(await built.coursework.gradebook('p-mledesma', 'am1'))

  assert.deepEqual(course, {
    weightTotal: 100,
    promotion: { promotable: false, minimum: 7 },
    graded: 2,
    unpublished: 2,
    pass: { passed: 0, pending: 0, refused: 0 }
  })
})

// --- Pisar la nota ----------------------------------------------------------------

test('la nota que pisó el docente se respeta aunque cambien las otras notas, y queda marcada como editada', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)

  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', 7))
  value(await coursework.grade('p-mledesma', gradeOf(SEGUNDO_PARCIAL, 'p-taguirre', 2)))

  const cell = await courseOf(built, 'p-taguirre')
  assert.deepEqual([cell.value, cell.edited, cell.published], [7, true, null])
  // Lo calculado sigue a la vista: (8 * 60 + 2 * 20 + 10 * 20) / 100.
  assert.equal(cell.calculated, 7.2)
})

test('con «volver al cálculo» la nota vuelve a ser la calculada y deja de estar editada', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', 7))

  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', null))

  const cell = await courseOf(built, 'p-taguirre')
  assert.deepEqual([cell.value, cell.edited], [8.5, false])
  // Volver al cálculo de quien nunca la pisó no cambia nada.
  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-lbenitez', null))
  assert.equal((await courseOf(built, 'p-lbenitez')).value, 5)
})

// --- Publicar pasa al SIU --------------------------------------------------------

test('publicar la nota de cursada la pasa al SIU con su estado y el alumno la ve en su materia', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-lbenitez', 6.5))
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [])

  assert.deepEqual(value(await coursework.publishCourseGrade('p-mledesma', A)), { published: 2 })

  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [8.5])
  assert.deepEqual(await siuCourseGrades(built, 'p-lbenitez'), [6.5])
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.deepEqual(book.course, {
    weightTotal: 100,
    promotion: { promotable: false, minimum: 7 },
    graded: 2,
    unpublished: 0,
    pass: { passed: 2, pending: 0, refused: 0 }
  })
  const taguirre = book.students.find((s) => s.personId === 'p-taguirre')?.course
  assert.deepEqual([taguirre?.published, taguirre?.pass, taguirre?.edited], [8.5, 'pasado', false])
  const published = value(await coursework.publishedFor('p-taguirre'))
  assert.deepEqual(
    published.filter((g) => g.kind === 'cursada').map((g) => [g.name, g.value, g.sectionId]),
    [['Nota de cursada', 8.5, A]]
  )
})

test('publicar de nuevo no repite nada; si cambia el cálculo, publica solo lo que cambió', async () => {
  const built = build()
  const { coursework, state } = built
  await withWeights(built)
  value(await coursework.publishCourseGrade('p-mledesma', A))
  assert.deepEqual(value(await coursework.publishCourseGrade('p-mledesma', A)), { published: 0 })
  assert.equal(state.writes, 2)

  value(await coursework.grade('p-mledesma', gradeOf(SEGUNDO_PARCIAL, 'p-taguirre', 2)))
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1')).course.unpublished, 1)
  assert.deepEqual(value(await coursework.publishCourseGrade('p-mledesma', A)), { published: 1 })

  assert.equal(state.writes, 3)
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [7.2])
  assert.equal((await courseOf(built, 'p-taguirre')).published, 7.2)
})

test('pisar una nota de cursada ya publicada la publica y la pasa al toque', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  value(await coursework.publishCourseGrade('p-mledesma', A))

  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', 9))

  const cell = await courseOf(built, 'p-taguirre')
  assert.deepEqual([cell.published, cell.value, cell.edited, cell.pass], [9, 9, true, 'pasado'])
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [9])

  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', null))

  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [8.5])
  assert.equal((await courseOf(built, 'p-taguirre')).edited, false)
})

test('si el SIU falla, la nota de cursada queda publicada y pendiente, y pasa en el reintento sin duplicarse', async () => {
  const built = build()
  const { coursework, state } = built
  await withWeights(built)
  state.failWrites = true

  value(await coursework.publishCourseGrade('p-mledesma', A))

  const pending = await courseOf(built, 'p-taguirre')
  assert.deepEqual([pending.published, pending.pass], [8.5, 'pendiente'])
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [])
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1')).pendingPass, 2)

  state.failWrites = false
  assert.deepEqual(value(await coursework.retryPass()), { passed: 2, pending: 0 })
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [8.5])
  assert.equal((await courseOf(built, 'p-taguirre')).pass, 'pasado')
  assert.deepEqual(value(await coursework.retryPass()), { passed: 0, pending: 0 })
})

test('con un SIU que no deja escribir notas, la de cursada queda «sin pasar» y el alumno la ve igual', async () => {
  const built = build({ canWriteGrades: false })
  const { coursework } = built
  await withWeights(built)

  value(await coursework.publishCourseGrade('p-mledesma', A))

  const cell = await courseOf(built, 'p-taguirre')
  assert.deepEqual([cell.published, cell.pass], [8.5, 'no-permitido'])
  assert.deepEqual(await siuCourseGrades(built, 'p-taguirre'), [])
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.deepEqual(book.course.pass, { passed: 0, pending: 0, refused: 2 })
  assert.equal(
    value(await coursework.publishedFor('p-taguirre')).some((g) => g.kind === 'cursada'),
    true
  )
})

test('el alumno no ve la nota de cursada hasta que se publica, ni la calculada ni la que pisó el docente', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', 7))

  assert.deepEqual(value(await coursework.publishedFor('p-taguirre')), [])
  assert.deepEqual(value(await coursework.newGrades('p-taguirre', null)), [])

  value(await coursework.publishCourseGrade('p-mledesma', A))

  const news = value(await coursework.newGrades('p-taguirre', null))
  assert.deepEqual(
    news.map((g) => [g.name, g.value]),
    [['Nota de cursada', 7]]
  )
})

// --- Quién y qué ------------------------------------------------------------------

test('los pesos, la nota pisada y la publicación son solo del docente de la comisión', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  const weights = [{ columnId: PRIMER_PARCIAL, weight: 10 }]

  assert.deepEqual(await coursework.setWeights('p-taguirre', A, weights), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await coursework.overrideCourseGrade('p-taguirre', A, 'p-taguirre', 10), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.deepEqual(await coursework.publishCourseGrade('p-taguirre', A), { ok: false, error: 'solo-docentes' })
  // Un docente que no dicta esa comisión.
  assert.deepEqual(await coursework.setWeights('p-gferreyra', A, weights), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.publishCourseGrade('p-gferreyra', A), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.overrideCourseGrade('p-gferreyra', A, 'p-taguirre', 1), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.equal((await courseOf(built, 'p-taguirre')).value, 8.5)
})

test('rechaza pesos inválidos, notas fuera de escala, alumnos de otra comisión y publicar sin notas', async () => {
  const built = build()
  const { coursework } = built
  assert.deepEqual(await coursework.publishCourseGrade('p-mledesma', A), { ok: false, error: 'sin-notas' })
  await withWeights(built)

  for (const weight of [-1, 101, Number.NaN])
    assert.deepEqual(await coursework.setWeights('p-mledesma', A, [{ columnId: PRIMER_PARCIAL, weight }]), {
      ok: false,
      error: 'peso-invalido'
    })
  // Un peso inválido no deja los demás a medias.
  assert.deepEqual(
    await coursework.setWeights('p-mledesma', A, [
      { columnId: SEGUNDO_PARCIAL, weight: 90 },
      { columnId: PRIMER_PARCIAL, weight: 101 }
    ]),
    { ok: false, error: 'peso-invalido' }
  )
  assert.equal(value(await coursework.gradebook('p-mledesma', 'am1')).course.weightTotal, 100)
  for (const grade of [0, 10.5, Number.NaN])
    assert.deepEqual(await coursework.overrideCourseGrade('p-mledesma', A, 'p-taguirre', grade), {
      ok: false,
      error: 'nota-invalida'
    })
  assert.deepEqual(await coursework.overrideCourseGrade('p-mledesma', A, 'p-vfunes', 8), {
    ok: false,
    error: 'alumno-desconocido'
  })
  assert.deepEqual(await coursework.setWeights('p-mledesma', A, [{ columnId: 'tarea:no-existe', weight: 5 }]), {
    ok: false,
    error: 'columna-desconocida'
  })
})

test('volver al cálculo de una nota publicada sin nada que calcular se rechaza y deja la nota como estaba', async () => {
  const built = build()
  const { coursework } = built
  await withWeights(built)
  value(await coursework.overrideCourseGrade('p-mledesma', A, 'p-jescobar', 6))
  value(await coursework.publishCourseGrade('p-mledesma', A))

  assert.deepEqual(await coursework.overrideCourseGrade('p-mledesma', A, 'p-jescobar', null), {
    ok: false,
    error: 'sin-nota-calculada'
  })
  const cell = await courseOf(built, 'p-jescobar')
  assert.deepEqual([cell.published, cell.edited], [6, true])
})
