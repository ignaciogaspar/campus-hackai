/* Almacén de Personas sobre Supabase: los vínculos de cada persona con cada
   sistema, en la tabla propia `people_accounts`
   (supabase/migrations/0001_people.sql). Se porta como el almacén en memoria y
   pasa la misma batería de contrato (tests/contracts/people-store.test.ts).

   Cada consulta tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type { ExternalSystem, PeopleStore, PersonAccounts } from '@/lib/core/people'
import { fail, ok } from '@/lib/result'

export type SupabasePeopleStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

/** Una fila de `people_accounts`: el id de una persona en un sistema. */
export type PeopleAccountRow = { person_id: string; system: ExternalSystem; external_id: string }

const TABLE = 'people_accounts'

export function createSupabasePeopleStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabasePeopleStoreOptions): PeopleStore {
  const run = createQueryRunner({ name: 'people-store', timeoutMs, log })

  return {
    async accountsOf(personId) {
      const rows = await run<Pick<PeopleAccountRow, 'system' | 'external_id'>[]>('cuentas', (s) =>
        client.from(TABLE).select('system, external_id').eq('person_id', personId).abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      if (!rows.value?.length) return ok(null)
      const accounts: PersonAccounts = {}
      for (const row of rows.value) accounts[row.system] = row.external_id
      return ok(accounts)
    },

    async ownerOf(system, externalId) {
      const row = await run<Pick<PeopleAccountRow, 'person_id'>>('dueña', (s) =>
        client
          .from(TABLE)
          .select('person_id')
          .eq('system', system)
          .eq('external_id', externalId)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value?.person_id ?? null)
    },

    async setAccount(personId, system, externalId) {
      // La clave es (persona, sistema): reemplaza la cuenta que tenía. Si el id es de otra persona, choca con
      // la clave única (sistema, id externo).
      const saved = await run<null>('vincular cuenta', (s) =>
        client
          .from(TABLE)
          .upsert({ person_id: personId, system, external_id: externalId }, { onConflict: 'person_id,system' })
          .abortSignal(s)
      )
      if (saved.ok) return ok(null)
      return fail(saved.error === 'duplicado' ? 'duplicado' : 'falla-externa')
    }
  }
}
