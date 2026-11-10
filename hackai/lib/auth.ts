/* compat: imita lib/auth.ts de campus según campus/docs/CONTRACTS.md.
   Diferencia con el real: acá getSession() solo verifica la firma de la cookie;
   en campus además verifica persona, rol y session_version en la base.
   No se porta. */
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken, type Role, type Session } from '@/lib/session-token'

export type { Role, Session }

export function homeFor(role: Role): string {
  return role === 'profesor' ? '/profesor' : '/campus'
}

export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies()
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value)
})

/** Redirige a `/` si no hay sesión y a la home del rol si el rol no coincide. */
export async function requireSession(role?: Role): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/')
  if (role && session.role !== role) redirect(homeFor(session.role))
  return session
}
