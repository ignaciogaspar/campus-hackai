import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { siteOrigin } from '@/lib/site'

/* Los scripts del instalador viven como archivos (lib/setup/campus-setup.sh y
   .ps1, incluidos en el bundle por outputFileTracingIncludes en next.config.ts).
   Se sirven con el origin del campus ya puesto en __CAMPUS_URL__. */

const SAFE_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d+)?$/

/** Origin público: NEXT_PUBLIC_SITE_URL o el host del request. Solo caracteres seguros para incrustar en un script. */
export function setupOrigin(req: Request): string {
  const h = req.headers
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  const origin = siteOrigin(host ? `${proto}://${host}` : new URL(req.url).origin)
  return SAFE_ORIGIN.test(origin) ? origin : 'https://campus-austral.vercel.app'
}

export function setupScript(kind: 'sh' | 'ps1', origin: string): string {
  const file = join(process.cwd(), 'lib/setup', `campus-setup.${kind}`)
  return readFileSync(file, 'utf8').replaceAll('__CAMPUS_URL__', origin)
}

export function scriptResponse(kind: 'sh' | 'ps1', req: Request): Response {
  return new Response(setupScript(kind, setupOrigin(req)), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="campus-setup.${kind}"`,
    },
  })
}
