/* Entrega de un archivo guardado (material de un espacio, adjunto de un
   mensaje): lo que responde la ruta `/archivos/<id>/<nombre>`
   (app/archivos/[id]/[name]/route.ts). El bucket es privado y el navegador
   nunca va directo a Supabase: el archivo sale de acá, a quien lo puede ver.
   Quién lo ve lo decide `file` de Espacios (material y adjuntos) o de
   Seguimiento (la consigna de una tarea): la ruta pregunta primero a uno y
   después al otro.

   Seguridad: el archivo se sirve desde nuestro origen, así que un HTML o un
   SVG subido podría correr código con la sesión de quien lo abre. Por eso solo
   un puñado de tipos inofensivos se abre en el navegador; todo lo demás se
   baja, con una CSP que no deja correr nada. Todo va con nosniff, así el
   navegador no adivina otro tipo que el guardado. */

import type { Coursework } from '@/lib/core/coursework'
import type { PersonId } from '@/lib/core/people'
import type { Spaces } from '@/lib/core/spaces'
import type { FileContent } from '@/lib/ports/files'
import type { ErrorOf, Result } from '@/lib/result'
import { signInUrl } from '@/lib/return-to'

export type FileDeliveryDeps = {
  /** Quién pide el archivo, según la sesión; nada si no hay sesión. */
  personId: PersonId | null
  /** Los bytes del archivo, si la persona lo ve: `file` de Espacios y, si no es suyo, el de Seguimiento. */
  file: (personId: PersonId, fileId: string) => Promise<Result<FileContent, FileError>>
}

/** `file` de la ruta: pregunta primero a Espacios (material y adjuntos) y, si el archivo no es suyo, a Seguimiento
    (la consigna de una tarea). Cualquier otro error de Espacios, como `sin-acceso`, se devuelve tal cual. */
export function fileFrom({ spaces, coursework }: { spaces: Spaces; coursework: Coursework }): FileDeliveryDeps['file'] {
  return async (personId, fileId) => {
    const found = await spaces.file(personId, fileId)
    if (found.ok || found.error !== 'archivo-desconocido') return found
    return coursework.file(personId, fileId)
  }
}

/** Tipos que el navegador abre con su visor de PDF o de imágenes. Ese visor no
    corre nada de nuestro origen, y una CSP restrictiva se lo puede arruinar:
    en Chrome, la imagen pierde los estilos de su visor. Van sin CSP. */
const VIEWER_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'])

/** Tipos que se pueden mostrar en el navegador sin riesgo. El resto se baja. */
const INLINE_TYPES = new Set([...VIEWER_TYPES, 'text/plain'])

/** Para lo que no abre un visor: que no corra nada, ni siquiera en nuestro origen. */
const LOCKED_DOWN = "default-src 'none'; sandbox"

const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

/** El tipo guardado, si tiene forma de tipo MIME; si no, bytes sin tipo. */
function safeContentType(contentType: string): string {
  return /^[\x21-\x7e]+\/[\x20-\x7e]+$/.test(contentType) ? contentType : FALLBACK_CONTENT_TYPE
}

/** El tipo sin parámetros y en minúsculas: `Application/PDF; x=y` → `application/pdf`. */
function baseType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase()
}

/** Content-Disposition con el nombre en ASCII y en UTF-8 (RFC 6266 y 5987). */
function disposition(contentType: string, name: string): string {
  const kind = INLINE_TYPES.has(baseType(contentType)) ? 'inline' : 'attachment'
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_')
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

/** Los headers de seguridad: nosniff siempre, así el navegador no reinterpreta
    el tipo, y la CSP cerrada para todo lo que no abre un visor. */
function securityHeaders(contentType: string): Record<string, string> {
  const headers: Record<string, string> = { 'X-Content-Type-Options': 'nosniff' }
  if (!VIEWER_TYPES.has(baseType(contentType))) headers['Content-Security-Policy'] = LOCKED_DOWN
  return headers
}

/** Caché: el contenido de un id no cambia nunca, así que el id es la etiqueta
    (ETag) del archivo. Con `no-cache` el navegador guarda el archivo pero
    pregunta antes de volver a mostrarlo; la pregunta pasa por la sesión y por
    las reglas de Espacios, y si sigue pudiendo verlo recibe un 304 sin cuerpo
    en vez del archivo entero. Así, después de «Salir» o si deja de ver el
    espacio, la copia guardada no se vuelve a mostrar. `private`: ningún
    intermediario lo guarda, solo el navegador de quien lo abrió. */
const CACHE_CONTROL = 'private, no-cache'

/** Si el navegador ya tiene esta versión: `If-None-Match` con la etiqueta, en
    una lista o débil (`W/"…"`), o `*`. */
function matches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  return ifNoneMatch.split(',').some((tag) => {
    const value = tag.trim()
    return value === '*' || value.replace(/^W\//, '') === etag
  })
}

/** Estilos de las páginas de error: los colores de la app y letra del sistema,
    porque la CSP de la página no deja bajar fuentes. Una columna que se
    centra, igual en el celular que en la compu. Los colores son copia de los
    tokens de app/globals.css (fondo, tinta, borde, azul y azul claro): si
    cambia la paleta, cambian acá. */
const PAGE_STYLE = [
  '*{box-sizing:border-box}',
  'body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:16px;background:#f5f7fc;color:#10142c;font:16px/1.5 Montserrat,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  'main{width:100%;max-width:26rem;padding:24px;border:1px solid #e4e7f0;border-radius:14px;background:#fff}',
  'h1{margin:0 0 8px;font-size:1.25rem;line-height:1.3;text-wrap:balance}',
  'p{margin:0 0 20px;color:#5f6474;text-wrap:pretty}',
  'nav{display:flex;flex-wrap:wrap;gap:8px}',
  'a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;text-decoration:none;color:#2c4e99;border:1px solid #e4e7f0}',
  'a:first-child{background:#2c4e99;border-color:#2c4e99;color:#fff}',
  'a:focus-visible{outline:3px solid #4573c0;outline-offset:2px}'
].join('')

/** Una página corta, sin nada que venga del pedido: todo el texto es fijo. */
function page(title: string, text: string, links: [href: string, label: string][]): string {
  const nav = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Campus HackAI</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${text}</p>
<nav>${nav}</nav>
</main>
</body>
</html>
`
}

type ErrorPage = { status: number; body: string }

/** La misma para un archivo que no existe y para uno que la persona no ve: si
    fueran distintas, la página diría qué archivos existen. */
const UNAVAILABLE: ErrorPage = {
  status: 404,
  body: page(
    'Este archivo no está disponible',
    'Puede que lo hayan borrado o que no tengas acceso. Buscalo en el material o en los canales de tu materia.',
    [['/', 'Ir a HackAI']]
  )
}

/** Un `href` vacío vuelve a pedir la misma URL. */
const STORAGE_DOWN: ErrorPage = {
  status: 502,
  body: page('No pudimos abrir el archivo', 'El almacenamiento de archivos no responde. Probá de nuevo en un rato.', [
    ['', 'Probar de nuevo'],
    ['/', 'Ir a HackAI']
  ])
}

/** Los errores de `file` de Espacios; los de Seguimiento son los mismos. */
type FileError = ErrorOf<ReturnType<Spaces['file']>>

/** La página de cada error de Espacios. Es exhaustivo a propósito: si Espacios
    suma un error, el typecheck pide decidir qué página muestra. */
const ERROR_PAGES: Record<FileError, ErrorPage> = {
  'archivo-desconocido': UNAVAILABLE,
  'sin-acceso': UNAVAILABLE,
  'persona-desconocida': UNAVAILABLE,
  'falla-externa': STORAGE_DOWN
}

function errorResponse({ status, body }: ErrorPage): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Cache-Control': 'no-store'
    }
  })
}

/** La respuesta al pedido de un archivo: sus bytes, o por qué no. */
export async function deliverFile(
  request: Request,
  { id, name }: { id: string; name: string },
  { personId, file }: FileDeliveryDeps
): Promise<Response> {
  // Sin sesión, al ingreso: al entrar vuelve a este mismo archivo.
  if (!personId) {
    const location = signInUrl(new URL(request.url).pathname)
    return new Response(null, { status: 307, headers: { Location: location, 'Cache-Control': 'no-store' } })
  }

  const found = await file(personId, id)
  if (!found.ok) return errorResponse(ERROR_PAGES[found.error])

  const contentType = safeContentType(found.value.contentType)
  const etag = `"${id}"`
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Disposition': disposition(contentType, name),
    ...securityHeaders(contentType),
    ETag: etag,
    'Cache-Control': CACHE_CONTROL
  }
  // Ya lo tiene: se le confirma que sigue igual, con los headers al día, sin el cuerpo.
  if (matches(request.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers })

  return new Response(new Uint8Array(found.value.bytes), {
    headers: { ...headers, 'Content-Length': String(found.value.bytes.byteLength) }
  })
}
