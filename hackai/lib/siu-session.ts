/* La sesión del SIU de quien entra con su cuenta real. Viaja cifrada en una
   cookie de su navegador (`hackai_siu`, solo para el servidor), con AES-256-GCM
   y una clave derivada de SESSION_SECRET (lib/sealed-cookie.ts): HackAI no la
   guarda en ningún otro lado. La persona se reconoce con una clave que es un
   HMAC de su documento, así vuelve a ser la misma persona en la próxima
   sesión sin guardar el documento. ADR 0009. */
import { createHmac } from 'node:crypto'
import { seal, sessionSecret, unseal } from '@/lib/sealed-cookie'

export const SIU_SESSION_COOKIE = 'hackai_siu'
/** Lo que dura la cookie: más que una sesión del SIU, que vence antes por su cuenta. */
export const SIU_SESSION_MAX_AGE = 12 * 60 * 60

export type SiuSession = { key: string; session: string }

/** El uso de la cookie, que entra en su clave de cifrado. */
const PURPOSE = 'hackai-siu'

/** La clave de una persona: 12 caracteres de un HMAC de su documento. */
export function personKey(document: string): string {
  return createHmac('sha256', sessionSecret()).update(`siu-documento|${document}`).digest('hex').slice(0, 12)
}

export function sealSiuSession(value: SiuSession): string {
  return seal(PURPOSE, value)
}

export function openSiuSession(sealed: string | undefined): SiuSession | null {
  const value = unseal(PURPOSE, sealed) as Partial<SiuSession> | null
  return value && typeof value.key === 'string' && typeof value.session === 'string'
    ? { key: value.key, session: value.session }
    : null
}

/** La sesión del SIU pegada en el ingreso: el valor de la cookie, solo o con su nombre adelante
    («siu_sess__portal_ua_UA=…»). `null` si no parece una sesión del SIU. */
export function siuSessionFromInput(raw: unknown): string | null {
  const value = String(raw ?? '')
    .trim()
    .replace(/^siu_sess__portal_ua_UA\s*=\s*/, '')
    .replace(/;.*$/, '')
    .trim()
  return /^[A-Za-z0-9,-]{10,128}$/.test(value) ? value : null
}

/** La clave de la persona de una cuenta real del SIU (`p-siu-<clave>`), o `null` si es una persona de la demo. */
export const realKeyOf = (personId: string): string | null => personId.match(/^p-siu-([a-f0-9]{12})$/)?.[1] ?? null

/** La cuenta del SIU de una sesión de HackAI: `demo` si la persona no es de una cuenta real; su sesión del SIU si
    la cookie es suya; `null` si falta, no abre o es de otra persona (entonces no hay sesión). */
export function siuSessionOf(personId: string, sealed: string | undefined): 'demo' | SiuSession | null {
  const key = realKeyOf(personId)
  if (!key) return 'demo'
  const siu = openSiuSession(sealed)
  return siu && siu.key === key ? siu : null
}
