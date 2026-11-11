/* Seed de los vínculos de la demo: el SQL que carga en `people_accounts` los
   ids de cada persona del set sintético en la identidad, el SIU, Moodle y
   Discord. Sale de synthetic-data.ts, la misma fuente que el almacén en
   memoria. `npm run people:seed` lo escribe en
   supabase/simulados/people_seed.sql: es de la demo, así que va con lo
   simulado y no con las migraciones propias.

   Es idempotente: borra los vínculos de las personas del set y los carga de
   nuevo, así correrlo otra vez deja a cada una como en el set sintético. Los
   vínculos de otras personas no se tocan. */
import type { PeopleAccountRow } from '@/lib/adapters/supabase/people-store'
import { text, textArray, upsert, type Sql } from '@/lib/adapters/supabase/sql'
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ExternalSystem } from '@/lib/core/people'

/** Las filas de `people_accounts` del set sintético. */
export function peopleAccountRows(data: SyntheticData): PeopleAccountRow[] {
  return data.people.flatMap((p) => {
    const accounts: [ExternalSystem, string | null][] = [
      ['identity', p.identitySubject],
      ['siu', p.siuId],
      ['moodle', p.moodleId],
      ['discord', p.discordId],
    ]
    return accounts.flatMap(([system, id]) => id ? [{ person_id: p.id, system, external_id: id }] : [])
  })
}

export function peopleSeedSql(data: SyntheticData): string {
  const parts: Sql[] = [
    '-- Generado por npm run people:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.\n',
    'begin;\n',
    `delete from people_accounts where person_id = any (${textArray(data.people.map((p) => p.id))});\n`,
    upsert('people_accounts', ['person_id', 'system'], peopleAccountRows(data).map((row) => ({
      person_id: text(row.person_id),
      system: text(row.system),
      external_id: text(row.external_id),
    }))),
    'commit;\n',
  ]
  return parts.join('\n')
}
