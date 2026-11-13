/* Batería de contrato del almacén de Seguimiento (el seam `CourseworkStore`).
   La misma corre contra el almacén en memoria, contra el de Supabase con un
   PostgREST de mentira (sin red), y contra una base de prueba de verdad solo
   si están HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY,
   con supabase/migrations/0006_coursework.sql aplicada.

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
import type { CourseworkStore, StoredSubmission, StoredTask } from '@/lib/core/coursework'
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
  })
}
