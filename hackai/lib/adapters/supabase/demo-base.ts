/* Lo que la verificación de la base de la demo (lib/demo-base/verify.ts)
   necesita saber de los adaptadores de Supabase y del set sintético: el
   cliente con service role, el bucket de Archivos con el tope que declara su
   adaptador, y las filas que dejan los seeds. Vive con los adaptadores porque
   fuera de ellos solo composition los conoce (ARQUITECTURA.md, «Reglas de
   import»): verify.ts lo recibe armado. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseFromEnv } from '@/lib/adapters/supabase/client'
import { DEFAULT_BUCKET, MAX_BYTES } from '@/lib/adapters/supabase/files'
import { isPreservedAccount, peopleAccountRows } from '@/lib/adapters/supabase/people-seed'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'

function clientFrom(env: Record<string, string | undefined>): SupabaseClient | null {
  try {
    return supabaseFromEnv(env)
  } catch {
    return null
  }
}

/** La base de la demo como la tienen que dejar las migraciones y los seeds. */
export function demoBaseFacts(env: Record<string, string | undefined>, data: SyntheticData = syntheticData) {
  return {
    client: clientFrom(env),
    bucket: { name: DEFAULT_BUCKET, maxBytes: MAX_BYTES },
    seeded: [
      { table: 'siu_persons', ids: data.siu.persons.map((p) => p.id) },
      { table: 'siu_sections', ids: data.siu.sections.map((s) => s.id) },
      { table: 'siu_exam_boards', ids: data.siu.examBoards.map((b) => b.id) },
      { table: 'moodle_courses', ids: data.moodle.courses.map((c) => c.id) }
    ],
    people: data.people.map((p) => p.id),
    // Los vínculos que el seed conserva no se comparan: pueden ser los reales de quien usa la demo.
    accounts: peopleAccountRows(data).filter((row) => !isPreservedAccount(row))
  }
}
