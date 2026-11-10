// Firma y verificación de la cookie de sesión y del PIN. Puro (node:crypto),
// sin dependencias de Next: lo usan lib/auth.ts, los scripts y los tests.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'campus_session'
export const GUEST_COOKIE = 'campus_guest'
/** 30 días. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export type Role = 'profesor' | 'alumno'

export interface Session {
  personId: string
  role: Role
}

export interface SessionPayload extends Session {
  /** emitida (epoch s) */
  iat: number
  /** vence (epoch s) */
  exp: number
  /** people.session_version al emitirla: si cambió (logout, reset de PIN), la sesión deja de valer. */
  v?: number
}

function secret(explicit?: string): string {
  const s = explicit ?? process.env.SESSION_SECRET
  if (!s) throw new Error('Falta SESSION_SECRET')
  return s
}

const b64url = (buf: Buffer) => buf.toString('base64url')

function mac(data: string, key: string): string {
  return b64url(createHmac('sha256', key).update(data).digest())
}

/** Token `<payload base64url>.<hmac base64url>`. */
export function signSession(session: Session & { v?: number }, opts: { ttlSeconds?: number; secret?: string; now?: number } = {}): string {
  const now = Math.floor((opts.now ?? Date.now()) / 1000)
  const payload: SessionPayload = { personId: session.personId, role: session.role, iat: now, exp: now + (opts.ttlSeconds ?? SESSION_TTL_SECONDS), v: session.v ?? 0 }
  const data = b64url(Buffer.from(JSON.stringify(payload)))
  return `${data}.${mac(data, secret(opts.secret))}`
}

/** Devuelve la sesión si la firma es válida y no venció; si no, null. */
export function verifySessionToken(token: string | undefined | null, opts: { secret?: string; now?: number } = {}): SessionPayload | null {
  if (!token) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = Buffer.from(mac(data, secret(opts.secret)))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload
    const now = Math.floor((opts.now ?? Date.now()) / 1000)
    if (typeof payload.personId !== 'string' || (payload.role !== 'profesor' && payload.role !== 'alumno')) return null
    if (typeof payload.exp !== 'number' || payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Para tests: el header Cookie listo para forjar una sesión.
 * `fetch(url, { headers: { cookie: forgeSessionCookie(personId, 'alumno') } })`
 */
export function forgeSessionCookie(personId: string, role: Role, opts: { secret?: string } = {}): string {
  return `${SESSION_COOKIE}=${signSession({ personId, role }, opts)}`
}

/* ---------- código de primer ingreso del alumno ---------- */

const SETUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Código de 6 caracteres que el profesor le da a cada alumno para su primer
 * ingreso (o después de resetearle el PIN). Se deriva con HMAC de
 * SESSION_SECRET + persona + session_version: no se guarda en la DB y cambia
 * con cada reset.
 */
export function pinSetupCode(personId: string, version: number, opts: { secret?: string } = {}): string {
  const digest = createHmac('sha256', secret(opts.secret)).update(`pin-setup:${personId}:${version}`).digest()
  let out = ''
  for (let i = 0; i < 6; i++) out += SETUP_ALPHABET[digest[i] % SETUP_ALPHABET.length]
  return out
}

/** Normaliza lo que tipea el alumno: mayúsculas, sin espacios ni guiones. */
export function normalizeSetupCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

/* ---------- PIN del alumno (scrypt) ---------- */

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

/** `scrypt$<salt hex>$<hash hex>` */
export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}
