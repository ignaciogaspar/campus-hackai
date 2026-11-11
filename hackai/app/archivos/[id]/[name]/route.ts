/* Entrega un archivo guardado (material de un espacio, adjunto de un mensaje)
   a quien lo puede ver. Es la URL que devuelve el puerto de Archivos: el bucket
   es privado y el navegador nunca va directo a Supabase.

   Pide sesión y le pide el archivo a Espacios, que chequea que la persona vea
   el espacio del material o el canal del adjunto. A quien no lo ve le responde
   404, igual que a un id que no existe, así no se sabe si el archivo está.

   Seguridad: el archivo se sirve desde nuestro origen, así que un HTML o un SVG
   subido podría correr código con la sesión de quien lo abre. Por eso solo un
   puñado de tipos inofensivos se abre en el navegador; todo lo demás se baja,
   y la respuesta va con nosniff y una CSP que no deja correr nada. */
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'

export const dynamic = 'force-dynamic'

/** Tipos que se pueden mostrar en el navegador sin riesgo. */
const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain'])

const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

/** El tipo guardado, si tiene forma de tipo MIME; si no, bytes sin tipo. */
function safeContentType(contentType: string): string {
  return /^[\x21-\x7e]+\/[\x20-\x7e]+$/.test(contentType) ? contentType : FALLBACK_CONTENT_TYPE
}

/** Content-Disposition con el nombre en ASCII y en UTF-8 (RFC 6266 y 5987). */
function disposition(contentType: string, name: string): string {
  const baseType = contentType.split(';')[0].trim().toLowerCase()
  const kind = INLINE_TYPES.has(baseType) ? 'inline' : 'attachment'
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const session = await getSession()
  if (!session) return new Response(null, { status: 401 })

  const { id, name } = await params
  const file = await system().spaces.file(session.personId, id)
  if (!file.ok) return new Response(null, { status: file.error === 'falla-externa' ? 502 : 404 })

  const contentType = safeContentType(file.value.contentType)
  return new Response(new Uint8Array(file.value.bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition(contentType, name),
      'Content-Length': String(file.value.bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private'
    }
  })
}
