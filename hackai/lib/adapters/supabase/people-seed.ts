/* Seed de los vínculos de la demo: el SQL que carga en `people_accounts` los
   ids de cada persona del set sintético en la identidad, el SIU, Moodle y
   Discord. Sale de synthetic-data.ts, la misma fuente que el almacén en
   memoria. `npm run people:seed` lo escribe en
   supabase/simulados/people_seed.sql: es de la demo, así que va con lo
   simulado y no con las migraciones propias.

   Es idempotente: borra los vínculos de las personas del set con la
   identidad, el SIU y Moodle y los carga de nuevo, así correrlo otra vez deja
   a cada una como en el set sintético. Los de Discord no se pisan: si una
   persona ya está vinculada con una cuenta de Discord, por ejemplo la real de
   quien la usa en la demo, la conserva, y el id del set entra solo si no tiene
   ninguna. Los vínculos de otras personas no se tocan. */
import type { PeopleAccountRow } from '@/lib/adapters/supabase/people-store'
import { insertMissing, type Sql, text, textArray, upsert } from '@/lib/adapters/supabase/sql'
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ExternalSystem } from '@/lib/core/people'

/** Un vínculo que el seed no pisa: el de Discord puede ser el real de quien
    usa la demo. Lo usan el seed y la verificación de la base. */
const PRESERVED_SYSTEMS: ExternalSystem[] = ['discord']
export const isPreservedAccount = (row: PeopleAccountRow) => PRESERVED_SYSTEMS.includes(row.system)

/** Las filas de `people_accounts` del set sintético. */
export function peopleAccountRows(data: SyntheticData): PeopleAccountRow[] {
  return data.people.flatMap((p) => {
    const accounts: [ExternalSystem, string | null][] = [
      ['identity', p.identitySubject],
      ['siu', p.siuId],
      ['moodle', p.moodleId],
      ['discord', p.discordId]
    ]
    return accounts.flatMap(([system, id]) => (id ? [{ person_id: p.id, system, external_id: id }] : []))
  })
}

export function peopleSeedSql(data: SyntheticData): string {
  const toSql = (row: PeopleAccountRow) => ({
    person_id: text(row.person_id),
    system: text(row.system),
    external_id: text(row.external_id)
  })
  const rows = peopleAccountRows(data)
  const parts: Sql[] = [
    '-- Generado por npm run people:seed desde lib/adapters/synthetic-data.ts. No lo edites a mano.\n',
    'begin;\n',
    `delete from people_accounts where person_id = any (${textArray(data.people.map((p) => p.id))}) and system <> all (${textArray(PRESERVED_SYSTEMS)});\n`,
    upsert('people_accounts', ['person_id', 'system'], rows.filter((row) => !isPreservedAccount(row)).map(toSql)),
    insertMissing('people_accounts', rows.filter(isPreservedAccount).map(toSql)),
    'commit;\n'
  ]
  return parts.join('\n')
}
