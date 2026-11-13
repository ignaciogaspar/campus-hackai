/* Sesión: una cookie firmada con la persona y su rol. La abre el ingreso
   (app/actions/session.ts) cuando Personas dice quién entra, y getSession()
   solo verifica la firma: no consulta ningún sistema. */
import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { system } from '@/lib/composition'
import type { Role } from '@/lib/core/people'
import { homeFor } from '@/lib/home'
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type Session,
  verifySessionToken
} from '@/lib/session-token'
import { openSiuSession, SIU_SESSION_COOKIE } from '@/lib/siu-session'

export { homeFor }

export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies()
  const session = verifySessionToken(jar.get(SESSION_COOKIE)?.value)
  if (!session) return null
  // Quien entró con su cuenta real del SIU trae su sesión del SIU cifrada en otra cookie: con ella se arma su
  // cuenta en este proceso. Sin esa cookie, o si es de otra persona, no hay sesión.
  const key = session.personId.match(/^p-siu-([a-f0-9]{12})$/)?.[1]
  if (!key) return session
  const siu = openSiuSession(jar.get(SIU_SESSION_COOKIE)?.value)
  const live = system().siuLive
  if (!siu || siu.key !== key || !live?.canConnect) return null
  live.connect(siu.key, siu.session)
  return session
})

/** Redirige a `/` si no hay sesión y a la home del rol si el rol no coincide. */
export async function requireSession(role?: Role): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/')
  if (role && session.role !== role) redirect(homeFor(session.role))
  return session
}

/** Guarda una cookie solo para el servidor. Solo desde una server action o un
    route handler. Va marcada `Secure` cuando el pedido llegó por HTTPS, que
    detrás del hosting se sabe por `x-forwarded-proto`. Así también se puede
    entrar con la imagen de producción en http://localhost. */
export async function setServerCookie(name: string, value: string, maxAge: number): Promise<void> {
  const [jar, incoming] = await Promise.all([cookies(), headers()])
  jar.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: incoming.get('x-forwarded-proto')?.split(',')[0].trim() === 'https',
    path: '/',
    maxAge
  })
}

/** Abre la sesión de la persona. Solo desde una server action o un route handler. */
export async function startSession(session: Session): Promise<void> {
  await setServerCookie(SESSION_COOKIE, createSessionToken(session), SESSION_MAX_AGE)
}

/** Cierra la sesión, y con ella la del SIU que haya traído. Solo desde una server action o un route handler. */
export async function endSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  jar.delete(SIU_SESSION_COOKIE)
}
