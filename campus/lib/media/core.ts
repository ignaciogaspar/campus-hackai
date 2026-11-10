// Media de los decks en Supabase Storage (bucket público `media`, migración 0220).
// Sin 'server-only': lo usan las server actions del editor y los seeds (tsx).
// El cliente que se pasa tiene que ser service role.
import type { SupabaseClient } from '@supabase/supabase-js'

export const MEDIA_BUCKET = 'media'
/** Igual que file_size_limit del bucket. */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024

const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', pdf: 'application/pdf',
}

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf'

export interface MediaAsset {
  id: string
  path: string
  url: string
  filename: string
  contentType: string
  kind: MediaKind
  sizeBytes: number
  createdAt: string
}

export class MediaError extends Error {}

export const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '')

/** Tipo MIME por extensión, o null si el bucket no lo acepta. */
export function mediaType(filename: string): string | null {
  return TYPES[extOf(filename)] ?? null
}

export function mediaKind(contentType: string): MediaKind {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'
  return 'pdf'
}

/** Valida nombre, tipo y tamaño; devuelve el tipo MIME que corresponde a la extensión. */
export function checkMedia(filename: string, size: number): string {
  const type = mediaType(filename)
  if (!type) throw new MediaError(`«${filename}»: formato no admitido (imágenes, mp4, webm, mp3, m4a, wav o pdf)`)
  if (!(size > 0)) throw new MediaError(`«${filename}» está vacío`)
  if (size > MEDIA_MAX_BYTES) throw new MediaError(`«${filename}» pesa ${(size / 1048576).toFixed(1)} MB: el máximo es 50 MB`)
  return type
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'archivo'

/**
 * Ruta dentro del bucket. Con `stable` (seeds) es decks/<deck>/<archivo> y se
 * pisa al recargar; sin él lleva un sufijo al azar para no pisar otra subida.
 */
export function mediaPath(deckId: string, filename: string, stable = false): string {
  const ext = extOf(filename)
  const base = slug(filename.replace(/\.[^.]+$/, ''))
  const suffix = stable ? '' : `-${Math.random().toString(36).slice(2, 8)}`
  return `decks/${slug(deckId)}/${base}${suffix}.${ext}`
}

/** URL pública de un archivo del bucket (no consulta la red). */
export function mediaUrl(path: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!supabaseUrl) throw new MediaError('Falta NEXT_PUBLIC_SUPABASE_URL')
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** URL pública de un archivo que el seed sube para un deck (storageMedia). */
export const deckMediaUrl = (deckId: string, filename: string) => mediaUrl(mediaPath(deckId, filename, true))

interface Row { id: string; path: string; filename: string; content_type: string; size_bytes: number; created_at: string }

const toAsset = (r: Row): MediaAsset => ({
  id: r.id, path: r.path, url: mediaUrl(r.path), filename: r.filename, contentType: r.content_type,
  kind: mediaKind(r.content_type), sizeBytes: Number(r.size_bytes), createdAt: r.created_at,
})

const COLS = 'id, path, filename, content_type, size_bytes, created_at'

export async function listMedia(db: SupabaseClient, deckId: string): Promise<MediaAsset[]> {
  const { data, error } = await db.from('media_assets').select(COLS).eq('deck_id', deckId).order('created_at', { ascending: false })
  if (error) throw new MediaError(`media: ${error.message}`)
  return (data as Row[]).map(toAsset)
}

/** Registra (o actualiza, por path) un archivo que ya está en el bucket. */
export async function registerMedia(db: SupabaseClient, a: {
  path: string, deckId: string, filename: string, contentType: string, sizeBytes: number, uploadedBy?: string | null, via?: 'editor' | 'import'
}): Promise<MediaAsset> {
  const { data: deck } = await db.from('decks').select('course_id').eq('id', a.deckId).maybeSingle()
  const { data, error } = await db.from('media_assets').upsert({
    path: a.path, deck_id: a.deckId, course_id: deck?.course_id ?? null, filename: a.filename, content_type: a.contentType,
    size_bytes: a.sizeBytes, uploaded_by: a.uploadedBy ?? null, via: a.via ?? 'editor',
  }, { onConflict: 'path' }).select(COLS).single()
  if (error) throw new MediaError(`registrar media: ${error.message}`)
  return toAsset(data as Row)
}

/** Sube un archivo desde el servidor o un script y lo registra. */
export async function uploadMedia(db: SupabaseClient, a: {
  deckId: string, filename: string, data: Uint8Array, stable?: boolean, uploadedBy?: string | null, via?: 'editor' | 'import'
}): Promise<MediaAsset> {
  const contentType = checkMedia(a.filename, a.data.byteLength)
  const path = mediaPath(a.deckId, a.filename, a.stable)
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, a.data, { contentType, upsert: Boolean(a.stable), cacheControl: '3600' })
  if (error) throw new MediaError(`subir ${a.filename}: ${error.message}`)
  return registerMedia(db, { path, deckId: a.deckId, filename: a.filename, contentType, sizeBytes: a.data.byteLength, uploadedBy: a.uploadedBy, via: a.via })
}

/** Fragmento para pegar en una slide: HTML en las slides 'iae', Markdown en el resto. */
export function mediaSnippet(a: Pick<MediaAsset, 'url' | 'filename' | 'kind'>, html: boolean): string {
  const alt = a.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/"/g, '')
  if (a.kind === 'image') return html ? `<img src="${a.url}" alt="${alt}" style="max-width:100%;border-radius:10px"/>` : `![${alt}](${a.url})`
  if (a.kind === 'video') return html ? `<video controls playsinline preload="metadata" src="${a.url}" style="max-width:100%"></video>` : `[▶ ${alt}](${a.url})`
  return html ? `<a href="${a.url}" target="_blank" rel="noopener">${alt}</a>` : `[${alt}](${a.url})`
}
