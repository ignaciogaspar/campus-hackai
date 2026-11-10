/* Origin público del campus para QRs y links absolutos.
   NEXT_PUBLIC_SITE_URL (opcional, p. ej. https://campus.example.com) tiene
   prioridad sobre window.location.origin: así el QR apunta al dominio de
   producción aunque el profesor abra una URL de deployment o de preview
   (que en Vercel piden login). Se incrusta en el build. */

export function siteOrigin(fallback = ''): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/+$/, '')
  return fallback.replace(/\/+$/, '')
}

/** El origin para el navegador: NEXT_PUBLIC_SITE_URL o window.location.origin. */
export function browserOrigin(): string {
  return siteOrigin(typeof window !== 'undefined' ? window.location.origin : '')
}

/**
 * href seguro para un link o QR que llega en un overlay: rutas internas
 * (empiezan con una sola /) o URLs http(s). Cualquier otra cosa
 * (javascript:, data:, //host…) devuelve null.
 */
export function safeHref(url: string | null | undefined, opts: { internalOnly?: boolean } = {}): string | null {
  if (!url || typeof url !== 'string') return null
  const u = url.trim()
  if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/\\')) return u
  if (opts.internalOnly) return null
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}
