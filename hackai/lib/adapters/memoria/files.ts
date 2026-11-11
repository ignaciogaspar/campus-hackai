/* Archivos en memoria. Devuelve una URL `data:` para que el archivo se pueda
   abrir en el navegador aunque no haya almacenamiento real. */
import type { FilesPort, StoredFile } from '@/lib/ports/files'
import { fail, ok } from '@/lib/result'

const MAX_BYTES = 10 * 1024 * 1024

export function createMemoryFiles(): FilesPort {
  const stored: StoredFile[] = []

  return {
    capabilities: { maxBytes: MAX_BYTES },
    async save(file) {
      if (file.bytes.byteLength > MAX_BYTES) return fail('demasiado-grande')
      const saved: StoredFile = {
        id: `f-${stored.length + 1}`,
        name: file.name,
        contentType: file.contentType,
        size: file.bytes.byteLength,
        url: `data:${file.contentType};base64,${Buffer.from(file.bytes).toString('base64')}`
      }
      stored.push(saved)
      return ok({ ...saved })
    }
  }
}
