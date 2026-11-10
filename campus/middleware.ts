import { NextResponse, type NextRequest } from 'next/server'
import { campusAbierto } from '@/lib/apertura'

/* Antes de la primera jornada el alumno solo ve la bienvenida, su organización,
   su perfil y la cohorte (lib/apertura.ts). */
const ABIERTAS_ANTES = new Set(['/campus/bienvenida', '/campus/organizacion', '/campus/perfil', '/campus/cohorte'])

export function middleware(req: NextRequest) {
  if (campusAbierto() || ABIERTAS_ANTES.has(req.nextUrl.pathname)) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/campus/bienvenida'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/campus', '/campus/:path*'] }
