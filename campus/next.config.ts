import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

/* Videos del deck HTML de Empresas Familiares (~147 MB de mp4): no se suben a
   Vercel (.vercelignore) y se sirven desde el deploy estático del deck. Si
   los archivos están en disco (desarrollo local, clase sin internet) se usan
   esos; si no, /decks/empresas-familiares/media/*.mp4 redirige al CDN.
   EF_MEDIA_ORIGIN cambia el destino; EF_MEDIA_REMOTE=1 fuerza la redirección. */
const EF_MEDIA_ORIGIN = (process.env.EF_MEDIA_ORIGIN || 'https://empresas-familiares-ia.vercel.app').replace(/\/+$/, '')
const efMediaLocal = existsSync(join(process.cwd(), 'public/decks/empresas-familiares/media/pollen.mp4'))
const efMediaRemote = process.env.EF_MEDIA_REMOTE === '1' || !efMediaLocal

const securityHeaders = [
  // el deck HTML y los simuladores se cargan en iframes del mismo origen: SAMEORIGIN, no DENY
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // reduce la fuga de /api/mcp/<token> en el Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // la voz (Web Speech API) usa el micrófono en la página principal
  { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // los instaladores se leen del disco en runtime (lib/setup/scripts.ts)
  outputFileTracingIncludes: {
    '/setup': ['./lib/setup/campus-setup.sh'],
    '/setup.ps1': ['./lib/setup/campus-setup.ps1'],
  },
  experimental: {
    serverActions: {
      // Vercel corta el body de las funciones en 4,5 MB: el límite declarado coincide con el real
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    if (!efMediaRemote) return []
    // un nivel de carpeta como máximo (media/x.mp4 y media/re/x.mp4)
    return [
      { source: '/decks/empresas-familiares/media/:file([^/]+\\.mp4)', destination: `${EF_MEDIA_ORIGIN}/media/:file`, permanent: false },
      { source: '/decks/empresas-familiares/media/:dir([^/]+)/:file([^/]+\\.mp4)', destination: `${EF_MEDIA_ORIGIN}/media/:dir/:file`, permanent: false },
    ]
  },
}

export default nextConfig
