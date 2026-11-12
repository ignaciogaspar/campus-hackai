/* Deja la base de la demo como nueva: migraciones, tablas simuladas, vaciado
   de los ensayos, seeds y bucket de Archivos vacío. Qué hace y en qué orden:
   lib/demo-base/prepare.ts. Guía: README, «Base de la demo».

     npm run demo:preparar
     npm run demo:preparar -- --si     # sin preguntar, para automatizar

   Toma las variables de .env.local y aplica los SQL con psql. Imprime nombres
   de archivos y de variables, nunca sus valores. */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { supabaseFromEnv } from '@/lib/adapters/supabase/client'
import { DEFAULT_BUCKET } from '@/lib/adapters/supabase/files'
import { emptyBucket } from '@/lib/demo-base/bucket'
import { prepareDemoBase } from '@/lib/demo-base/prepare'
import { fail, ok, type Result } from '@/lib/result'

const root = join(import.meta.dirname, '..')
const CONFIRM_WORD = 'preparar'

async function confirm(question: string): Promise<boolean> {
  console.log(question)
  if (process.argv.includes('--si')) return true
  if (!process.stdin.isTTY) {
    console.error('No hay una terminal para confirmar: corré con «npm run demo:preparar -- --si».')
    return false
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await prompt.question(`Escribí «${CONFIRM_WORD}» para seguir: `)).trim() === CONFIRM_WORD
  } finally {
    prompt.close()
  }
}

/** Aplica un SQL con psql, que corta en el primer error. La URL va como
    argumento, igual que en `psql "$DATABASE_URL"`, y no se imprime. */
async function runSql(file: string): Promise<Result<null, string>> {
  const run = spawnSync(
    'psql',
    [
      process.env.DATABASE_URL ?? '',
      '--no-psqlrc',
      '--quiet',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      'set client_min_messages = warning',
      '--file',
      join(root, file)
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  )
  if (run.error) return fail('no encontré psql: instalá el cliente de PostgreSQL (README, «Base de la demo»)')
  return run.status === 0 ? ok(null) : fail(`psql terminó con código ${run.status}`)
}

async function main() {
  const result = await prepareDemoBase({
    env: process.env,
    root,
    confirm,
    runSql,
    emptyBucket: () => emptyBucket(supabaseFromEnv(process.env), DEFAULT_BUCKET)
  })
  if (!result.ok) {
    console.error(result.error)
    process.exitCode = 1
    return
  }
  console.log(
    `Listo: ${result.value.applied.length} SQL aplicados y ${result.value.removedFiles} archivos borrados del bucket. Ahora: npm run demo:verificar`
  )
}

main()
