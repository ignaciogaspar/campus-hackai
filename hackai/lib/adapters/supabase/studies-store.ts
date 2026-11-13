/* Almacén de Cursada sobre Supabase: las clases con la lista tomada, en la
   tabla propia `section_classes` (supabase/migrations/0011_studies_classes.sql).
   Se porta como el almacén en memoria y pasa la misma batería de contrato
   (tests/contracts/studies-store.test.ts).

   Cada consulta tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. Guardar es todo o nada: la lista
   de ausentes es una sola columna, así que insertar o reemplazar es una
   escritura sobre una fila. Las fechas vuelven en ISO con milisegundos y `Z`,
   la forma en que las escribe el reloj. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type { Pase, StoredClass, StudiesStore } from '@/lib/core/studies/store'
import { fail, ok, type Result } from '@/lib/result'

export type SupabaseStudiesStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

type ClassRow = {
  section_id: string
  class_at: string
  taken_at: string
  taken_by: string
  absent: string[]
  pase: Pase
  pase_at: string | null
  subject_id: string
  subject_code: string
  subject_name: string
  section_name: string
}

const CLASS_COLUMNS =
  'section_id, class_at, taken_at, taken_by, absent, pase, pase_at, subject_id, subject_code, subject_name, section_name'

const iso = (value: string) => new Date(value).toISOString()

function toClass(row: ClassRow): StoredClass {
  return {
    sectionId: row.section_id,
    classAt: iso(row.class_at),
    takenAt: iso(row.taken_at),
    takenBy: row.taken_by,
    absent: row.absent,
    pase: row.pase,
    paseAt: row.pase_at === null ? null : iso(row.pase_at),
    snapshot: {
      subjectId: row.subject_id,
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      sectionName: row.section_name
    }
  }
}

export function createSupabaseStudiesStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabaseStudiesStoreOptions): StudiesStore {
  const run = createQueryRunner({ name: 'studies-store', timeoutMs, log })

  async function one(sectionId: string, classAt: string): Promise<Result<StoredClass | null, 'falla-externa'>> {
    const found = await run<ClassRow>('clase', (s) =>
      client
        .from('section_classes')
        .select(CLASS_COLUMNS)
        .eq('section_id', sectionId)
        .eq('class_at', classAt)
        .abortSignal(s)
        .maybeSingle()
    )
    if (!found.ok) return fail('falla-externa')
    return ok(found.value ? toClass(found.value) : null)
  }

  return {
    classAt: one,

    async classesOf(sectionIds) {
      if (!sectionIds.length) return ok([])
      const found = await run<ClassRow[]>('clases de las comisiones', (s) =>
        client
          .from('section_classes')
          .select(CLASS_COLUMNS)
          .in('section_id', [...new Set(sectionIds)])
          .order('class_at')
          .abortSignal(s)
      )
      return found.ok ? ok((found.value ?? []).map(toClass)) : fail('falla-externa')
    },

    async classesAbsent(siuId) {
      const found = await run<ClassRow[]>('clases con el alumno ausente', (s) =>
        client
          .from('section_classes')
          .select(CLASS_COLUMNS)
          .contains('absent', JSON.stringify([siuId]))
          .order('class_at')
          .abortSignal(s)
      )
      return found.ok ? ok((found.value ?? []).map(toClass)) : fail('falla-externa')
    },

    async pending() {
      const found = await run<ClassRow[]>('listas por pasar', (s) =>
        client.from('section_classes').select(CLASS_COLUMNS).eq('pase', 'pendiente').order('class_at').abortSignal(s)
      )
      return found.ok ? ok((found.value ?? []).map(toClass)) : fail('falla-externa')
    },

    async saveClass(input) {
      const values = {
        taken_at: input.takenAt,
        taken_by: input.takenBy,
        absent: [...new Set(input.absent)],
        pase: 'pendiente' as const,
        pase_at: null,
        subject_id: input.snapshot.subjectId,
        subject_code: input.snapshot.subjectCode,
        subject_name: input.snapshot.subjectName,
        section_name: input.snapshot.sectionName
      }
      const created = await run('guardar clase', (s) =>
        client
          .from('section_classes')
          .insert({ section_id: input.sectionId, class_at: input.classAt, ...values })
          .abortSignal(s)
      )
      if (!created.ok && created.error !== 'duplicado') return fail('falla-externa')
      if (!created.ok) {
        // Ya estaba tomada: se reemplaza la lista.
        const replaced = await run('reemplazar clase', (s) =>
          client
            .from('section_classes')
            .update(values)
            .eq('section_id', input.sectionId)
            .eq('class_at', input.classAt)
            .abortSignal(s)
        )
        if (!replaced.ok) return fail('falla-externa')
      }
      const saved = await one(input.sectionId, input.classAt)
      if (!saved.ok) return saved
      return saved.value ? ok(saved.value) : fail('falla-externa')
    },

    async setPase(sectionId, classAt, pase, paseAt) {
      const updated = await run('pase de la clase', (s) =>
        client
          .from('section_classes')
          .update({ pase, pase_at: paseAt })
          .eq('section_id', sectionId)
          .eq('class_at', classAt)
          .abortSignal(s)
      )
      return updated.ok ? ok(null) : fail('falla-externa')
    }
  }
}
