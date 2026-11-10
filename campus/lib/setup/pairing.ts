import 'server-only'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { createTokenRow } from '@/lib/mcp/tokens'
import type { Role } from '@/lib/session-token'

/* Emparejamiento del instalador (migración 0180_setup_pairings.sql), estilo
   «device code» de OAuth:
   1. El script pide start: recibe deviceCode (secreto, solo lo usa él) y
      userCode (corto, lo ve el alumno).
   2. El alumno, logueado, confirma el userCode en /conectar.
   3. El script hace poll con el deviceCode y recibe, una sola vez, un token
      MCP nuevo. El token se crea en ese momento: nunca queda guardado acá. */

export const PAIRING_TTL_SECONDS = 600
export const POLL_INTERVAL_SECONDS = 3

// Sin 0/O, 1/I/L ni vocales (no arma palabras).
const ALPHABET = 'BCDFGHJKMNPQRSTVWXZ23456789'

export function hashDeviceCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

function newUserCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

/** «bcdf ghjk», «BCDFGHJK» → «BCDF-GHJK»; null si no tiene forma de código. */
export function normalizeUserCode(raw: unknown): string | null {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.length !== 8 || [...s].some((c) => !ALPHABET.includes(c))) return null
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

/** Texto libre que manda el script (hostname, SO): una línea, corto, sin controles. */
export function cleanLabel(raw: unknown, max = 80): string | null {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  return s || null
}

export interface StartedPairing {
  deviceCode: string
  userCode: string
  expiresIn: number
}

export async function startPairing(input: { hostname: string | null; os: string | null; ip: string }): Promise<StartedPairing> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const deviceCode = 'dev_' + randomBytes(32).toString('base64url')
    const userCode = newUserCode()
    const { error } = await db().from('setup_pairings').insert({
      device_hash: hashDeviceCode(deviceCode),
      user_code: userCode,
      hostname: input.hostname,
      os: input.os,
      ip: input.ip,
      expires_at: new Date(Date.now() + PAIRING_TTL_SECONDS * 1000).toISOString(),
    })
    if (!error) return { deviceCode, userCode, expiresIn: PAIRING_TTL_SECONDS }
    if (error.code !== '23505') throw new Error(`No se pudo iniciar la conexión: ${error.message}`)
    // choque de userCode con uno viejo: probar otro
  }
  throw new Error('No se pudo iniciar la conexión. Probá de nuevo.')
}

export interface PendingPairing {
  userCode: string
  hostname: string | null
  os: string | null
  createdAt: string
  expiresAt: string
  status: string
}

/** El emparejamiento de un userCode, si existe y no venció. */
export async function findPairing(userCode: string): Promise<PendingPairing | null> {
  const { data } = await db()
    .from('setup_pairings')
    .select('user_code, hostname, os, created_at, expires_at, status')
    .eq('user_code', userCode)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!data) return null
  return { userCode: data.user_code, hostname: data.hostname, os: data.os, createdAt: data.created_at, expiresAt: data.expires_at, status: data.status }
}

/** Confirma (o rechaza) un userCode pendiente a nombre de la persona logueada. */
export async function decidePairing(userCode: string, personId: string, approve: boolean): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await db()
    .from('setup_pairings')
    .update(approve ? { status: 'aprobado', person_id: personId, approved_at: now } : { status: 'rechazado' })
    .eq('user_code', userCode)
    .eq('status', 'pendiente')
    .gt('expires_at', now)
    .select('id')
  return (data ?? []).length > 0
}

export type PollResult =
  | { status: 'pendiente' | 'rechazado' | 'vencido' | 'desconocido' }
  | { status: 'ok'; token: string; role: Role; name: string }

/**
 * Lo que ve el script al preguntar. Si está aprobado, lo pasa a «entregado» en
 * un solo UPDATE condicionado (dos polls simultáneos no reciben dos tokens) y
 * recién ahí crea el token.
 */
export async function pollPairing(deviceCode: string): Promise<PollResult> {
  const hash = hashDeviceCode(deviceCode)
  const now = new Date().toISOString()
  const { data: claimed } = await db()
    .from('setup_pairings')
    .update({ status: 'entregado', delivered_at: now })
    .eq('device_hash', hash)
    .eq('status', 'aprobado')
    .gt('expires_at', now)
    .select('id, person_id, hostname')
  const row = claimed?.[0]
  if (row?.person_id) {
    const { data: person } = await db().from('people').select('full_name, role').eq('id', row.person_id).maybeSingle()
    if (!person) return { status: 'desconocido' }
    const { id, token } = await createTokenRow(row.person_id, `Claude Code · ${row.hostname ?? 'instalador'}`.slice(0, 80))
    await db().from('setup_pairings').update({ token_id: id }).eq('id', row.id)
    return { status: 'ok', token, role: person.role as Role, name: person.full_name }
  }
  const { data } = await db().from('setup_pairings').select('status, expires_at').eq('device_hash', hash).maybeSingle()
  if (!data) return { status: 'desconocido' }
  if (data.status === 'rechazado') return { status: 'rechazado' }
  // entregado ya no vuelve a dar el token
  if (data.status === 'entregado' || new Date(data.expires_at).getTime() <= Date.now()) return { status: 'vencido' }
  return { status: 'pendiente' }
}
