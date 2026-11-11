/* Archivos sobre Supabase Storage, en un bucket privado
   (supabase/migrations/0003_files.sql). Nada se lee desde el navegador directo
   a Supabase: el servidor sube y baja con el service role, y la app entrega
   cada archivo por su ruta propia (`/archivos/<id>/<nombre>`) a quien ve su
   espacio o su canal. Se porta como el adaptador en memoria y pasa la misma batería de
   contrato (tests/contracts/files.test.ts).

   Cada objeto se guarda con su id (un uuid) como ruta, sin el nombre: el
   nombre viaja en la URL de la app. Cada llamada tiene tiempo máximo, y una
   caída o un error de Storage vuelven como `falla-externa`, nunca como
   excepción. Los logs llevan el adaptador, la operación y el código de error,
   nunca nombres de archivo ni contenidos. */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner, type DbResponse } from '@/lib/adapters/supabase/query'
import { type FilesPort, fileUrl, isFileId } from '@/lib/ports/files'
import { fail, ok } from '@/lib/result'

export type SupabaseFilesOptions = {
  client: SupabaseClient
  /** Bucket privado donde quedan los archivos. */
  bucket?: string
  /** Tiempo máximo de cada subida o bajada. */
  timeoutMs?: number
  log?: (message: string) => void
}

export const DEFAULT_BUCKET = 'hackai-files'

const MAX_BYTES = 10 * 1024 * 1024
const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

/** Lo que importa de un error de Storage. supabase-js no exporta su tipo
    `StorageError`, y storage-js no es una dependencia directa. */
type StorageFailure = { message: string; status?: number; statusCode?: string; code?: string }

/** Si Storage dice que el objeto no existe. Un bucket que falta también es un
    404, pero eso es una base mal armada: queda como falla externa. */
function isMissingObject(error: StorageFailure): boolean {
  if (error.code === 'NoSuchBucket' || /bucket/i.test(error.message)) return false
  return error.status === 404 || error.statusCode === '404' || error.code === 'NoSuchKey'
}

/** La respuesta de Storage con la forma que entiende el runner de consultas. */
function asDbResponse<T>(response: { data: T | null; error: StorageFailure | null }): DbResponse<T> {
  if (!response.error) return { data: response.data, error: null }
  return { data: null, error: { message: response.error.message, code: response.error.statusCode } }
}

export function createSupabaseFiles({
  client,
  bucket = DEFAULT_BUCKET,
  timeoutMs = 15000,
  log = console.warn
}: SupabaseFilesOptions): FilesPort {
  const run = createQueryRunner({ name: 'files', timeoutMs, log })
  const storage = () => client.storage.from(bucket)

  return {
    capabilities: { maxBytes: MAX_BYTES },

    async save(file) {
      if (file.bytes.byteLength > MAX_BYTES) return fail('demasiado-grande')
      const id = randomUUID()
      // La subida no acepta una señal para cortarla: el tiempo máximo la deja de
      // esperar, aunque el pedido siga en vuelo.
      const uploaded = await run('subir', () =>
        storage()
          .upload(id, file.bytes, { contentType: file.contentType, upsert: false })
          .then((response) => asDbResponse(response))
      )
      if (!uploaded.ok) return fail('falla-externa')
      return ok({
        id,
        name: file.name,
        contentType: file.contentType,
        size: file.bytes.byteLength,
        url: fileUrl(id, file.name)
      })
    },

    async read(id) {
      if (!isFileId(id)) return fail('no-encontrado')
      // Un objeto que no existe vuelve como `data: null` sin error, para que el
      // runner no lo cuente como caída.
      const downloaded = await run<Blob>('bajar', (signal) =>
        storage()
          .download(id, {}, { signal })
          .then((response) =>
            response.error && isMissingObject(response.error) ? { data: null, error: null } : asDbResponse(response)
          )
      )
      if (!downloaded.ok) return fail('falla-externa')
      if (!downloaded.value) return fail('no-encontrado')
      try {
        const bytes = new Uint8Array(await downloaded.value.arrayBuffer())
        return ok({ contentType: downloaded.value.type || FALLBACK_CONTENT_TYPE, bytes })
      } catch (cause) {
        log(`[files] bajar: ${cause instanceof Error ? cause.name : 'falla'}`)
        return fail('falla-externa')
      }
    },

    async delete(id) {
      // Un id sin forma de uuid no puede ser un archivo nuestro: no hay nada que borrar.
      if (!isFileId(id)) return ok(null)
      // Storage no avisa si el objeto no existía: borra lo que encuentra.
      const removed = await run('borrar', () =>
        storage()
          .remove([id])
          .then((response) => asDbResponse(response))
      )
      return removed.ok ? ok(null) : fail('falla-externa')
    }
  }
}
