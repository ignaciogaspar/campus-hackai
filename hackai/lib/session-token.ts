import { createHmac, timingSafeEqual } from 'node:crypto'

export type Role = 'alumno' | 'profesor'
export type Session = { personId: string; role: Role }

export const SESSION_COOKIE = 'hackai_session'

const THIRTY_DAYS = 60 * 60 * 24 * 30

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('Falta SESSION_SECRET')
  return value
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
    if (data.role !== 'alumno' && data.role !== 'profesor') return null
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
    return { personId: data.personId, role: data.role }
  } catch {
    return null
  }
}

/** Para tests y desarrollo: 'hackai_session=<token>'. Necesita SESSION_SECRET. */
export function forgeSessionCookie(personId: string, role: Role): string {
  const iat = Math.floor(Date.now() / 1000)
  const body = Buffer.from(JSON.stringify({ personId, role, iat, exp: iat + THIRTY_DAYS })).toString('base64url')
  return `${SESSION_COOKIE}=${body}.${sign(body)}`
}
