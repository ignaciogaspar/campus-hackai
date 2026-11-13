/* Batería de contrato del almacén de Cursada (el seam `StudiesStore`). La misma
   corre contra el almacén en memoria, contra el de Supabase con un PostgREST de
   mentira (sin red), y contra una base de prueba de verdad solo si están
   HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con
   supabase/migrations/0011_studies_classes.sql aplicada. Contra la base de
   verdad cada prueba usa comisiones y alumnos con un id propio de la corrida y
   al final borra las clases que creó. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { createSupabaseStudiesStore } from '@/lib/adapters/supabase/studies-store'
import type { StoredClassInput, StudiesStore } from '@/lib/core/studies/store'
import type { Result } from '@/lib/result'
import { createFakePostgrest } from '@/tests/contracts/fake-postgrest'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const RUN = randomUUID().slice(0, 8)

function fresh() {
  const tag = `prueba-${RUN}-${randomUUID().slice(0, 8)}`
  return { section: (n: number) => `${tag}-comision-${n}`, student: (n: number) => `${tag}-alumno-${n}` }
}

type Ids = ReturnType<typeof fresh>

const MONDAY = '2026-11-09T11:00:00.000Z'
const TUESDAY = '2026-11-10T17:00:00.000Z'
const TAKEN = '2026-11-10T15:00:00.000Z'

const classOf = (ids: Ids, section: number, classAt: string, absent: number[]): StoredClassInput => ({
  sectionId: ids.section(section),
  classAt,
  takenAt: TAKEN,
  takenBy: 'p-gferreyra',
  absent: absent.map((n) => ids.student(n)),
  snapshot: { subjectId: 'am1', subjectCode: 'AM1', subjectName: 'Análisis Matemático I', sectionName: 'Comisión B' }
})

function studiesStoreContract(name: string, make: () => StudiesStore, skip: string | false = false) {
  const it = (title: string, fn: (store: StudiesStore, ids: Ids) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, () => fn(make(), fresh()))

  it('guarda una clase con sus ausentes, pendiente de pasar, y la lee de vuelta', async (store, ids) => {
    const saved = value(await store.saveClass(classOf(ids, 1, TUESDAY, [1, 2])))
    assert.deepEqual(saved, { ...classOf(ids, 1, TUESDAY, [1, 2]), pass: 'pendiente', passedAt: null })
    assert.deepEqual(value(await store.classAt(ids.section(1), TUESDAY)), saved)
    assert.equal(value(await store.classAt(ids.section(1), MONDAY)), null)
    assert.equal(value(await store.classAt(ids.section(2), TUESDAY)), null)
  })

  it('guarda el enlace de Zoom de una comisión, lo reemplaza y lo borra', async (store, ids) => {
    assert.deepEqual(value(await store.zoomLinks([ids.section(1), ids.section(2)])), {})
    value(await store.setZoomLink(ids.section(1), 'https://zoom.us/j/111'))
    value(await store.setZoomLink(ids.section(2), 'https://zoom.us/j/222'))
    assert.deepEqual(value(await store.zoomLinks([ids.section(1), ids.section(2), ids.section(3)])), {
      [ids.section(1)]: 'https://zoom.us/j/111',
      [ids.section(2)]: 'https://zoom.us/j/222'
    })
    value(await store.setZoomLink(ids.section(1), 'https://zoom.us/j/999'))
    assert.deepEqual(value(await store.zoomLinks([ids.section(1)])), { [ids.section(1)]: 'https://zoom.us/j/999' })
    value(await store.setZoomLink(ids.section(1), null))
    assert.deepEqual(value(await store.zoomLinks([ids.section(1)])), {})
    assert.deepEqual(value(await store.zoomLinks([])), {})
  })

  it('una clase sin ausentes también queda guardada', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [])))
    assert.deepEqual(value(await store.classAt(ids.section(1), TUESDAY))?.absent, [])
  })

  it('guardar de nuevo la misma comisión e instante reemplaza la lista y vuelve a quedar pendiente', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [1, 2])))
    value(await store.setPass(ids.section(1), TUESDAY, TAKEN, 'pasado', TAKEN))
    const again = value(
      await store.saveClass({ ...classOf(ids, 1, TUESDAY, [2, 3]), takenAt: '2026-11-10T16:00:00.000Z' })
    )
    assert.deepEqual(again.absent, [ids.student(2), ids.student(3)])
    assert.equal(again.takenAt, '2026-11-10T16:00:00.000Z')
    assert.equal(again.pass, 'pendiente')
    assert.equal(again.passedAt, null)
    assert.equal(value(await store.classesOf([ids.section(1)])).length, 1)
  })

  it('lee las clases de varias comisiones por instante', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [1])))
    value(await store.saveClass(classOf(ids, 1, MONDAY, [])))
    value(await store.saveClass(classOf(ids, 2, MONDAY, [1])))
    value(await store.saveClass(classOf(ids, 3, MONDAY, [1])))
    const found = value(await store.classesOf([ids.section(1), ids.section(2)]))
    assert.deepEqual(
      found.map((c) => [c.sectionId, c.classAt]),
      [
        [ids.section(1), MONDAY],
        [ids.section(2), MONDAY],
        [ids.section(1), TUESDAY]
      ].sort((a, b) => a[1].localeCompare(b[1]))
    )
    assert.deepEqual(value(await store.classesOf([])), [])
  })

  it('busca las clases en que un alumno figura ausente, de cualquier comisión', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [1, 2])))
    value(await store.saveClass(classOf(ids, 2, MONDAY, [2])))
    value(await store.saveClass(classOf(ids, 2, TUESDAY, [3])))
    const mine = value(await store.classesAbsent(ids.student(2)))
    assert.deepEqual(
      mine.map((c) => c.sectionId),
      [ids.section(2), ids.section(1)]
    )
    assert.deepEqual(value(await store.classesAbsent(ids.student(9))), [])
  })

  it('cambia el pase de una clase y lista las que siguen pendientes', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, MONDAY, [1])))
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [1])))
    value(await store.setPass(ids.section(1), MONDAY, TAKEN, 'pasado', TAKEN))
    const monday = value(await store.classAt(ids.section(1), MONDAY))
    assert.equal(monday?.pass, 'pasado')
    assert.equal(monday?.passedAt, TAKEN)
    const pending = value(await store.pending()).filter((c) => c.sectionId === ids.section(1))
    assert.deepEqual(
      pending.map((c) => c.classAt),
      [TUESDAY]
    )
    value(await store.setPass(ids.section(1), TUESDAY, TAKEN, 'no-permitido', null))
    assert.equal(value(await store.classAt(ids.section(1), TUESDAY))?.pass, 'no-permitido')
  })

  it('cambiar el pase de una clase que no existe no hace nada', async (store, ids) => {
    assert.deepEqual(await store.setPass(ids.section(1), TUESDAY, TAKEN, 'pasado', TAKEN), { ok: true, value: false })
    assert.equal(value(await store.classAt(ids.section(1), TUESDAY)), null)
  })

  it('no marca el pase de una lista que se corrigió después de mandarla', async (store, ids) => {
    value(await store.saveClass(classOf(ids, 1, TUESDAY, [1])))
    const corrected = '2026-11-10T15:30:00.000Z'
    value(await store.saveClass({ ...classOf(ids, 1, TUESDAY, [2]), takenAt: corrected }))

    assert.equal(value(await store.setPass(ids.section(1), TUESDAY, TAKEN, 'pasado', TAKEN)), false)
    assert.equal(value(await store.classAt(ids.section(1), TUESDAY))?.pass, 'pendiente')
    assert.equal(value(await store.setPass(ids.section(1), TUESDAY, corrected, 'pasado', corrected)), true)
    assert.equal(value(await store.classAt(ids.section(1), TUESDAY))?.pass, 'pasado')
  })
}

const TABLES = {
  section_classes: {
    columns: [
      'id',
      'section_id',
      'class_at',
      'taken_at',
      'taken_by',
      'absent',
      'pass_status',
      'passed_at',
      'subject_id',
      'subject_code',
      'subject_name',
      'section_name'
    ],
    uuid: ['id'],
    jsonb: ['absent'],
    generated: { id: 'uuid' },
    defaults: { absent: [], pass_status: 'pendiente' },
    unique: [['section_id', 'class_at']]
  },
  section_zoom_links: { columns: ['section_id', 'url'], unique: [['section_id']] }
} satisfies Parameters<typeof createFakePostgrest>[0]['tables']

const supabaseStore = (url: string, key: string, fetch?: typeof globalThis.fetch) =>
  createSupabaseStudiesStore({
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(fetch ? { global: { fetch } } : {})
    })
  })

studiesStoreContract('almacén en memoria', () => createMemoryStudiesStore())

studiesStoreContract('almacén de Supabase sin red', () =>
  supabaseStore('http://studies.test', 'clave-de-prueba', createFakePostgrest({ tables: TABLES }).fetch)
)

test('almacén de Supabase: una base caída devuelve «falla externa» sin tirar', async () => {
  const store = createSupabaseStudiesStore({
    client: createClient('http://studies.test', 'clave-de-prueba', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ code: 'XX000', message: 'caída' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          })
      }
    }),
    log: () => {}
  })
  const failed = { ok: false, error: 'falla-externa' }
  assert.deepEqual(await store.zoomLinks(['c']), failed)
  assert.deepEqual(await store.setZoomLink('c', 'https://zoom.us/j/1'), failed)
  assert.deepEqual(await store.classAt('c', TUESDAY), failed)
  assert.deepEqual(await store.classesOf(['c']), failed)
  assert.deepEqual(await store.classesAbsent('a'), failed)
  assert.deepEqual(await store.pending(), failed)
  assert.deepEqual(await store.saveClass(classOf(fresh(), 1, TUESDAY, [1])), failed)
  assert.deepEqual(await store.setPass('c', TUESDAY, TAKEN, 'pasado', TAKEN), failed)
})

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
studiesStoreContract(
  'almacén de Supabase',
  () => supabaseStore(url!, key!),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)

if (url && key) {
  after(async () => {
    await createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      .from('section_classes')
      .delete()
      .like('section_id', `prueba-${RUN}-%`)
  })
}
