/* Escribe supabase/simulados/moodle_seed.sql desde el set sintético.
   Uso: npm run moodle:seed */
import { writeFileSync } from 'node:fs'
import { moodleSeedSql } from '@/lib/adapters/moodle-simulado/seed'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const target = new URL('../supabase/simulados/moodle_seed.sql', import.meta.url)
writeFileSync(target, moodleSeedSql(syntheticData))
console.log(`Escrito ${target.pathname}`)
