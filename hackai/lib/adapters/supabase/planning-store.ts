/* Almacén de Planning sobre Supabase: las clases que carga secretaría, en la
   tabla propia `planning_entries` (supabase/migrations/0013_planning.sql).
   Se porta como el almacén en memoria y pasa la misma batería de contrato
   (tests/contracts/planning-store.test.ts).

   Cada consulta tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. Reemplazar inserta la carga nueva
   con su propio `batch` y recién después borra las otras: si la inserción
   falla, queda el planning anterior entero. */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type { PlanningEntry, PlanningEntryInput, Weekday } from '@/lib/core/planning'
import type { PlanningStore } from '@/lib/core/planning/store'
import { fail, ok } from '@/lib/result'

export type SupabasePlanningStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

type EntryRow = {
  id: string
  subject: string
  section: string | null
  school: string
  campus: string
  building: string
  wing: string
  room: string
  weekday: Weekday | null
  class_date: string | null
  start_minute: number
  end_minute: number
  cancelled: boolean
}

const COLUMNS =
  'id, subject, section, school, campus, building, wing, room, weekday, class_date, start_minute, end_minute, cancelled'

const toEntry = (row: EntryRow): PlanningEntry => ({
  id: row.id,
  subject: row.subject,
  section: row.section,
  school: row.school,
  campus: row.campus,
  building: row.building,
  wing: row.wing,
  room: row.room,
  weekday: row.weekday,
  date: row.class_date,
  start: row.start_minute,
  end: row.end_minute,
  cancelled: row.cancelled
})

const toRow = (entry: PlanningEntryInput, batch: string) => ({
  batch,
  subject: entry.subject,
  section: entry.section,
  school: entry.school,
  campus: entry.campus,
  building: entry.building,
  wing: entry.wing,
  room: entry.room,
  weekday: entry.weekday,
  class_date: entry.date,
  start_minute: entry.start,
  end_minute: entry.end,
  cancelled: entry.cancelled
})

/** Postgres no deja mandar miles de filas en un solo pedido cómodo: se insertan de a tantas. */
const CHUNK = 500

export function createSupabasePlanningStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabasePlanningStoreOptions): PlanningStore {
  const run = createQueryRunner({ name: 'planning-store', timeoutMs, log })

  async function insert(entries: PlanningEntryInput[], batch: string): Promise<boolean> {
    for (let i = 0; i < entries.length; i += CHUNK) {
      const rows = entries.slice(i, i + CHUNK).map((e) => toRow(e, batch))
      const inserted = await run('guardar clases', (s) => client.from('planning_entries').insert(rows).abortSignal(s))
      if (!inserted.ok) return false
    }
    return true
  }

  return {
    async entries() {
      const found = await run<EntryRow[]>('clases', (s) =>
        client.from('planning_entries').select(COLUMNS).limit(10_000).abortSignal(s)
      )
      return found.ok ? ok((found.value ?? []).map(toEntry)) : fail('falla-externa')
    },

    async replace(entries) {
      const batch = randomUUID()
      if (!(await insert(entries, batch))) {
        // Lo que se llegó a insertar de esta carga no queda a medias.
        await run('deshacer carga', (s) => client.from('planning_entries').delete().eq('batch', batch).abortSignal(s))
        return fail('falla-externa')
      }
      const removed = await run('borrar cargas anteriores', (s) =>
        client.from('planning_entries').delete().neq('batch', batch).abortSignal(s)
      )
      return removed.ok ? ok(entries.length) : fail('falla-externa')
    },

    async add(entries) {
      return (await insert(entries, randomUUID())) ? ok(entries.length) : fail('falla-externa')
    },

    async remove(id) {
      const removed = await run<{ id: string }[]>('borrar clase', (s) =>
        client.from('planning_entries').delete().eq('id', id).select('id').abortSignal(s)
      )
      return removed.ok ? ok((removed.value ?? []).length > 0) : fail('falla-externa')
    }
  }
}
