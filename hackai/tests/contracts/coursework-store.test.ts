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
import type { CourseworkStore, StoredTask } from '@/lib/core/coursework'
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
