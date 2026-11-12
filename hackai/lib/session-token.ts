import { createHmac, timingSafeEqual } from 'node:crypto'
import { isRole, type Role } from '@/lib/core/people'

export type Session = { personId: string; role: Role }

export const SESSION_COOKIE = 'hackai_session'

/** Cuánto dura una sesión, en segundos: 30 días. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('Falta SESSION_SECRET')
  return value
}

/** Si está la clave que firma las sesiones. Sin ella no se puede abrir ninguna. */
export function hasSessionSecret(): boolean {
  return Boolean(process.env.SESSION_SECRET)
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

/** Devuelve la sesión si el token está bien firmado y no venció. */
export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null
  const [body, mac, extra] = token.split('.')
  if (!body || !mac || extra !== undefined) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data.personId !== 'string') return null
    if (!isRole(data.role)) return null
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
    return { personId: data.personId, role: data.role }
  } catch {
    return null
  }
}

/** El token firmado de una sesión que empieza ahora. Necesita SESSION_SECRET. */
export function createSessionToken({ personId, role }: Session): string {
  const iat = Math.floor(Date.now() / 1000)
  const body = Buffer.from(JSON.stringify({ personId, role, iat, exp: iat + SESSION_MAX_AGE })).toString('base64url')
  return `${body}.${sign(body)}`
}

/** Para tests y desarrollo: 'hackai_session=<token>'. Necesita SESSION_SECRET. */
export function forgeSessionCookie(personId: string, role: Role): string {
  return `${SESSION_COOKIE}=${createSessionToken({ personId, role })}`
}
