/* Preparar la base de la demo: deja el Supabase del equipo como recién
   armado. Aplica en orden las migraciones propias, las tablas de los sistemas
   simulados, el vaciado de lo que dejan los ensayos y los seeds del set
   sintético, y después vacía el bucket de Archivos. Lo corre
   `npm run demo:preparar` (scripts/demo-preparar.ts); cómo se usa:
   hackai/README.md, «Base de la demo».

   Todos los SQL son idempotentes, así que correrlo dos veces deja lo mismo.
   Antes de tocar nada se fija que la base sea la de la demo: que
   HACKAI_DEMO_SUPABASE_REF nombre el proyecto al que apuntan
   NEXT_PUBLIC_SUPABASE_URL y DATABASE_URL. Si no, se niega. Los mensajes
   nombran las variables, nunca sus valores. */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Env } from '@/lib/composition'
import { fail, ok, type Result } from '@/lib/result'

export type PrepareDeps = {
  env: Env
  /** La carpeta hackai/, de donde salen los SQL. */
  root: string
  /** Le pregunta a quien la corre si sigue. */
  confirm: (question: string) => Promise<boolean>
  /** Aplica un SQL, con su ruta relativa a `root`. */
  runSql: (file: string) => Promise<Result<null, string>>
  /** Borra todos los archivos del bucket de Archivos y dice cuántos borró. */
  emptyBucket: () => Promise<Result<number, string>>
  log?: (line: string) => void
}

export type PrepareReport = {
  /** Los SQL aplicados, en orden. */
  applied: string[]
  /** Cuántos archivos se borraron del bucket. */
  removedFiles: number
}

export const MIGRATIONS_DIR = 'supabase/migrations'
export const SIMULATED_DIR = 'supabase/simulados'
/** El SQL que vacía las tablas propias que llenan los ensayos. */
const RESET_FILE = `${SIMULATED_DIR}/demo_reset.sql`

/** Los SQL de una carpeta, en orden, con su ruta relativa a `root`. */
export const sqlFilesIn = (root: string, dir: string) =>
  readdirSync(join(root, dir))
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => `${dir}/${name}`)

const nameOf = (file: string) => file.slice(file.lastIndexOf('/') + 1)

/** Los SQL de la preparación, en el orden en que se aplican. Un SQL de lo
    simulado que no es una tabla, el vaciado ni un seed no se saltea en
    silencio: es un error. */
export function demoBaseSteps(root: string): Result<string[], string> {
  const simulated = sqlFilesIn(root, SIMULATED_DIR)
  const tables = simulated.filter((file) => /^\d{4}_.+\.sql$/.test(nameOf(file)))
  const seeds = simulated.filter((file) => !tables.includes(file) && nameOf(file).endsWith('_seed.sql'))
  const unknown = simulated.filter((file) => file !== RESET_FILE && !tables.includes(file) && !seeds.includes(file))
  if (unknown.length)
    return fail(
      `No sé en qué paso aplicar ${unknown.join(', ')}: en ${SIMULATED_DIR}/ van tablas (0001_*.sql), seeds (*_seed.sql) y ${nameOf(RESET_FILE)}.`
    )
  if (!simulated.includes(RESET_FILE)) return fail(`Falta ${RESET_FILE}.`)
  return ok([...sqlFilesIn(root, MIGRATIONS_DIR), ...tables, RESET_FILE, ...seeds])
}

/** El ref del proyecto de Supabase al que apunta una URL de la API
    (`https://<ref>.supabase.co`), de la base (`db.<ref>.supabase.co`) o del
    pooler (usuario `postgres.<ref>`). Nada si no es de Supabase. */
function supabaseProjectRef(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  if (host.endsWith('.pooler.supabase.com')) {
    return /^[^.]+\.([a-z0-9]+)$/.exec(decodeURIComponent(parsed.username))?.[1] ?? null
  }
  return /^(?:db\.)?([a-z0-9]+)\.supabase\.(?:co|com)$/.exec(host)?.[1] ?? null
}

/** Las variables de `names` que faltan o están vacías en `env`. */
export const missingVariables = (env: Env, names: string[]) => names.filter((name) => !env[name]?.trim())

/** Lo que la preparación necesita del entorno. */
const REQUIRED = ['HACKAI_DEMO_SUPABASE_REF', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL']

/** El ref de la demo, si la API y la base son de ese proyecto. Los mensajes
    nombran variables: nunca muestran una URL, que en DATABASE_URL lleva la
    clave. */
function recognizeDemoBase(env: Env): Result<string, string> {
  const missing = missingVariables(env, REQUIRED)
  if (missing.length) return fail(`Faltan ${missing.join(', ')} en hackai/.env.local.`)
  const ref = env.HACKAI_DEMO_SUPABASE_REF!.trim()
  const strangers = ['NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL'].filter(
    (name) => supabaseProjectRef(env[name]!.trim()) !== ref
  )
  if (strangers.length)
    return fail(
      `No reconozco la base como la de la demo: ${strangers.join(' y ')} no ${strangers.length > 1 ? 'apuntan' : 'apunta'} al proyecto de Supabase de HACKAI_DEMO_SUPABASE_REF. No se tocó nada.`
    )
  return ok(ref)
}

export async function prepareDemoBase({
  env,
  root,
  confirm,
  runSql,
  emptyBucket,
  log = console.log
}: PrepareDeps): Promise<Result<PrepareReport, string>> {
  const ref = recognizeDemoBase(env)
  if (!ref.ok) return ref
  const steps = demoBaseSteps(root)
  if (!steps.ok) return steps

  const question = `Vas a dejar como nueva la base de la demo (proyecto ${ref.value}): se borran los espacios, los mensajes, lo leído y los archivos de los ensayos.`
  if (!(await confirm(question))) return fail('No se tocó nada.')

  const applied: string[] = []
  for (const file of steps.value) {
    log(`Aplicando ${file}`)
    const result = await runSql(file)
    if (!result.ok) return fail(`Falló ${file}: ${result.error}`)
    applied.push(file)
  }

  log('Vaciando el bucket de Archivos')
  const removed = await emptyBucket()
  if (!removed.ok) return fail(`No se pudo vaciar el bucket de Archivos: ${removed.error}`)
  return ok({ applied, removedFiles: removed.value })
}
