import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { demoBaseSteps, type PrepareDeps, prepareDemoBase } from '@/lib/demo-base/prepare'
import { fail, ok } from '@/lib/result'

const REF = 'abcdefghijklmnopqrst'
const PASSWORD = 'clave-de-la-base'

const ENV = {
  HACKAI_DEMO_SUPABASE_REF: REF,
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: 'clave-de-servicio',
  DATABASE_URL: `postgresql://postgres:${PASSWORD}@db.${REF}.supabase.co:5432/postgres`
}

/** Una carpeta hackai/ de mentira, con los SQL que nombra `files`. */
function fakeRoot(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hackai-demo-'))
  for (const file of files) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    writeFileSync(join(root, file), '-- vacío\n')
  }
  return root
}

const SQL_FILES = [
  'supabase/migrations/0002_spaces.sql',
  'supabase/migrations/0001_people.sql',
  'supabase/simulados/siu_seed.sql',
  'supabase/simulados/0002_moodle.sql',
  'supabase/simulados/people_seed.sql',
  'supabase/simulados/demo_reset.sql',
  'supabase/simulados/0001_siu.sql',
  'supabase/simulados/moodle_seed.sql'
]

/** Lo que hizo la preparación, en orden: cada SQL que aplicó y el vaciado del bucket. */
function recorder(overrides: Partial<PrepareDeps> = {}) {
  const done: string[] = []
  const questions: string[] = []
  const deps: PrepareDeps = {
    env: ENV,
    root: fakeRoot(SQL_FILES),
    confirm: async (question) => {
      questions.push(question)
      return true
    },
    runSql: async (file) => {
      done.push(file)
      return ok(null)
    },
    emptyBucket: async () => {
      done.push('vaciar el bucket')
      return ok(3)
    },
    log: () => {},
    ...overrides
  }
  return { deps, done, questions }
}

test('con la base reconocida y confirmada aplica migraciones, tablas simuladas, el vaciado y los seeds, y después vacía el bucket', async () => {
  const { deps, done, questions } = recorder()

  const result = await prepareDemoBase(deps)

  assert.deepEqual(done, [
    'supabase/migrations/0001_people.sql',
    'supabase/migrations/0002_spaces.sql',
    'supabase/simulados/0001_siu.sql',
    'supabase/simulados/0002_moodle.sql',
    'supabase/simulados/demo_reset.sql',
    'supabase/simulados/moodle_seed.sql',
    'supabase/simulados/people_seed.sql',
    'supabase/simulados/siu_seed.sql',
    'vaciar el bucket'
  ])
  assert.equal(questions.length, 1)
  assert.match(questions[0], new RegExp(REF))
  assert.deepEqual(result, { ok: true, value: { applied: done.slice(0, -1), removedFiles: 3 } })
})

test('sin las variables que necesita se niega antes de preguntar y nombra las que faltan', async () => {
  const { deps, done, questions } = recorder({
    env: { NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL }
  })

  const result = await prepareDemoBase(deps)

  assert.equal(result.ok, false)
  assert.match(!result.ok ? result.error : '', /HACKAI_DEMO_SUPABASE_REF, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL/)
  assert.deepEqual(questions, [])
  assert.deepEqual(done, [])
})

test('se niega si la base de datos o la API no son del proyecto de la demo, sin mostrar la URL ni la clave', async () => {
  const otra = 'zyxwvutsrqponmlkjihg'
  const casos = [
    { DATABASE_URL: `postgresql://postgres:${PASSWORD}@db.${otra}.supabase.co:5432/postgres` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${otra}.supabase.co` },
    { DATABASE_URL: `postgresql://postgres:${PASSWORD}@127.0.0.1:54322/postgres` },
    { HACKAI_DEMO_SUPABASE_REF: otra }
  ]
  for (const caso of casos) {
    const { deps, done, questions } = recorder({ env: { ...ENV, ...caso } })

    const result = await prepareDemoBase(deps)

    assert.equal(result.ok, false)
    const message = !result.ok ? result.error : ''
    assert.match(message, /HACKAI_DEMO_SUPABASE_REF/)
    assert.doesNotMatch(message, new RegExp(`${PASSWORD}|clave-de-servicio|postgresql:`))
    assert.deepEqual(questions, [])
    assert.deepEqual(done, [])
  }
})

test('reconoce la base de la demo también por la URL del pooler de Supabase', async () => {
  const { deps } = recorder({
    env: {
      ...ENV,
      DATABASE_URL: `postgresql://postgres.${REF}:${PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
    }
  })

  assert.equal((await prepareDemoBase(deps)).ok, true)
})

test('si quien la corre no confirma, no toca nada', async () => {
  const { deps, done } = recorder({ confirm: async () => false })

  const result = await prepareDemoBase(deps)

  assert.deepEqual(result, { ok: false, error: 'No se tocó nada.' })
  assert.deepEqual(done, [])
})

test('si un SQL falla, frena ahí, no vacía el bucket y dice cuál', async () => {
  const done: string[] = []
  const { deps } = recorder({
    runSql: async (file) => {
      done.push(file)
      return file.endsWith('0001_siu.sql') ? fail('psql salió con código 3') : ok(null)
    },
    emptyBucket: async () => {
      done.push('vaciar el bucket')
      return ok(0)
    }
  })

  const result = await prepareDemoBase(deps)

  assert.deepEqual(result, { ok: false, error: 'Falló supabase/simulados/0001_siu.sql: psql salió con código 3' })
  assert.equal(done.at(-1), 'supabase/simulados/0001_siu.sql')
  assert.equal(done.includes('vaciar el bucket'), false)
})

test('un SQL de lo simulado que no es tabla, seed ni el vaciado frena la preparación antes de preguntar', async () => {
  const { deps, done, questions } = recorder({ root: fakeRoot([...SQL_FILES, 'supabase/simulados/arreglo.sql']) })

  const result = await prepareDemoBase(deps)

  assert.equal(result.ok, false)
  assert.match(!result.ok ? result.error : '', /supabase\/simulados\/arreglo\.sql/)
  assert.deepEqual(questions, [])
  assert.deepEqual(done, [])
})

test('el vaciado borra todas las tablas de Espacios y deja los vínculos de Personas', () => {
  const root = join(import.meta.dirname, '../..')
  const spaces = readFileSync(join(root, 'supabase/migrations/0002_spaces.sql'), 'utf8')
  const reset = readFileSync(join(root, 'supabase/simulados/demo_reset.sql'), 'utf8')
  const truncate = /^truncate table ([^;]+);/m.exec(reset)?.[1] ?? ''
  const emptied = truncate.replace(/ restart identity.*$/, '').split(/,\s*/)

  const created = [...spaces.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1])
  assert.deepEqual([...emptied].sort(), [...created].sort())
  assert.doesNotMatch(reset.replace(/--.*$/gm, ''), /people_accounts/)
})

test('en el repo, cada SQL de las migraciones y de lo simulado tiene su paso, y lo simulado va después de lo propio', () => {
  const steps = demoBaseSteps(join(import.meta.dirname, '../..'))

  assert.ok(steps.ok, !steps.ok ? steps.error : '')
  const firstSimulated = steps.value.findIndex((file) => file.startsWith('supabase/simulados/'))
  assert.ok(steps.value.slice(0, firstSimulated).every((file) => file.startsWith('supabase/migrations/')))
  assert.ok(steps.value.slice(firstSimulated).every((file) => file.startsWith('supabase/simulados/')))
  assert.ok(steps.value.includes('supabase/migrations/0001_people.sql'))
  assert.ok(
    steps.value.indexOf('supabase/simulados/demo_reset.sql') < steps.value.indexOf('supabase/simulados/people_seed.sql')
  )
})
