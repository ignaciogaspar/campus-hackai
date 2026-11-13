/* Le pasa a las páginas y a las rutas la ruta pedida, en un header del pedido
   (lib/return-to.ts): así requireSession(), sin sesión, manda al ingreso con
   `?next=` y después de entrar se vuelve ahí. No mira la sesión ni decide nada:
   solo copia la ruta. El header se pisa siempre, así que no se puede mandar
   uno propio. */
import { type NextRequest, NextResponse } from 'next/server'
import { REQUESTED_PATH_HEADER, requestedPath } from '@/lib/return-to'

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set(REQUESTED_PATH_HEADER, requestedPath(request.nextUrl))
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Ni los archivos de Next.js, ni la API, ni lo que tiene extensión (íconos, el service worker, los archivos del
  // material, que vuelven al ingreso por su cuenta: lib/file-delivery.ts).
  matcher: ['/((?!_next/|api/|.*\\..*).*)']
}
