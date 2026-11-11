/* Escribe supabase/simulados/siu_seed.sql desde el set sintético.
   Uso: npm run siu:seed */
import { writeFileSync } from 'node:fs'
import { siuSeedSql } from '@/lib/adapters/siu-simulado/seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const target = new URL('../supabase/simulados/siu_seed.sql', import.meta.url)
writeFileSync(target, siuSeedSql(syntheticData))
console.log(`Escrito ${target.pathname}`)
