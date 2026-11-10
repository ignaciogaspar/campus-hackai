'use server'

import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkMedia, listMedia, MEDIA_BUCKET, MediaError, mediaPath, registerMedia } from '@/lib/media/core'
import type { MediaAsset } from '@/lib/media/core'

/* Media del deck. El archivo no pasa por la server action (Vercel corta el body
   en 4,5 MB): el servidor valida y da una URL firmada, el navegador sube directo
   al bucket y después se confirma, que verifica el objeto y lo registra. */

export type MediaResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function guard<T extends object>(fn: (personId: string) => Promise<T>): Promise<MediaResult<T>> {
  const session = await requireSession('profesor')
  try {
    return { ok: true, ...(await fn(session.personId)) }
  } catch (err) {
    if (!(err instanceof MediaError)) console.error('[media]', err)
    return { ok: false, error: (err as Error).message || 'Algo falló' }
  }
}

async function deckExists(deckId: string) {
  const { data } = await db().from('decks').select('id').eq('id', deckId).maybeSingle()
  if (!data) throw new MediaError(`No existe el deck ${deckId}`)
}

export async function listDeckMediaAction(deckId: string): Promise<MediaResult<{ assets: MediaAsset[] }>> {
  return guard(async () => ({ assets: await listMedia(db(), deckId) }))
}

export async function requestMediaUploadAction(input: { deckId: string, filename: string, size: number }): Promise<MediaResult<{ path: string, token: string, contentType: string }>> {
  return guard(async () => {
    const contentType = checkMedia(input.filename, input.size)
    await deckExists(input.deckId)
    const path = mediaPath(input.deckId, input.filename)
    const { data, error } = await db().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path)
    if (error || !data) throw new MediaError(`No se pudo preparar la subida: ${error?.message ?? 'sin respuesta'}`)
    return { path, token: data.token, contentType }
  })
}

export async function confirmMediaUploadAction(input: { deckId: string, path: string, filename: string }): Promise<MediaResult<{ asset: MediaAsset }>> {
  return guard(async (personId) => {
    if (!input.path.startsWith(mediaPath(input.deckId, 'x.png', true).replace(/x\.png$/, ''))) throw new MediaError('Ruta de media inválida')
    const { data: info, error } = await db().storage.from(MEDIA_BUCKET).info(input.path)
    if (error || !info) throw new MediaError(`El archivo no llegó al bucket: ${error?.message ?? 'no está'}`)
    const size = Number(info.size ?? 0)
    const contentType = checkMedia(input.filename, size)
    return { asset: await registerMedia(db(), { path: input.path, deckId: input.deckId, filename: input.filename, contentType, sizeBytes: size, uploadedBy: personId }) }
  })
}
