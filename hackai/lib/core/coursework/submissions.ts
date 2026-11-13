/* Las reglas de los archivos de una entrega y cómo se guardan. Lo demás de
   entregar (quién puede, el reemplazo, el atraso) vive en module.ts. */
import type { StoredTaskFile, SubmitError } from '@/lib/core/coursework'
import type { FilesPort, NewFile } from '@/lib/ports/files'
import { fail, ok, type Result } from '@/lib/result'

/** Cuántos archivos lleva como mucho una entrega. */
export const MAX_SUBMISSION_FILES = 10

type FilesError = Extract<SubmitError, 'sin-archivos' | 'demasiados-archivos' | 'archivo-vacio' | 'demasiado-grande'>

/** Los archivos que llegan del navegador, si sirven: al menos uno, ninguno vacío y, entre todos, no más que lo que
    acepta Archivos (el pedido entero llega junto, así que el tope es sobre la suma). */
export function checkedFiles(files: NewFile[], maxBytes: number): Result<NewFile[], FilesError> {
  if (files.length === 0) return fail('sin-archivos')
  if (files.length > MAX_SUBMISSION_FILES) return fail('demasiados-archivos')
  if (files.some((f) => f.bytes.byteLength === 0)) return fail('archivo-vacio')
  const total = files.reduce((sum, f) => sum + f.bytes.byteLength, 0)
  return total > maxBytes ? fail('demasiado-grande') : ok(files)
}

/** Guarda todos los archivos en Archivos. Si alguno falla, borra los que ya se guardaron: no quedan sueltos. */
export async function saveAll(
  files: FilesPort,
  input: NewFile[]
): Promise<Result<StoredTaskFile[], 'demasiado-grande' | 'falla-externa'>> {
  const saved: StoredTaskFile[] = []
  for (const file of input) {
    const stored = await files.save(file)
    if (!stored.ok) {
      await removeAll(files, saved)
      return fail(stored.error)
    }
    const { id, name, contentType, size } = stored.value
    saved.push({ id, name, contentType, size })
  }
  return ok(saved)
}

/** Borra archivos guardados que ya no referencia nada. */
export async function removeAll(files: FilesPort, stored: StoredTaskFile[]): Promise<void> {
  await Promise.all(stored.map((f) => files.delete(f.id)))
}
