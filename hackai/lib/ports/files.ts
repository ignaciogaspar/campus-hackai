/* Puerto de archivos: guardar un archivo y volver a leerlo. Lo usa Espacios
   para el material subido a HackAI y para copiar los adjuntos de Discord,
   cuyas URLs vencen. Producción: Supabase Storage, en un bucket privado.

   El material de un espacio lo ven solo sus miembros, así que ningún archivo
   tiene una URL pública: la URL de un archivo guardado es una ruta propia de la
   app (`/archivos/<id>/<nombre>`, app/archivos/[id]/[name]/route.ts) que pide
   sesión y le pide el archivo a Espacios: este chequea que la persona vea el
   espacio o el canal del archivo y recién ahí lo lee acá. Es la misma forma
   con cualquier adaptador. */
import type { ExternalFailure, Result } from '@/lib/result'

export type FilesCapabilities = {
  /** Tamaño máximo de un archivo, en bytes. */
  maxBytes: number
}

export type NewFile = {
  name: string
  contentType: string
  bytes: Uint8Array
}

export type StoredFile = {
  /** Un uuid: no se puede adivinar ni recorrer. */
  id: string
  name: string
  contentType: string
  size: number
  /** Ruta de la app que entrega el archivo: `/archivos/<id>/<nombre>`. */
  url: string
}

/** Los bytes de un archivo guardado. El nombre puede faltar: la ruta que lo
    entrega lo toma de la URL. */
export type FileContent = {
  name?: string
  contentType: string
  bytes: Uint8Array
}

export type FilesError = 'demasiado-grande' | ExternalFailure
export type FilesReadError = 'no-encontrado' | ExternalFailure

export type FilesPort = {
  capabilities: FilesCapabilities
  save(file: NewFile): Promise<Result<StoredFile, FilesError>>
  /** Los bytes de un archivo guardado. Un id que no es de un archivo, o que ni
      siquiera tiene forma de uuid, es `no-encontrado`. */
  read(id: string): Promise<Result<FileContent, FilesReadError>>
  /** Borra un archivo guardado. Un id que no existe no es un error: el archivo
      ya no está, que es lo que se pedía. Sirve para no dejar archivos sueltos
      cuando falla lo que iba a referenciarlos. */
  delete(id: string): Promise<Result<null, ExternalFailure>>
}

const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Si el texto tiene forma de id de archivo (un uuid en minúsculas). Se chequea
    antes de leer, así un id armado a mano nunca llega como ruta al almacén. */
export function isFileId(id: string): boolean {
  return FILE_ID.test(id)
}

/** La URL de la app que entrega un archivo guardado. */
export function fileUrl(id: string, name: string): string {
  return `/archivos/${id}/${encodeURIComponent(name)}`
}
