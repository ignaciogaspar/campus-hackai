// Registra los simuladores en sim_definitions (idempotente: upsert por id).
//   npx tsx scripts/seed/sims.ts
import './env'
import { COURSE_ID, serviceDb } from '../../lib/db-node'
import { SIMS } from '../../lib/sims/registry'

async function main() {
  const rows = SIMS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    url: s.url,
    course_id: COURSE_ID,
    meta: { kind: s.kind, bloque: s.bloque, scoreLabel: s.scoreLabel, ficticio: s.ficticio, minutos: s.minutos },
  }))
  const { error } = await serviceDb().from('sim_definitions').upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`sim_definitions: ${error.message}`)
  console.log(`sim_definitions: ${rows.length} simuladores (${rows.map((r) => r.id).join(', ')})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
