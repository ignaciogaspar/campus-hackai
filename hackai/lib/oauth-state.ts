/* El `state` de una autorización OAuth (Conectar con Discord): firmado con SESSION_SECRET, con la persona, el
   espacio y la materia, y de un solo uso. Al salir hacia Discord, el nonce va también en una cookie del
   navegador; al volver, la vuelta vale solo si la firma es buena, no venció, es de la misma persona y su nonce
   es el de la cookie y no se usó antes. Así se rechaza una vuelta que no empezó en HackAI o que se repite. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const OAUTH_STATE_COOKIE = 'hackai_oauth_state'

/** Cuánto tiene la persona para autorizar en Discord y volver, en segundos. */
export const OAUTH_STATE_MAX_AGE = 10 * 60

export type OAuthState = { personId: string; spaceId: string; subjectId: string }

export type OAuthStateError = 'state-invalido' | 'state-vencido' | 'state-ajeno' | 'state-usado'

/** Lo firmado lleva un propósito, así un token de sesión nunca pasa por un `state` ni al revés. */
const PURPOSE = 'oauth-state'

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(`${PURPOSE}.${body}`).digest('base64url')
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Un `state` nuevo y su nonce, que va en la cookie. `now` en milisegundos. */
export function createOAuthState(secret: string, state: OAuthState, now: number): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url')
  const exp = Math.floor(now / 1000) + OAUTH_STATE_MAX_AGE
  const body = Buffer.from(JSON.stringify({ ...state, nonce, exp })).toString('base64url')
  return { state: `${body}.${sign(secret, body)}`, nonce }
}

type Check = {
  /** La persona con sesión en la vuelta. */
  personId: string
  /** El nonce de la cookie, o `null` si no vino. */
  nonce: string | null
  now: number
  /** Los nonces ya usados en este proceso: se agrega el de esta vuelta. */
  used: Set<string>
}

function parse(secret: string, token: string): (OAuthState & { nonce: string; exp: number }) | null {
  const [body, mac, extra] = token.split('.')
  if (!body || !mac || extra !== undefined || !sameText(sign(secret, body), mac)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    const fields = [data.personId, data.spaceId, data.subjectId, data.nonce]
    if (!fields.every((f) => typeof f === 'string') || typeof data.exp !== 'number') return null
    return data
  } catch {
    return null
  }
}

/** Lo que llevaba el `state`, si la vuelta vale; si no, por qué no. La consume: no vale dos veces. */
export function consumeOAuthState(
  secret: string,
  token: string | null,
  { personId, nonce, now, used }: Check
): { ok: true; value: OAuthState } | { ok: false; error: OAuthStateError } {
  const data = token ? parse(secret, token) : null
  if (!data || !nonce || !sameText(data.nonce, nonce)) return { ok: false, error: 'state-invalido' }
  if (data.exp < Math.floor(now / 1000)) return { ok: false, error: 'state-vencido' }
  if (data.personId !== personId) return { ok: false, error: 'state-ajeno' }
  if (used.has(data.nonce)) return { ok: false, error: 'state-usado' }
  used.add(data.nonce)
  return { ok: true, value: { personId: data.personId, spaceId: data.spaceId, subjectId: data.subjectId } }
}
