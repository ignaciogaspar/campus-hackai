/* El bucket de Archivos en la base de la demo. Sus objetos no se pueden
   borrar por SQL (Storage no deja borrar de sus tablas), así que se vacían
   por la API de Storage, con el service role. El adaptador de Archivos
   (lib/adapters/supabase/files.ts) guarda cada objeto en la raíz del bucket,
   con su id como nombre: listar la raíz alcanza para encontrarlos todos. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fail, ok, type Result } from '@/lib/result'

export type EmptyBucketOptions = {
  /** Cuántos objetos se listan y se borran por vuelta. */
  pageSize?: number
}

/** Borra todos los archivos del bucket y devuelve cuántos borró. Vaciar uno
    vacío no es un error. Las carpetas no se recorren: el adaptador no las crea. */
export async function emptyBucket(
  client: SupabaseClient,
  bucket: string,
  { pageSize = 100 }: EmptyBucketOptions = {}
): Promise<Result<number, string>> {
  const storage = client.storage.from(bucket)
  let removed = 0
  for (;;) {
    const listed = await storage.list('', { limit: pageSize, offset: 0 })
    if (listed.error) return fail(`no se pudo listar el bucket ${bucket} (${listed.error.message})`)
    // Las carpetas vuelven sin id.
    const names = listed.data.filter((entry) => entry.id).map((entry) => entry.name)
    if (!names.length) return ok(removed)
    const deleted = await storage.remove(names)
    if (deleted.error) return fail(`no se pudo borrar del bucket ${bucket} (${deleted.error.message})`)
    // Si no borró nada de lo que listó, la próxima vuelta listaría lo mismo.
    if (!deleted.data.length) return fail(`Storage no borró los archivos del bucket ${bucket}`)
    removed += deleted.data.length
  }
}
