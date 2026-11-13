/* A dónde volver después de entrar. Quien llega sin sesión a una ruta que la
   pide (una pantalla, el enlace a un archivo del material, un enlace de
   Discord o de un aviso) va al ingreso con `?next=<ruta>`, y al entrar vuelve
   ahí en vez de ir a su inicio. La ruta pedida la pasa middleware.ts en un
   header del pedido, porque las páginas no la conocen. */

/** Una ruta de la app: empieza con una sola `/` y tiene solo caracteres
    imprimibles de una URL, sin espacios ni `\`. Así `//otro.sitio` o
    `/\otro.sitio`, que el navegador lee como otro dominio, no pasan. */
const APP_PATH = /^\/(?![/\\])[\x21-\x5b\x5d-\x7e]*$/

/** Más largo que esto no es una ruta nuestra. */
const MAX_LENGTH = 2048

/** El header del pedido donde middleware.ts deja la ruta pedida. */
export const REQUESTED_PATH_HEADER = 'x-hackai-ruta'

/** Los parámetros que agrega Next.js a sus propios pedidos: no son parte de la ruta a la que se quiso ir. */
const INTERNAL_PARAMS = ['_rsc']

/** La ruta pedida, con su consulta, para volver ahí después de entrar. */
export function requestedPath(url: { pathname: string; search: string }): string {
  const params = new URLSearchParams(url.search)
  for (const name of INTERNAL_PARAMS) params.delete(name)
  const query = params.toString()
  return query ? `${url.pathname}?${query}` : url.pathname
}

/** A dónde va quien pide `path` sin sesión: al ingreso, que vuelve a `path` al entrar. Del inicio, o de algo que no
    es una ruta de la app, va al ingreso solo. */
export function signInFor(path: string | null): string {
  const returnTo = safeReturnTo(path)
  return returnTo && returnTo !== '/' ? signInUrl(returnTo) : '/'
}

/** La URL del ingreso que, al entrar, vuelve a `returnTo`. */
export function signInUrl(returnTo: string): string {
  return `/?${new URLSearchParams({ next: returnTo })}`
}

/** El `next` del ingreso, si es una ruta de la app; si no, nada. Lo escribe
    quien arma la URL, así que no se confía en él: sin esto, un enlace al
    ingreso podría mandar a alguien a otro sitio después de entrar. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_LENGTH) return null
  return APP_PATH.test(value) ? value : null
}
