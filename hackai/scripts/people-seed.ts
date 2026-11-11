/* Escribe supabase/simulados/people_seed.sql desde el set sintético.
   Uso: npm run people:seed */
import { writeFileSync } from 'node:fs'
import { peopleSeedSql } from '@/lib/adapters/supabase/people-seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const target = new URL('../supabase/simulados/people_seed.sql', import.meta.url)
writeFileSync(target, peopleSeedSql(syntheticData))
console.log(`Escrito ${target.pathname}`)
