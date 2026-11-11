/* Batería de contrato del almacén de Personas (el seam `PeopleStore`). La
   misma corre contra el almacén en memoria, contra el de Supabase con un
   PostgREST de mentira cargado con el seed (sin red), y contra una base de
   prueba de verdad solo si están HACKAI_TEST_SUPABASE_URL y
   HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY, con supabase/migrations/0001_people.sql
   y supabase/simulados/people_seed.sql aplicados. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { peopleAccountRows } from '@/lib/adapters/supabase/people-seed'
import { createSupabasePeopleStore, type PeopleAccountRow } from '@/lib/adapters/supabase/people-store'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import type { PeopleStore } from '@/lib/core/people'

function peopleStoreContract(name: string, make: () => PeopleStore, skip: string | false = false) {
  const it = (title: string, fn: (store: PeopleStore) => Promise<void> | void) =>
    test(`${name}: ${title}`, { skip }, () => fn(make()))

  it('devuelve las cuentas de una persona en todos sus sistemas', async (store) => {
    assert.deepEqual(await store.accountsOf('p-taguirre'), {
      ok: true,
      value: { identity: 'demo:p-taguirre', siu: '30101', moodle: '401', discord: '1290000000000000011' }
    })
  })

  it('una persona sin cuenta en un sistema no trae ese sistema', async (store) => {
    assert.deepEqual(await store.accountsOf('p-mcabrera'), {
      ok: true,
      value: { identity: 'demo:p-mcabrera', siu: '30103', moodle: '403' }
    })
  })

  it('de una persona que no existe devuelve null', async (store) => {
    assert.deepEqual(await store.accountsOf('p-nadie'), { ok: true, value: null })
  })

  it('encuentra a la dueña de un id en cada sistema', async (store) => {
    assert.deepEqual(await store.ownerOf('identity', 'demo:p-cbustos'), { ok: true, value: 'p-cbustos' })
    assert.deepEqual(await store.ownerOf('siu', '20101'), { ok: true, value: 'p-mledesma' })
    assert.deepEqual(await store.ownerOf('moodle', '402'), { ok: true, value: 'p-lbenitez' })
    assert.deepEqual(await store.ownerOf('discord', '1290000000000000012'), { ok: true, value: 'p-lbenitez' })
  })

  it('un id que nadie tiene, o que es de otro sistema, no tiene dueña', async (store) => {
    assert.deepEqual(await store.ownerOf('siu', '99999'), { ok: true, value: null })
    assert.deepEqual(await store.ownerOf('moodle', '20101'), { ok: true, value: null })
  })
}

/** PostgREST de mentira para `people_accounts`: responde las lecturas con
    filtros `eq` sobre las filas del seed. Cualquier otra cosa es un 400, así
    una consulta con otra forma hace fallar la batería. */
const COLUMNS = ['person_id', 'system', 'external_id'] as const
type Column = (typeof COLUMNS)[number]
const isColumn = (name: string): name is Column => (COLUMNS as readonly string[]).includes(name)

/** Las filas que piden los parámetros de la URL, con sus columnas, o por qué no se entienden. */
function query(rows: PeopleAccountRow[], params: URLSearchParams): Record<string, string>[] | string {
  let found = rows
  let selected: readonly Column[] = COLUMNS
  for (const [name, value] of params) {
    if (name === 'select') {
      const names = value.split(',').map((c) => c.trim())
      if (!names.every(isColumn)) return 'columna desconocida'
      selected = names
    } else if (isColumn(name) && value.startsWith('eq.')) {
      found = found.filter((row) => row[name] === value.slice(3))
    } else {
      return `filtro desconocido: ${name}`
    }
  }
  return found.map((row) => Object.fromEntries(selected.map((c) => [c, row[c]])))
}

function fakePostgrest(rows: PeopleAccountRow[]): typeof globalThis.fetch {
  const bad = (message: string) => new Response(JSON.stringify({ code: 'PGRST100', message }), { status: 400 })

  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if ((init?.method ?? 'GET') !== 'GET' || url.pathname !== '/rest/v1/people_accounts')
      return bad('solo lecturas de people_accounts')
    const body = query(rows, url.searchParams)
    if (typeof body === 'string') return bad(body)
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }
}

const supabaseStore = (url: string, key: string, fetch?: typeof globalThis.fetch) =>
  createSupabasePeopleStore({
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(fetch ? { global: { fetch } } : {})
    })
  })

peopleStoreContract('almacén en memoria', () => createMemoryPeopleStore(syntheticData))

peopleStoreContract('almacén de Supabase sin red', () =>
  supabaseStore('http://people.test', 'clave-de-prueba', fakePostgrest(peopleAccountRows(syntheticData)))
)

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
peopleStoreContract(
  'almacén de Supabase',
  () => supabaseStore(url!, key!),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)
