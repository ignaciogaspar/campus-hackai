/* La dirección de la propia HackAI, para el QR del ingreso. */

type Headers = { get(name: string): string | null }

/** El primer valor de un encabezado que puede venir repetido por proxies. */
const first = (value: string | null) => value?.split(',')[0]?.trim() || null

/** La dirección del ingreso tal como la pidió el navegador: detrás de Vercel
    o de otro proxy vale la de `x-forwarded-*`. `null` sin `host`. */
export function signInUrl(headers: Headers): string | null {
  const host = first(headers.get('x-forwarded-host')) ?? first(headers.get('host'))
  if (!host) return null
  const forwarded = first(headers.get('x-forwarded-proto'))
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : 'http'
  return `${proto}://${host}/`
}
