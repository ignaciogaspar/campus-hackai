/* A dónde volver después de entrar. Quien llega sin sesión a una ruta que la
   pide (por ejemplo, el enlace a un archivo del material) va al ingreso con
   `?next=<ruta>`, y al entrar vuelve ahí en vez de ir a su inicio. */

/** Una ruta de la app: empieza con una sola `/` y tiene solo caracteres
    imprimibles de una URL, sin espacios ni `\`. Así `//otro.sitio` o
    `/\otro.sitio`, que el navegador lee como otro dominio, no pasan. */
const APP_PATH = /^\/(?![/\\])[\x21-\x5b\x5d-\x7e]*$/

/** Más largo que esto no es una ruta nuestra. */
const MAX_LENGTH = 2048

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
