/* Batería de contrato del almacén de Seguimiento (el seam `CourseworkStore`).
   La misma corre contra el almacén en memoria, contra el de Supabase con un
   PostgREST de mentira (sin red), y contra una base de prueba de verdad solo
   si están HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY,
   con las migraciones de supabase/migrations/ de Seguimiento (0006 a 0009) aplicadas.

   Contra la base de verdad cada prueba usa materias y personas con un id
   propio de la corrida, para no chocar con datos de corridas anteriores, y al
   final borra las tareas que creó. Los ids que asigna la base no se comparan
   por valor: solo su forma. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createSupabaseCourseworkStore } from '@/lib/adapters/supabase/coursework-store'
import type { CourseworkStore, StoredGrade, StoredSubmission, StoredTask } from '@/lib/core/coursework'
import type { Result } from '@/lib/result'
import { createFakePostgrest } from '@/tests/contracts/fake-postgrest'

/** El valor de un Result que tiene que haber salido bien. */
function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const CREATED_AT = '2026-11-10T15:00:00.000Z'
const RUN = randomUUID().slice(0, 8)

/** Ids de materia y de persona propios de cada prueba. */
function fresh() {
  const tag = `prueba-${RUN}-${randomUUID().slice(0, 8)}`
  return {
    subject: (n: number) => `${tag}-materia-${n}`,
    person: (n: number) => `${tag}-persona-${n}`
  }
}

type Ids = ReturnType<typeof fresh>

const taskOf = (ids: Ids, fields: Partial<Omit<StoredTask, 'id'>> = {}): Omit<StoredTask, 'id'> => ({
  subjectId: ids.subject(1),
  sectionIds: ['sec-a'],
  name: 'Práctica 3',
  instructions: 'Resolvé los ejercicios 1 a 10.',
  file: null,
  dueAt: '2026-11-13T02:59:00.000Z',
  graded: true,
  createdBy: ids.person(1),
  createdAt: CREATED_AT,
  ...fields
})

const submissionOf = (
  ids: Ids,
  taskId: string,
  fields: Partial<Omit<StoredSubmission, 'id'>> = {}
): Omit<StoredSubmission, 'id'> => ({
  taskId,
  personId: ids.person(2),
  submittedAt: '2026-11-12T13:00:00.000Z',
  files: [{ id: randomUUID(), name: 'tp.pdf', contentType: 'application/pdf', size: 10 }],
  gradedAt: null,
  ...fields
})

const LATER = '2026-11-12T18:00:00.000Z'

const gradeOf = (
  ids: Ids,
  sectionId: string,
  fields: Partial<Omit<StoredGrade, 'id'>> = {}
): Omit<StoredGrade, 'id'> => ({
  sectionId,
  kind: 'evaluacion',
  refId: 'ev-1',
  personId: ids.person(2),
  columnName: 'Primer parcial',
  value: 8,
  absent: false,
  comment: '',
  gradedAt: CREATED_AT,
  publishedAt: null,
  pass: null,
  edited: false,
  ...fields
})

const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => rest

function courseworkStoreContract(name: string, make: () => CourseworkStore, skip: string | false = false) {
  const it = (title: string, fn: (store: CourseworkStore, ids: Ids) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, () => fn(make(), fresh()))

  it('crea una tarea y la encuentra por id', async (store, ids) => {
    const created = value(await store.createTask(taskOf(ids, { sectionIds: ['sec-a', 'sec-b'], graded: false })))

    assert.match(created.id, /\S/)
    assert.deepEqual(withoutId(created), taskOf(ids, { sectionIds: ['sec-a', 'sec-b'], graded: false }))
    assert.deepEqual(value(await store.task(created.id)), created)
  })

  it('una tarea que no existe, o con un id que no tiene forma de id, es nula', async (store) => {
    assert.equal(value(await store.task('00000000-0000-4000-8000-000000000000')), null)
    assert.equal(value(await store.task('no-es-un-uuid')), null)
    assert.equal(value(await store.taskByFile('no-es-un-uuid')), null)
    assert.equal(
      value(await store.updateTask('no-es-un-uuid', { name: 'x', instructions: '', dueAt: CREATED_AT })),
      null
    )
  })

  it('edita el nombre, la consigna y la fecha límite, y nada más', async (store, ids) => {
    const created = value(await store.createTask(taskOf(ids, { sectionIds: ['sec-a', 'sec-b'] })))

    const updated = value(
      await store.updateTask(created.id, {
        name: 'Práctica 3 (corregida)',
        instructions: 'Hacé solo los pares.',
        dueAt: '2026-11-20T13:00:00.000Z'
      })
    )

    assert.deepEqual(updated, {
      ...created,
      name: 'Práctica 3 (corregida)',
      instructions: 'Hacé solo los pares.',
      dueAt: '2026-11-20T13:00:00.000Z'
    })
    assert.deepEqual(value(await store.task(created.id)), updated)
  })

  it('las tareas de una materia salen por fecha límite y, a igual fecha, por orden de alta', async (store, ids) => {
    const late = value(await store.createTask(taskOf(ids, { name: 'Tarde', dueAt: '2026-11-20T13:00:00.000Z' })))
    const first = value(await store.createTask(taskOf(ids, { name: 'Primera', dueAt: '2026-11-12T13:00:00.000Z' })))
    const second = value(await store.createTask(taskOf(ids, { name: 'Segunda', dueAt: '2026-11-12T13:00:00.000Z' })))
    value(await store.createTask(taskOf(ids, { subjectId: ids.subject(2), name: 'De otra materia' })))

    const found = value(await store.tasksOfSubject(ids.subject(1)))

    assert.deepEqual(
      found.map((t) => t.id),
      [first.id, second.id, late.id]
    )
    assert.deepEqual(value(await store.tasksOfSubject(ids.subject(3))), [])
  })

  it('guarda el archivo de la consigna y encuentra la tarea por él', async (store, ids) => {
    const file = { id: randomUUID(), name: 'guia.pdf', contentType: 'application/pdf', size: 120_000 }
    const created = value(await store.createTask(taskOf(ids, { file })))
    value(await store.createTask(taskOf(ids, { name: 'Sin archivo' })))

    assert.deepEqual(created.file, file)
    assert.deepEqual(value(await store.taskByFile(file.id)), created)
    assert.equal(value(await store.taskByFile(randomUUID())), null)
  })

  it('guarda la entrega de una persona a una tarea y la encuentra', async (store, ids) => {
    const task = value(await store.createTask(taskOf(ids)))
    const files = [
      { id: randomUUID(), name: 'tp3.pdf', contentType: 'application/pdf', size: 1200 },
      { id: randomUUID(), name: 'anexo.txt', contentType: 'text/plain', size: 30 }
    ]

    const saved = value(await store.saveSubmission(submissionOf(ids, task.id, { files })))

    assert.match(saved.id, /\S/)
    assert.deepEqual(withoutId(saved), submissionOf(ids, task.id, { files }))
    assert.deepEqual(value(await store.submission(task.id, ids.person(2))), saved)
    assert.equal(value(await store.submission(task.id, ids.person(3))), null)
    assert.equal(value(await store.submission('no-es-un-uuid', ids.person(2))), null)
  })

  it('guardar de nuevo la entrega de la misma persona la reemplaza: queda una sola', async (store, ids) => {
    const task = value(await store.createTask(taskOf(ids)))
    const first = value(await store.saveSubmission(submissionOf(ids, task.id)))
    const files = [{ id: randomUUID(), name: 'v2.pdf', contentType: 'application/pdf', size: 99 }]

    const second = value(
      await store.saveSubmission(
        submissionOf(ids, task.id, {
          files,
          submittedAt: '2026-11-11T10:00:00.000Z',
          gradedAt: '2026-11-12T10:00:00.000Z'
        })
      )
    )

    assert.equal(second.id, first.id)
    assert.deepEqual(second.files, files)
    assert.equal(second.submittedAt, '2026-11-11T10:00:00.000Z')
    assert.equal(second.gradedAt, '2026-11-12T10:00:00.000Z')
    assert.deepEqual(value(await store.submissionsBy(ids.person(2), [task.id])), [second])
  })

  it('una entrega calificada no se reemplaza: devuelve ya-calificada y queda como estaba', async (store, ids) => {
    const task = value(await store.createTask(taskOf(ids)))
    value(await store.saveSubmission(submissionOf(ids, task.id)))
    const graded = value(await store.gradeSubmission(task.id, ids.person(2), '2026-11-12T10:00:00.000Z'))

    const files = [{ id: randomUUID(), name: 'v2.pdf', contentType: 'application/pdf', size: 99 }]
    assert.deepEqual(await store.saveSubmission(submissionOf(ids, task.id, { files })), {
      ok: false,
      error: 'ya-calificada'
    })
    assert.deepEqual(value(await store.submissionsBy(ids.person(2), [task.id])), [graded])
  })

  it('guarda instancias de examen propias y una sola corrección por evaluación del SIU, y borra las propias', async (store, ids) => {
    const section = ids.subject(7)
    const own = value(
      await store.saveExam({
        sectionId: section,
        siuAssessmentId: null,
        kind: 'integrador',
        name: 'Integrador',
        date: '2026-12-01T13:00:00.000Z'
      })
    )
    const fix = { sectionId: section, siuAssessmentId: 'ev-5', kind: 'parcial' as const, name: 'Segundo parcial' }
    value(await store.saveExam({ ...fix, date: '2026-11-20T13:00:00.000Z' }))
    const moved = value(await store.saveExam({ ...fix, date: '2026-11-27T13:00:00.000Z' }))
    const renamed = value(await store.saveExam({ ...own, name: 'Integrador final' }))

    assert.equal(renamed.id, own.id)
    const saved = value(await store.examsOfSection(section))
    assert.deepEqual(
      saved.map((e) => [e.siuAssessmentId, e.name, e.date]).sort(),
      [
        ['ev-5', 'Segundo parcial', moved.date],
        [null, 'Integrador final', '2026-12-01T13:00:00.000Z']
      ].sort()
    )
    value(await store.deleteExam(own.id))
    assert.deepEqual(
      value(await store.examsOfSection(section)).map((e) => e.siuAssessmentId),
      ['ev-5']
    )
    assert.deepEqual(value(await store.examsOfSection(ids.subject(8))), [])
  })

  it('la promoción de una comisión arranca sin configurar y se reemplaza al guardarla', async (store, ids) => {
    const section = ids.subject(9)
    assert.equal(value(await store.promotionOf(section)), null)
    value(await store.savePromotion(section, { promotable: true, minimum: 7 }))
    value(await store.savePromotion(section, { promotable: true, minimum: 8 }))
    assert.deepEqual(value(await store.promotionOf(section)), { promotable: true, minimum: 8 })
  })

  it('las entregas de una persona salen solo para las tareas pedidas, y no se mezclan con las de otra', async (store, ids) => {
    const one = value(await store.createTask(taskOf(ids, { name: 'Una' })))
    const two = value(await store.createTask(taskOf(ids, { name: 'Dos' })))
    const three = value(await store.createTask(taskOf(ids, { name: 'Tres' })))
    const mineOne = value(await store.saveSubmission(submissionOf(ids, one.id)))
    const mineTwo = value(await store.saveSubmission(submissionOf(ids, two.id)))
    value(await store.saveSubmission(submissionOf(ids, one.id, { personId: ids.person(3) })))
    value(await store.saveSubmission(submissionOf(ids, three.id)))

    const found = value(await store.submissionsBy(ids.person(2), [one.id, two.id, 'no-es-un-uuid']))

    assert.deepEqual(new Set(found.map((s) => s.id)), new Set([mineOne.id, mineTwo.id]))
    assert.deepEqual(value(await store.submissionsBy(ids.person(2), [])), [])
    assert.deepEqual(value(await store.submissionsBy(ids.person(2), ['no-es-un-uuid'])), [])
  })

  it('encuentra una entrega por id y las de una tarea, sin mezclar las de otra', async (store, ids) => {
    const one = value(await store.createTask(taskOf(ids, { name: 'Una' })))
    const two = value(await store.createTask(taskOf(ids, { name: 'Dos' })))
    const a = value(await store.saveSubmission(submissionOf(ids, one.id)))
    const b = value(await store.saveSubmission(submissionOf(ids, one.id, { personId: ids.person(3) })))
    value(await store.saveSubmission(submissionOf(ids, two.id)))

    assert.deepEqual(value(await store.submissionById(a.id)), a)
    assert.equal(value(await store.submissionById(randomUUID())), null)
    assert.equal(value(await store.submissionById('no-es-un-uuid')), null)
    assert.deepEqual(new Set(value(await store.submissionsOfTask(one.id)).map((s) => s.id)), new Set([a.id, b.id]))
    assert.deepEqual(value(await store.submissionsOfTask('no-es-un-uuid')), [])
  })

  it('encuentra la entrega que tiene un archivo', async (store, ids) => {
    const task = value(await store.createTask(taskOf(ids)))
    const file = { id: randomUUID(), name: 'tp3.pdf', contentType: 'application/pdf', size: 1200 }
    const saved = value(await store.saveSubmission(submissionOf(ids, task.id, { files: [file] })))
    value(await store.saveSubmission(submissionOf(ids, task.id, { personId: ids.person(3) })))

    assert.deepEqual(value(await store.submissionByFile(file.id)), saved)
    assert.equal(value(await store.submissionByFile(randomUUID())), null)
    assert.equal(value(await store.submissionByFile('no-es-un-uuid')), null)
  })

  it('lo que se lee no se puede cambiar desde afuera', async (store, ids) => {
    const created = value(await store.createTask(taskOf(ids)))
    created.sectionIds.push('sec-hackeada')
    created.name = 'Cambiada'

    assert.deepEqual(value(await store.task(created.id)), {
      ...created,
      sectionIds: ['sec-a'],
      name: 'Práctica 3'
    })
  })

  it('guarda la nota de un alumno en una columna y, al volver a guardarla, la reemplaza entera', async (store, ids) => {
    const section = ids.subject(1)
    const first = value(await store.saveGrade(gradeOf(ids, section, { value: 7.5, comment: 'Bien' })))

    assert.match(first.id, /\S/)
    assert.deepEqual(withoutId(first), gradeOf(ids, section, { value: 7.5, comment: 'Bien' }))
    const second = value(
      await store.saveGrade(gradeOf(ids, section, { value: null, absent: true, comment: '', gradedAt: LATER }))
    )
    assert.equal(second.id, first.id)
    assert.deepEqual(value(await store.gradesOfSection(section)), [second])
    assert.equal(second.absent, true)
    assert.equal(second.value, null)
  })

  it('las notas de una comisión no incluyen las de otras', async (store, ids) => {
    const [a, b] = [ids.subject(1), ids.subject(2)]
    await store.saveGrade(gradeOf(ids, a, { refId: 'ev-1' }))
    await store.saveGrade(gradeOf(ids, a, { refId: 'ev-1', personId: ids.person(3) }))
    await store.saveGrade(gradeOf(ids, b, { refId: 'ev-1' }))

    const ofA = value(await store.gradesOfSection(a))

    assert.equal(ofA.length, 2)
    assert.ok(ofA.every((g) => g.sectionId === a))
    assert.deepEqual(value(await store.gradesOfSection(ids.subject(9))), [])
  })

  it('publicar una columna sella solo las notas de esa columna que todavía no estaban publicadas, y es idempotente', async (store, ids) => {
    const section = ids.subject(1)
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1' }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1', personId: ids.person(3), value: 9 }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-2' }))

    const published = value(
      await store.publishColumn({ sectionId: section, kind: 'evaluacion', refId: 'ev-1' }, LATER, null)
    )

    assert.equal(published.length, 2)
    assert.ok(published.every((g) => g.publishedAt === LATER && g.refId === 'ev-1'))
    const again = value(
      await store.publishColumn(
        { sectionId: section, kind: 'evaluacion', refId: 'ev-1' },
        '2026-11-12T20:00:00.000Z',
        null
      )
    )
    assert.deepEqual(again, [])
    const all = value(await store.gradesOfSection(section))
    assert.deepEqual(
      all.map((g) => [g.refId, g.publishedAt]),
      [
        ['ev-1', LATER],
        ['ev-1', LATER],
        ['ev-2', null]
      ]
    )
  })

  it('publicar no sella una columna vacía ni las notas sin nota ni ausente', async (store, ids) => {
    const section = ids.subject(1)
    const column = { sectionId: section, kind: 'tarea' as const, refId: 'tarea-1' }
    assert.deepEqual(value(await store.publishColumn(column, LATER, null)), [])
    await store.saveGrade(gradeOf(ids, section, { kind: 'tarea', refId: 'tarea-1', value: null, comment: 'Falta' }))

    assert.deepEqual(value(await store.publishColumn(column, LATER, null)), [])
  })

  it('las notas publicadas de una persona son solo las suyas y las publicadas', async (store, ids) => {
    const section = ids.subject(1)
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1' }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-2' }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1', personId: ids.person(3) }))
    await store.publishColumn({ sectionId: section, kind: 'evaluacion', refId: 'ev-1' }, LATER, null)

    const mine = value(await store.publishedGradesOf(ids.person(2)))

    assert.deepEqual(
      mine.map((g) => [g.refId, g.personId, g.publishedAt]),
      [['ev-1', ids.person(2), LATER]]
    )
    assert.deepEqual(value(await store.publishedGradesOf(ids.person(9))), [])
  })

  it('publicar con pase deja las notas pendientes de pasar, y las que no se pasan no tienen pase', async (store, ids) => {
    const section = ids.subject(1)
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1' }))
    await store.saveGrade(gradeOf(ids, section, { kind: 'tarea', refId: 'tarea-1' }))

    const passed = value(
      await store.publishColumn({ sectionId: section, kind: 'evaluacion', refId: 'ev-1' }, LATER, {
        status: 'pendiente',
        by: ids.person(1)
      })
    )
    const task = value(await store.publishColumn({ sectionId: section, kind: 'tarea', refId: 'tarea-1' }, LATER, null))

    assert.deepEqual(
      passed.map((g) => g.pass),
      [{ status: 'pendiente', by: ids.person(1) }]
    )
    assert.deepEqual(
      task.map((g) => g.pass),
      [null]
    )
  })

  it('cambia el estado de pase de las notas pedidas y deja en pie a quién las pasa', async (store, ids) => {
    const section = ids.subject(1)
    const pass = { status: 'pendiente' as const, by: ids.person(1) }
    const first = value(await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1', pass })))
    const second = value(await store.saveGrade(gradeOf(ids, section, { refId: 'ev-2', pass })))

    value(await store.setPassStatus([first.id], 'pasado'))
    value(await store.setPassStatus([], 'no-permitido'))

    const all = value(await store.gradesOfSection(section))
    assert.deepEqual(
      all.map((g) => [g.id === first.id ? 'primera' : 'segunda', g.pass]),
      [
        ['primera', { status: 'pasado', by: ids.person(1) }],
        ['segunda', pass]
      ]
    )
    assert.ok(second.id)
  })

  it('las notas que esperan pasar salen por orden de publicación', async (store, ids) => {
    const section = ids.subject(1)
    const pass = { status: 'pendiente' as const, by: ids.person(1) }
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-1' }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-2' }))
    await store.saveGrade(gradeOf(ids, section, { refId: 'ev-3' }))
    await store.publishColumn({ sectionId: section, kind: 'evaluacion', refId: 'ev-2' }, CREATED_AT, pass)
    await store.publishColumn({ sectionId: section, kind: 'evaluacion', refId: 'ev-1' }, LATER, pass)

    const pending = value(await store.pendingPasses()).filter((g) => g.sectionId === section)

    assert.deepEqual(
      pending.map((g) => g.refId),
      ['ev-2', 'ev-1']
    )
    value(await store.setPassStatus([pending[0].id], 'pasado'))
    assert.deepEqual(
      value(await store.pendingPasses())
        .filter((g) => g.sectionId === section)
        .map((g) => g.refId),
      ['ev-1']
    )
  })

  it('calificar una entrega la cierra: ya tiene fecha de calificación y no se vuelve a pisar', async (store, ids) => {
    const task = value(await store.createTask(taskOf(ids)))
    value(await store.saveSubmission(submissionOf(ids, task.id)))

    const closed = value(await store.gradeSubmission(task.id, ids.person(2), LATER))
    const again = value(await store.gradeSubmission(task.id, ids.person(2), '2026-11-12T20:00:00.000Z'))

    assert.equal(closed?.gradedAt, LATER)
    assert.equal(again?.gradedAt, LATER)
    assert.equal(value(await store.gradeSubmission(task.id, ids.person(7), LATER)), null)
    assert.equal(value(await store.gradeSubmission('no-es-un-uuid', ids.person(2), LATER)), null)
  })

  it('guarda el peso de cada columna, lo cambia, lo quita y no mezcla comisiones', async (store, ids) => {
    const [a, b] = [ids.subject(1), ids.subject(2)]
    const parcial = { sectionId: a, kind: 'evaluacion' as const, refId: 'ev-1' }
    const tarea = { sectionId: a, kind: 'tarea' as const, refId: 'tarea-1' }
    value(await store.saveWeight(parcial, 40))
    value(await store.saveWeight(tarea, 10))
    value(await store.saveWeight({ ...parcial, sectionId: b }, 90))
    value(await store.saveWeight(parcial, 60))
    value(await store.saveWeight(tarea, null))
    value(await store.saveWeight({ ...tarea, refId: 'tarea-2' }, null))

    assert.deepEqual(value(await store.weightsOfSection(a)), [{ ...parcial, weight: 60 }])
    assert.deepEqual(value(await store.weightsOfSection(b)), [{ ...parcial, sectionId: b, weight: 90 }])
    assert.deepEqual(value(await store.weightsOfSection(ids.subject(3))), [])
  })

  it('la nota de cursada es una nota más: marca si la pisó el docente, se publica y se pasa como una evaluación', async (store, ids) => {
    const section = ids.subject(1)
    const pass = { status: 'pendiente' as const, by: ids.person(1) }
    const saved = value(
      await store.saveGrade(
        gradeOf(ids, section, {
          kind: 'cursada',
          refId: section,
          columnName: 'Nota de cursada',
          value: 7.5,
          edited: true
        })
      )
    )
    assert.equal(saved.edited, true)

    const published = value(
      await store.publishColumn({ sectionId: section, kind: 'cursada', refId: section }, LATER, pass)
    )

    assert.deepEqual(
      published.map((g) => [g.kind, g.value, g.edited, g.pass]),
      [['cursada', 7.5, true, pass]]
    )
    assert.deepEqual(
      value(await store.pendingPasses())
        .filter((g) => g.sectionId === section)
        .map((g) => g.kind),
      ['cursada']
    )
  })
}

// --- El PostgREST de mentira con la tabla de 0006_coursework.sql -----------

const TABLES = {
  coursework_tasks: {
    columns: [
      'id',
      'seq',
      'subject_id',
      'section_ids',
      'name',
      'instructions',
      'file_id',
      'file_name',
      'file_content_type',
      'file_size',
      'due_at',
      'graded',
      'created_by',
      'created_at'
    ],
    uuid: ['id', 'file_id'],
    generated: { id: 'uuid', seq: 'identity' },
    unique: [['id'], ['file_id']]
  },
  coursework_submissions: {
    columns: ['id', 'task_id', 'person_id', 'submitted_at', 'files', 'graded_at'],
    uuid: ['id', 'task_id'],
    jsonb: ['files'],
    generated: { id: 'uuid' },
    unique: [['id'], ['task_id', 'person_id']]
  },
  coursework_grades: {
    columns: [
      'id',
      'seq',
      'section_id',
      'kind',
      'ref_id',
      'person_id',
      'column_name',
      'value',
      'absent',
      'comment',
      'graded_at',
      'published_at',
      'pass_status',
      'pass_by',
      'edited'
    ],
    uuid: ['id'],
    generated: { id: 'uuid', seq: 'identity' },
    defaults: { absent: false, comment: '', edited: false },
    unique: [['id'], ['section_id', 'kind', 'ref_id', 'person_id']]
  },
  coursework_weights: {
    columns: ['section_id', 'kind', 'ref_id', 'weight'],
    unique: [['section_id', 'kind', 'ref_id']]
  },
  coursework_exams: {
    columns: ['id', 'section_id', 'assessment_id', 'kind', 'name', 'date'],
    uuid: ['id'],
    generated: { id: 'uuid' },
    unique: [['id']]
  },
  coursework_promotions: {
    columns: ['section_id', 'promotable', 'minimum'],
    unique: [['section_id']]
  }
} satisfies Parameters<typeof createFakePostgrest>[0]['tables']

const supabaseStore = (url: string, key: string, fetch?: typeof globalThis.fetch) =>
  createSupabaseCourseworkStore({ client: supabaseClient(url, key, fetch) })

function supabaseClient(url: string, key: string, fetch?: typeof globalThis.fetch): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(fetch ? { global: { fetch } } : {})
  })
}

courseworkStoreContract('almacén de Seguimiento en memoria', () => createMemoryCourseworkStore())

courseworkStoreContract('almacén de Seguimiento de Supabase sin red', () =>
  supabaseStore('http://coursework.test', 'clave-de-prueba', createFakePostgrest({ tables: TABLES }).fetch)
)

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
courseworkStoreContract(
  'almacén de Seguimiento de Supabase',
  () => supabaseStore(url!, key!),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)

if (url && key) {
  // Borra las tareas que dejó esta corrida.
  after(async () => {
    await supabaseClient(url, key).from('coursework_tasks').delete().like('subject_id', `prueba-${RUN}-%`)
    await supabaseClient(url, key).from('coursework_grades').delete().like('section_id', `prueba-${RUN}-%`)
    await supabaseClient(url, key).from('coursework_weights').delete().like('section_id', `prueba-${RUN}-%`)
  })
}
