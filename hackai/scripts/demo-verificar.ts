/* Dice si la base de la demo y la configuración están listas, sin escribir
   nada. Qué revisa: lib/demo-base/verify.ts. Guía: README, «Base de la demo».

     npm run demo:verificar

   Toma las variables de .env.local. Sale con 1 si algo falla. Nombra
   variables, tablas y funciones, nunca valores de variables. */
import { join } from 'node:path'
import { demoBaseFacts } from '@/lib/adapters/supabase/demo-base'
import { type CheckStatus, verifyDemoBase } from '@/lib/demo-base/verify'

const MARK: Record<CheckStatus, string> = { ok: '✓', aviso: '!', falla: '✗' }

async function main() {
  const env = process.env
  const checks = await verifyDemoBase({ env, root: join(import.meta.dirname, '..'), facts: demoBaseFacts(env) })
  for (const { name, status, detail } of checks) console.log(`${MARK[status]} ${name}: ${detail}`)
  const failed = checks.filter((c) => c.status === 'falla').length
  console.log(failed ? `\nFallan ${failed} chequeos.` : '\nLa base de la demo está lista.')
  if (failed) process.exitCode = 1
}

main()
