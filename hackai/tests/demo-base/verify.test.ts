import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { peopleAccountRows } from '@/lib/adapters/supabase/people-seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { type Check, verifyDemoBase } from '@/lib/demo-base/verify'
import { createFakePostgrest, type FakeTable } from '../contracts/fake-postgrest'
import { createFakeStorage } from './fake-storage'

const SERVICE_KEY = 'clave-de-servicio-que-no-se-muestra'
const SESSION = 'secreto-de-sesion-que-no-se-muestra'

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://demo.test',
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  SESSION_SECRET: SESSION,
  CRON_SECRET: 'secreto-del-cron'
}

/** Una carpeta hackai/ de mentira con las tablas y la función que tiene que encontrar el chequeo. */
function fakeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hackai-verificar-'))
  const files: Record<string, string> = {
    'supabase/migrations/0001_people.sql': 'create table if not exists people_accounts (\n  person_id text\n);\n',
    'supabase/migrations/0002_spaces.sql': [
      'create table if not exists spaces (\n  id uuid\n);',
      'create or replace function space_mark_read(p_person_id text, p_channel_id uuid, p_seq bigint)\nreturns void'
    ].join('\n'),
    'supabase/simulados/0001_siu.sql': [
      'create table if not exists siu_persons (id text);',
      'create table if not exists siu_sections (id text);',
      'create table if not exists siu_exam_boards (id text);'
    ].join('\n'),
    'supabase/simulados/0002_moodle.sql': 'create table if not exists moodle_courses (id text);\n',
    'supabase/simulados/siu_seed.sql': '-- seed\n'
  }
  for (const [file, sql] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), sql)
  }
  return root
}

const idTable: FakeTable = { columns: ['id'] }

type Options = { without?: string[]; functions?: boolean; publicBucket?: boolean; missingPerson?: string }

/** Una base de la demo de mentira, armada como la deja `demo:preparar`, con lo que pidan `options` roto. */
function fakeBase({ without = [], functions = true, publicBucket = false, missingPerson }: Options = {}) {
  const tables: Record<string, FakeTable> = {
    people_accounts: { columns: ['person_id', 'system', 'external_id'] },
    spaces: idTable,
    siu_persons: idTable,
    siu_sections: idTable,
    siu_exam_boards: idTable,
    moodle_courses: idTable
  }
  for (const name of without) delete tables[name]
  const postgrest = createFakePostgrest({
    tables,
    functions: functions ? { space_mark_read: () => undefined } : {}
  })
  const fill = (table: string, rows: Record<string, unknown>[]) => postgrest.tables[table]?.push(...rows)
  fill(
    'people_accounts',
    peopleAccountRows(syntheticData).filter((row) => row.person_id !== missingPerson)
  )
  fill(
    'siu_persons',
    syntheticData.siu.persons.map((p) => ({ id: p.id }))
  )
  fill(
    'siu_sections',
    syntheticData.siu.sections.map((s) => ({ id: s.id }))
  )
  fill(
    'siu_exam_boards',
    syntheticData.siu.examBoards.map((b) => ({ id: b.id }))
  )
  fill(
    'moodle_courses',
    syntheticData.moodle.courses.map((c) => ({ id: c.id }))
  )
  const storage = createFakeStorage({
    'hackai-files': { public: publicBucket, file_size_limit: 10 * 1024 * 1024, objects: [] }
  })

  const methods: string[] = []
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    methods.push(`${init?.method ?? 'GET'} ${url.pathname}`)
    return url.pathname.startsWith('/storage/') ? storage.fetch(input, init) : postgrest.fetch(input, init)
  }
  const client = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch }
  })
  return { client, methods }
}

const failures = (checks: Check[]) => checks.filter((c) => c.status === 'falla')
const text = (checks: Check[]) => checks.map((c) => `${c.name}: ${c.detail}`).join('\n')

test('con la base como la deja la preparación y las variables cargadas, no falla nada', async () => {
  const { client } = fakeBase()

  const checks = await verifyDemoBase({ env: ENV, root: fakeRoot(), client })

  assert.deepEqual(failures(checks), [], text(checks))
  assert.match(text(checks), /people_accounts/)
})

test('nombra la tabla, la función, el bucket y el seed que faltan, y la variable sin cargar', async () => {
  const { client } = fakeBase({
    without: ['siu_sections'],
    functions: false,
    publicBucket: true,
    missingPerson: 'p-taguirre'
  })
  const { SESSION_SECRET: _, ...env } = ENV

  const checks = await verifyDemoBase({ env, root: fakeRoot(), client })
  const failed = text(failures(checks))

  assert.match(failed, /SESSION_SECRET/)
  assert.match(failed, /siu_sections/)
  assert.match(failed, /space_mark_read/)
  assert.match(failed, /hackai-files/)
  assert.match(failed, /p-taguirre/)
})

test('nunca muestra el valor de una variable', async () => {
  const { client } = fakeBase({ without: ['siu_persons'], functions: false })

  const checks = await verifyDemoBase({ env: { ...ENV, HACKAI_SIU: 'otro' }, root: fakeRoot(), client })

  assert.doesNotMatch(text(checks), new RegExp(`${SERVICE_KEY}|${SESSION}|secreto-del-cron`))
})

test('si el sistema no arma con los adaptadores elegidos lo dice con el nombre de la variable', async () => {
  const { client } = fakeBase()

  const checks = await verifyDemoBase({ env: { ...ENV, HACKAI_EXTERNAL_CHANNEL: 'discord' }, root: fakeRoot(), client })

  assert.match(text(failures(checks)), /DISCORD_BOT_TOKEN/)
})

test('si el sistema arma, dice con qué adaptadores y avisa qué puertos no usan la base', async () => {
  const { client } = fakeBase()

  const checks = await verifyDemoBase({ env: ENV, root: fakeRoot(), client })

  assert.match(text(checks), /siu=memoria/)
  assert.ok(checks.some((c) => c.status === 'aviso' && /HACKAI_STORE/.test(c.detail)))
})

test('es de solo lectura: no escribe en la base ni en Storage', async () => {
  const { client, methods } = fakeBase()

  await verifyDemoBase({ env: ENV, root: fakeRoot(), client })

  assert.ok(methods.length > 0)
  assert.deepEqual(
    methods.filter((m) => !m.startsWith('GET ')),
    []
  )
})

test('en el repo, revisa las tablas propias y las simuladas de los SQL y llama a space_mark_read por sus argumentos', async () => {
  const { client, methods } = fakeBase()

  await verifyDemoBase({ env: ENV, root: join(import.meta.dirname, '../..'), client })

  for (const table of ['people_accounts', 'space_reads', 'siu_certificates', 'moodle_assignments']) {
    assert.ok(methods.includes(`GET /rest/v1/${table}`), table)
  }
  assert.ok(methods.includes('GET /rest/v1/rpc/space_mark_read'))
})

test('sin las variables de Supabase no revisa la base y dice cuáles faltan', async () => {
  const checks = await verifyDemoBase({ env: { SESSION_SECRET: SESSION }, root: fakeRoot() })

  assert.match(text(failures(checks)), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(text(failures(checks)), /SUPABASE_SERVICE_ROLE_KEY/)
})
