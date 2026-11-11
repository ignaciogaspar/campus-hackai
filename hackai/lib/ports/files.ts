/* Puerto de archivos: guardar un archivo y obtener su URL. Lo usa Espacios
   para el material subido a HackAI y para copiar los adjuntos de Discord,
   cuyas URLs vencen. Producción: Supabase Storage. */
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
  id: string
  name: string
  contentType: string
  size: number
  url: string
}

export type FilesError = 'demasiado-grande' | ExternalFailure

export type FilesPort = {
  capabilities: FilesCapabilities
  save(file: NewFile): Promise<Result<StoredFile, FilesError>>
}
