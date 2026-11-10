import 'server-only'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from './db'
import { PERSON_PUBLIC_COLUMNS, type Person } from './db-types'
import {
  GUEST_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionToken,
  type Role, type Session,
} from './session-token'

export { hashPin, verifyPin, isValidPin, forgeSessionCookie, pinSetupCode, normalizeSetupCode, SESSION_COOKIE, GUEST_COOKIE } from './session-token'
export type { Role, Session } from './session-token'

/** Home de cada rol. */
export function homeFor(role: Role): string {
  return role === 'profesor' ? '/profesor' : '/campus'
}

/**
 * Sesión de la cookie `campus_session` (firmada con HMAC), o null.
 * Además de la firma y el vencimiento, verifica contra la DB que la persona
 * exista, conserve el rol y que la sesión no haya sido revocada
 * (people.session_version: sube con logout y con el reset de PIN).
 * Se memoiza por request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies()
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!payload) return null
  const { data, error } = await db().from('people').select('role, session_version').eq('id', payload.personId).maybeSingle()
  if (error) {
    // la DB no responde: no echamos a nadie en plena clase por eso
    console.error('[auth] session check', error.message)
    return { personId: payload.personId, role: payload.role }
  }
  if (!data || data.role !== payload.role) return null
  if (Number(data.session_version ?? 0) !== Number(payload.v ?? 0)) return null
  return { personId: payload.personId, role: payload.role }
})

/** Revoca todas las sesiones de una persona (logout, reset de PIN). */
export async function bumpSessionVersion(personId: string): Promise<number> {
  const { data } = await db().from('people').select('session_version').eq('id', personId).maybeSingle()
  const next = Number(data?.session_version ?? 0) + 1
  await db().from('people').update({ session_version: next }).eq('id', personId)
  return next
}

/**
 * Exige sesión (y rol, si se pasa). Sin sesión redirige a '/'. Con otro rol
 * redirige a la home de su rol. Usalo arriba de cada page/action protegida.
 */
export async function requireSession(role?: Role): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/')
  if (role && session.role !== role) redirect(homeFor(session.role))
  return session
}

/** La persona logueada (sin pin_hash), o null. */
export async function getCurrentPerson(): Promise<Person | null> {
  const session = await getSession()
  if (!session) return null
  const { data } = await db().from('people').select(PERSON_PUBLIC_COLUMNS).eq('id', session.personId).maybeSingle()
  return (data as Person | null) ?? null
}

/** requireSession + la fila de people. Si la persona ya no existe, vuelve al ingreso. */
export async function requirePerson(role?: Role): Promise<{ session: Session; person: Person }> {
  const session = await requireSession(role)
  const { data } = await db().from('people').select(PERSON_PUBLIC_COLUMNS).eq('id', session.personId).maybeSingle()
  if (!data) redirect('/salir')
  return { session, person: data as Person }
}

/** Fija la cookie de sesión. Solo en server actions o route handlers. `v` = people.session_version vigente. */
export async function setSessionCookie(session: Session & { v?: number }): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, signSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

/** Borra la cookie de sesión. Solo en server actions o route handlers. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** uuid del invitado (cookie `campus_guest`), o null si nunca respondió. */
export async function getGuestKey(): Promise<string | null> {
  const store = await cookies()
  const v = store.get(GUEST_COOKIE)?.value
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null
}

/** Devuelve el uuid del invitado y lo crea si no existe. Solo en server actions o route handlers. */
export async function ensureGuestKey(): Promise<string> {
  const existing = await getGuestKey()
  if (existing) return existing
  const key = randomUUID()
  const store = await cookies()
  store.set(GUEST_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  return key
}
