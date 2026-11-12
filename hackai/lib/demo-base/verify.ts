/* Verificar la base de la demo, sin escribir nada: las variables, que el
   sistema arme con los adaptadores elegidos y lea, y en Supabase las tablas,
   las funciones, el bucket de Archivos y los seeds del set sintético. Lo corre
   `npm run demo:verificar` (scripts/demo-verificar.ts); cómo se usa:
   hackai/README.md, «Base de la demo».

   Las tablas y las funciones salen de los SQL de supabase/migrations/ y
   supabase/simulados/, así una migración nueva entra sola al chequeo. Todo lo
   que pide a Supabase es lectura: las tablas con un select, el bucket con su
   descripción y las funciones con un rpc por GET, que PostgREST corre en una
   transacción de solo lectura. Lo que informa nombra variables, tablas y
   funciones, nunca valores de variables. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseFromEnv } from '@/lib/adapters/supabase/client'
import { createSupabaseFiles, DEFAULT_BUCKET } from '@/lib/adapters/supabase/files'
import { peopleAccountRows } from '@/lib/adapters/supabase/people-seed'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { type AdapterChoice, compose, type Env, type System } from '@/lib/composition'
import { MIGRATIONS_DIR, SIMULATED_DIR } from '@/lib/demo-base/prepare'

export type CheckStatus = 'ok' | 'aviso' | 'falla'
export type Check = { name: string; status: CheckStatus; detail: string }

export type VerifyDeps = {
  env: Env
  /** La carpeta hackai/, de donde salen los SQL. */
  root: string
  /** El cliente de Supabase con service role. Sin él, se arma con las variables de `env`. */
  client?: SupabaseClient
  data?: SyntheticData
}

const check = (name: string, status: CheckStatus, detail: string): Check => ({ name, status, detail })

const AGAIN = 'corré npm run demo:preparar'

/** Las que la app necesita para la demo. */
const REQUIRED_VARIABLES = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET']

/** Los puertos que en la demo leen la base, con su variable. */
const BASE_PORTS: [keyof AdapterChoice, string][] = [
  ['siu', 'HACKAI_SIU'],
  ['classroom', 'HACKAI_CLASSROOM'],
  ['files', 'HACKAI_FILES'],
  ['store', 'HACKAI_STORE']
]

/** Una tabla que PostgREST no encuentra: la base no la tiene (42P01) o su
    esquema no la conoce (PGRST205). */
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
/** Una función que PostgREST no encuentra con esos argumentos. */
const MISSING_FUNCTION = new Set(['PGRST202', '42883'])

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'error desconocido')

function variableChecks(env: Env): Check[] {
  const missing = REQUIRED_VARIABLES.filter((name) => !env[name]?.trim())
  const checks = [
    missing.length
      ? check('Variables', 'falla', `faltan ${missing.join(', ')} en el entorno`)
      : check('Variables', 'ok', REQUIRED_VARIABLES.join(', '))
  ]
  if (!env.CRON_SECRET?.trim())
    checks.push(check('Variables', 'aviso', 'falta CRON_SECRET: la corrida periódica queda cerrada'))
  return checks
}

/** Una lectura por los módulos: la lista de demo de Personas y las comisiones
    de un alumno de Cursada, que pasan por la identidad, el almacén y el SIU. */
async function readCheck(system: System): Promise<Check> {
  const people = await system.people.demoPeople()
  if (!people.ok) return check('Lectura', 'falla', `Personas no trae la lista de demo (${people.error})`)
  const student = people.value.find((p) => p.role === 'alumno')
  if (!student) return check('Lectura', 'falla', 'la lista de demo no tiene alumnos')
  const sections = await system.studies.sectionsOf(student.id)
  if (!sections.ok)
    return check('Lectura', 'falla', `Cursada no trae las comisiones de ${student.id} (${sections.error})`)
  return check('Lectura', 'ok', `${people.value.length} personas de demo y las comisiones de ${student.id}`)
}

async function systemChecks(env: Env, data: SyntheticData): Promise<Check[]> {
  let system: System
  try {
    system = compose(env, data)
  } catch (error) {
    return [check('Sistema', 'falla', `no arma: ${messageOf(error)}`)]
  }
  const chosen = Object.entries(system.adapters)
    .map(([port, adapter]) => `${port}=${adapter}`)
    .join(', ')
  const checks = [check('Sistema', 'ok', `arma con ${chosen}`)]
  const unused = BASE_PORTS.filter(([port]) => system.adapters[port] === 'memoria').map(([, variable]) => variable)
  if (unused.length)
    checks.push(check('Sistema', 'aviso', `${unused.join(', ')} en memoria: para eso la app no usa la base`))
  checks.push(await readCheck(system))
  return checks
}

/** El SQL de las migraciones y de lo simulado, sin comentarios. */
function schemaSql(root: string): string {
  return [MIGRATIONS_DIR, SIMULATED_DIR]
    .flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => readFileSync(join(root, dir, name), 'utf8'))
    )
    .join('\n')
    .replace(/--.*$/gm, '')
}

const tablesIn = (sql: string) => [...sql.matchAll(/create table (?:if not exists )?(\w+)/gi)].map((m) => m[1])

type SqlFunction = { name: string; args: { name: string; type: string }[] }

function functionsIn(sql: string): SqlFunction[] {
  return [...sql.matchAll(/create (?:or replace )?function (\w+)\s*\(([^)]*)\)/gi)].map((m) => ({
    name: m[1],
    args: m[2]
      .split(',')
      .map((arg) => arg.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, type = '']) => ({ name, type: type.toLowerCase() }))
  }))
}

async function tableChecks(client: SupabaseClient, tables: string[]): Promise<{ checks: Check[]; missing: string[] }> {
  const read = await Promise.all(
    tables.map(async (table) => ({ table, error: (await client.from(table).select('*').limit(1)).error }))
  )
  const missing = read.filter((r) => r.error && MISSING_TABLE.has(r.error.code)).map((r) => r.table)
  const broken = read.filter((r) => r.error && !MISSING_TABLE.has(r.error.code))
  const checks: Check[] = []
  if (missing.length) checks.push(check('Tablas', 'falla', `faltan ${missing.join(', ')}: ${AGAIN}`))
  if (broken.length)
    checks.push(
      check(
        'Tablas',
        'falla',
        `no se pudieron leer ${broken.map((r) => `${r.table} (${r.error?.code || r.error?.message})`).join(', ')}`
      )
    )
  if (!checks.length) checks.push(check('Tablas', 'ok', tables.join(', ')))
  return { checks, missing: [...missing, ...broken.map((r) => r.table)] }
}

/** Argumentos de mentira para llamar a una función solo para ver si existe:
    PostgREST la busca por el nombre de sus argumentos. */
const probeArgs = (fn: SqlFunction) =>
  Object.fromEntries(
    fn.args.map(({ name, type }) => [name, type === 'uuid' ? '00000000-0000-0000-0000-000000000000' : '0'])
  )

async function functionChecks(client: SupabaseClient, functions: SqlFunction[]): Promise<Check[]> {
  const missing: string[] = []
  for (const fn of functions) {
    // Por GET, PostgREST la corre en una transacción de solo lectura: si la
    // función escribe, falla sin escribir, y eso alcanza para saber que existe.
    const { error } = await client.rpc(fn.name, probeArgs(fn), { get: true })
    if (error && MISSING_FUNCTION.has(error.code)) missing.push(fn.name)
  }
  if (missing.length) return [check('Funciones', 'falla', `faltan ${missing.join(', ')}: ${AGAIN}`)]
  return [check('Funciones', 'ok', functions.map((fn) => fn.name).join(', ') || 'no hay')]
}

async function bucketCheck(client: SupabaseClient): Promise<Check> {
  const { data, error } = await client.storage.getBucket(DEFAULT_BUCKET)
  if (error || !data)
    return check(
      'Bucket',
      'falla',
      `no está el bucket ${DEFAULT_BUCKET} o no se pudo leer (${error?.message}): ${AGAIN}`
    )
  if (data.public) return check('Bucket', 'falla', `el bucket ${DEFAULT_BUCKET} es público y tiene que ser privado`)
  const max = createSupabaseFiles({ client }).capabilities.maxBytes
  if (data.file_size_limit !== max)
    return check(
      'Bucket',
      'falla',
      `el bucket ${DEFAULT_BUCKET} acepta hasta ${data.file_size_limit ?? 'cualquier tamaño'} bytes y Archivos declara ${max}: ${AGAIN}`
    )
  return check('Bucket', 'ok', `${DEFAULT_BUCKET}, privado, hasta ${max} bytes por archivo`)
}

/** Filas del set sintético que tienen que estar después de los seeds. */
const seededRows = (data: SyntheticData) => [
  { table: 'siu_persons', ids: data.siu.persons.map((p) => p.id) },
  { table: 'siu_sections', ids: data.siu.sections.map((s) => s.id) },
  { table: 'siu_exam_boards', ids: data.siu.examBoards.map((b) => b.id) },
  { table: 'moodle_courses', ids: data.moodle.courses.map((c) => c.id) }
]

async function rowsCheck(client: SupabaseClient, table: string, ids: string[]): Promise<string | null> {
  const { data, error } = await client.from(table).select('id').in('id', ids)
  if (error) return `no se pudo leer ${table} (${error.code || error.message})`
  const found = new Set((data as { id: string }[]).map((row) => row.id))
  const missing = ids.filter((id) => !found.has(id))
  return missing.length
    ? `a ${table} le faltan ${missing.length} de ${ids.length} filas del set (${missing.slice(0, 5).join(', ')})`
    : null
}

/** Los vínculos de cada persona con la identidad, el SIU y Moodle. Los de
    Discord no se comparan: pueden ser los reales de quien la usa. */
async function accountsCheck(client: SupabaseClient, data: SyntheticData): Promise<string | null> {
  const expected = peopleAccountRows(data).filter((row) => row.system !== 'discord')
  const { data: rows, error } = await client
    .from('people_accounts')
    .select('person_id,system,external_id')
    .in(
      'person_id',
      data.people.map((p) => p.id)
    )
  if (error) return `no se pudo leer people_accounts (${error.code || error.message})`
  const key = (row: { person_id: string; system: string; external_id: string }) =>
    `${row.person_id} ${row.system} ${row.external_id}`
  const have = new Set((rows as (typeof expected)[number][]).map(key))
  const people = [...new Set(expected.filter((row) => !have.has(key(row))).map((row) => row.person_id))]
  return people.length ? `faltan o cambiaron los vínculos de ${people.join(', ')} en people_accounts` : null
}

async function seedChecks(client: SupabaseClient, data: SyntheticData, unreadable: string[]): Promise<Check[]> {
  const pending = seededRows(data).filter(({ table }) => !unreadable.includes(table))
  const problems = await Promise.all([
    ...pending.map(({ table, ids }) => rowsCheck(client, table, ids)),
    unreadable.includes('people_accounts') ? null : accountsCheck(client, data)
  ])
  const found = problems.filter((p): p is string => p !== null)
  if (found.length) return found.map((problem) => check('Seeds', 'falla', `${problem}: ${AGAIN}`))
  return [check('Seeds', 'ok', 'el set sintético está cargado')]
}

async function baseChecks(client: SupabaseClient, root: string, data: SyntheticData): Promise<Check[]> {
  const sql = schemaSql(root)
  const tables = await tableChecks(client, tablesIn(sql))
  return [
    ...tables.checks,
    ...(await functionChecks(client, functionsIn(sql))),
    await bucketCheck(client),
    ...(await seedChecks(client, data, tables.missing))
  ]
}

function clientFrom(env: Env): SupabaseClient | null {
  try {
    return supabaseFromEnv(env)
  } catch {
    return null
  }
}

export async function verifyDemoBase({ env, root, client, data = syntheticData }: VerifyDeps): Promise<Check[]> {
  const checks = [...variableChecks(env), ...(await systemChecks(env, data))]
  const base = client ?? clientFrom(env)
  if (!base)
    return [
      ...checks,
      check('Base', 'falla', 'sin NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no se puede revisar la base')
    ]
  return [...checks, ...(await baseChecks(base, root, data))]
}
