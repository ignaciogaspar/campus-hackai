import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { PERSON_PUBLIC_COLUMNS, type Person } from '@/lib/db-types'
import type { Role } from '@/lib/session-token'

/* Tokens Bearer del servidor MCP. En la DB (api_tokens) solo queda el sha256;
   el token en claro se muestra una única vez al crearlo. */

export const TOKEN_PREFIX = 'cmp_'

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function newToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url')
}

export interface McpCaller {
  tokenId: string
  person: Person
  role: Role
}

/** Busca el token (no revocado) y devuelve la persona dueña. Actualiza last_used_at. */
export async function resolveToken(token: string | null | undefined): Promise<McpCaller | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX) || token.length < 20 || token.length > 200) return null
  const { data: row } = await db()
    .from('api_tokens')
    .select('id, person_id, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!row || row.revoked_at) return null
  const { data: person } = await db().from('people').select(PERSON_PUBLIC_COLUMNS).eq('id', row.person_id).maybeSingle()
  if (!person) return null
  await db().from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  const p = person as Person
  return { tokenId: row.id, person: p, role: p.role }
}

/** Saca el token de `Authorization: Bearer <token>`. */
export function bearerFrom(header: string | null): string | null {
  if (!header) return null
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header)
  return m ? m[1] : null
}

export interface TokenRow {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export async function listTokens(personId: string): Promise<TokenRow[]> {
  const { data } = await db()
    .from('api_tokens')
    .select('id, label, created_at, last_used_at, revoked_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
  return (data ?? []) as TokenRow[]
}

/** Crea un token y devuelve el valor en claro (única vez que existe fuera de la DB). */
export async function createToken(personId: string, label: string): Promise<string> {
  return (await createTokenRow(personId, label)).token
}

/** Igual que createToken, pero devuelve también el id de la fila. */
export async function createTokenRow(personId: string, label: string): Promise<{ id: string; token: string }> {
  const token = newToken()
  const { data, error } = await db().from('api_tokens').insert({ person_id: personId, label, token_hash: hashToken(token) }).select('id').single()
  if (error || !data) throw new Error(`No se pudo crear el token: ${error?.message ?? 'sin fila'}`)
  return { id: data.id, token }
}

/** Revoca un token propio. Devuelve false si no es de esa persona. */
export async function revokeToken(personId: string, tokenId: string): Promise<boolean> {
  const { data } = await db()
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('person_id', personId)
    .is('revoked_at', null)
    .select('id')
  return (data ?? []).length > 0
}
