/* Cómo se evalúa una comisión (Seguimiento): el docente corrige el nombre y la fecha de una evaluación del SIU, suma
   instancias de examen propias que quedan solo en HackAI, y marca si la materia se promociona. La nota de cursada
   dice si el alumno promociona y pasa al SIU como promocionada. Por la interfaz del módulo, con Personas y Cursada
   reales sobre los puertos en memoria. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework, type NewGrade } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import { movableClock } from '@/tests/core/helpers'

const A = 'sec-am1-fi-a'
const SEGUNDO_PARCIAL = 'evaluacion:ev-5'

function build() {
  const { clock } = movableClock(syntheticData.now)
  const siu = createMemorySiu(syntheticData, clock)
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
  return { coursework, siu }
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${String(result.error)}`)
  return result.value
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

test('el docente corrige el nombre y la fecha de un parcial del SIU, y la columna de Calificaciones los toma', async () => {
  const { coursework } = build()
  const saved = value(
    await coursework.saveExam('p-mledesma', {
      sectionId: A,
      columnId: SEGUNDO_PARCIAL,
      kind: 'parcial',
      name: 'Segundo parcial (reprogramado)',
      date: '2026-11-27T13:00:00.000Z'
    })
  )
  assert.equal(saved.source, 'siu')
  assert.equal(saved.edited, true)
  assert.equal(saved.canDelete, false)

  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  const column = book.columns.find((c) => c.id === SEGUNDO_PARCIAL)
  assert.equal(column?.name, 'Segundo parcial (reprogramado)')
  assert.equal(column?.date, '2026-11-27T13:00:00.000Z')
})

test('una instancia propia es una columna más, no pasa al SIU y se borra solo sin notas', async () => {
  const { coursework } = build()
  const own = value(
    await coursework.saveExam('p-mledesma', {
      sectionId: A,
      kind: 'integrador',
      name: 'Integrador',
      date: '2026-12-01T13:00:00.000Z'
    })
  )
  assert.equal(own.source, 'hackai')
  assert.match(own.columnId, /^examen:/)

  value(await coursework.grade('p-mledesma', gradeOf({ columnId: own.columnId, value: 9 })))
  value(await coursework.publish('p-mledesma', A, own.columnId))
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  const cell = book.students.find((s) => s.personId === 'p-taguirre')?.cells[own.columnId]
  assert.equal(cell?.value, 9)
  assert.equal(cell?.pass, null)
  assert.equal(book.columns.find((c) => c.id === own.columnId)?.pass, null)

  assert.deepEqual(await coursework.deleteExam('p-mledesma', A, own.columnId), {
    ok: false,
    error: 'examen-con-notas'
  })
  assert.deepEqual(await coursework.deleteExam('p-mledesma', A, SEGUNDO_PARCIAL), {
    ok: false,
    error: 'columna-desconocida'
  })
})

test('una instancia propia sin notas se borra y deja de ser columna', async () => {
  const { coursework } = build()
  const own = value(
    await coursework.saveExam('p-mledesma', {
      sectionId: A,
      kind: 'recuperatorio',
      name: 'Recuperatorio',
      date: '2026-12-05T13:00:00.000Z'
    })
  )
  value(await coursework.deleteExam('p-mledesma', A, own.columnId))
  const setup = value(await coursework.evaluation('p-mledesma', 'am1'))
  assert.ok(!setup.exams.some((e) => e.columnId === own.columnId))
})

test('solo el docente de la comisión edita sus instancias, y los datos se validan', async () => {
  const { coursework } = build()
  const input = { sectionId: A, kind: 'parcial' as const, name: 'Parcial', date: '2026-12-01T13:00:00.000Z' }
  assert.deepEqual(await coursework.saveExam('p-gferreyra', input), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.saveExam('p-taguirre', input), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await coursework.saveExam('p-mledesma', { ...input, name: '  ' }), {
    ok: false,
    error: 'nombre-invalido'
  })
  assert.deepEqual(await coursework.saveExam('p-mledesma', { ...input, date: 'mañana' }), {
    ok: false,
    error: 'fecha-invalida'
  })
})

test('con la comisión promocionable, la nota de cursada desde el mínimo promociona y pasa al SIU como promocionada', async () => {
  const { coursework, siu } = build()
  value(await coursework.setWeights('p-mledesma', A, [{ columnId: SEGUNDO_PARCIAL, weight: 100 }]))
  value(await coursework.grade('p-mledesma', gradeOf({ value: 8 })))
  value(await coursework.grade('p-mledesma', gradeOf({ studentId: 'p-lbenitez', value: 5 })))
  value(await coursework.setPromotion('p-mledesma', A, { promotable: true, minimum: 7 }))

  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  const conditionOf = (id: string) => book.students.find((s) => s.personId === id)?.course.condition
  assert.equal(conditionOf('p-taguirre'), 'promociona')
  assert.equal(conditionOf('p-lbenitez'), 'regular')
  assert.deepEqual(book.course.promotion, { promotable: true, minimum: 7 })

  value(await coursework.publishCourseGrade('p-mledesma', A))
  const tomas = syntheticData.people.find((p) => p.id === 'p-taguirre')?.siuId ?? ''
  const history = value(await siu.history(tomas))
  const course = history.find((h) => h.type === 'cursada' && h.gradeRecord === `HK-${A}`)
  assert.equal(course?.result, 'promocionado')
})

test('sin promoción, la misma nota es regular; y el mínimo de promoción va de 4 a 10', async () => {
  const { coursework } = build()
  value(await coursework.setWeights('p-mledesma', A, [{ columnId: SEGUNDO_PARCIAL, weight: 100 }]))
  value(await coursework.grade('p-mledesma', gradeOf({ value: 9 })))
  value(await coursework.setPromotion('p-mledesma', A, { promotable: false, minimum: 7 }))
  const book = value(await coursework.gradebook('p-mledesma', 'am1'))
  assert.equal(book.students.find((s) => s.personId === 'p-taguirre')?.course.condition, 'regular')
  assert.deepEqual(await coursework.setPromotion('p-mledesma', A, { promotable: true, minimum: 3 }), {
    ok: false,
    error: 'nota-invalida'
  })
})
