/* Archivos en memoria: los bytes quedan en un Map mientras viva el proceso.
   Devuelve la misma URL que en producción (`/archivos/<id>/<nombre>`), así la
   ruta que entrega los archivos anda igual sin almacenamiento real. Pasa la
   misma batería de contrato que Supabase (tests/contracts/files.test.ts). */
import { randomUUID } from 'node:crypto'
import { type FileContent, type FilesPort, fileUrl, isFileId } from '@/lib/ports/files'
import { fail, ok } from '@/lib/result'

const MAX_BYTES = 10 * 1024 * 1024

type Entry = { name: string; contentType: string; bytes: Uint8Array }

export function createMemoryFiles(): FilesPort {
  const stored = new Map<string, Entry>()

  return {
    capabilities: { maxBytes: MAX_BYTES },

    async save(file) {
      if (file.bytes.byteLength > MAX_BYTES) return fail('demasiado-grande')
      const id = randomUUID()
      // Copia de los bytes: si quien guardó los cambia después, el archivo no.
      stored.set(id, { name: file.name, contentType: file.contentType, bytes: file.bytes.slice() })
      return ok({
        id,
        name: file.name,
        contentType: file.contentType,
        size: file.bytes.byteLength,
        url: fileUrl(id, file.name)
      })
    },

    async read(id) {
      const entry = isFileId(id) ? stored.get(id) : undefined
      if (!entry) return fail('no-encontrado')
      const content: FileContent = { name: entry.name, contentType: entry.contentType, bytes: entry.bytes.slice() }
      return ok(content)
    },

    async delete(id) {
      stored.delete(id)
      return ok(null)
    }
  }
}
