/* Sesión: una cookie firmada con la persona y su rol. La abre el ingreso
   (app/actions/session.ts) cuando Personas dice quién entra, y getSession()
   solo verifica la firma: no consulta ningún sistema. */
import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { CAMPUS_SESSION_COOKIE, campusSessionOf } from '@/lib/campus-session'
import { system } from '@/lib/composition'
import type { Role } from '@/lib/core/people'
import { homeFor } from '@/lib/home'
import { REQUESTED_PATH_HEADER, signInFor, siuReentryFor } from '@/lib/return-to'
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type Session,
  verifySessionToken
} from '@/lib/session-token'
import { SIU_SESSION_COOKIE, siuSessionOf } from '@/lib/siu-session'

export { homeFor }

/** La sesión de quien pide, `vencida` si es de una cuenta real cuya sesión del SIU venció (falta su cookie o el SIU
    ya no la reconoce), o `null` si no hay sesión. */
export const readSession = cache(async (): Promise<Session | 'vencida' | null> => {
  const jar = await cookies()
  const session = verifySessionToken(jar.get(SESSION_COOKIE)?.value)
  if (!session) return null
  // Quien entró con su cuenta real del SIU trae su sesión del SIU cifrada en otra cookie: con ella se arma su
  // cuenta en este proceso. Sin esa cookie, o si es de otra persona, no hay sesión.
  const siu = siuSessionOf(session.personId, jar.get(SIU_SESSION_COOKIE)?.value)
  if (siu === 'demo') return session
  const live = system().siuLive
  if (!live?.canConnect) return null
  if (!siu) return 'vencida'
  live.connect(siu.key, siu.session)
  // El SIU no renueva la sesión por su cuenta (lib/adapters/siu-real): si ya no la reconoce, hay que volver a entrar.
  // Se pregunta antes de dibujar, así la pantalla no queda con errores de lectura. La lectura queda guardada unos
  // segundos y la reusa la pantalla, así que no suma pedidos al SIU.
  if (await live.expired(session.personId)) return 'vencida'
  // Si conectó su Campus, el token viaja en otra cookie (ADR 0010): con él se arma su aula en este proceso.
  const campus = campusSessionOf(siu.key, jar.get(CAMPUS_SESSION_COOKIE)?.value)
  if (campus) system().campusLive?.connect(campus.key, campus.token)
  return session
})

export const getSession = cache(async (): Promise<Session | null> => {
  const session = await readSession()
  return session === 'vencida' ? null : session
})

/** La sesión para una ruta de la API que usa la pantalla abierta, o la respuesta `401` que manda a volver a entrar:
    `sesion-vencida` si venció la sesión del SIU de una cuenta real (components/siu/siu-live.tsx), `sin-sesion` si
    no hay sesión. */
export async function apiSession(): Promise<Session | Response> {
  const session = await readSession()
  if (session && session !== 'vencida') return session
  return Response.json({ error: session === 'vencida' ? 'sesion-vencida' : 'sin-sesion' }, { status: 401 })
}

/** Redirige al ingreso si no hay sesión, con la ruta pedida en `?next=` para volver ahí después de entrar
    (middleware.ts), y a la home del rol si el rol no coincide. Si venció la sesión del SIU de una cuenta real, a
    volver a entrar con el SIU, que con la extensión reingresa solo. */
export async function requireSession(role?: Role): Promise<Session> {
  const session = await readSession()
  if (!session || session === 'vencida') {
    const path = (await headers()).get(REQUESTED_PATH_HEADER)
    redirect(session === 'vencida' ? siuReentryFor(path) : signInFor(path))
  }
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

/** Cierra la sesión, y con ella la del SIU y el Campus que haya traído. Solo desde una server action o un route
    handler. */
export async function endSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  jar.delete(SIU_SESSION_COOKIE)
  jar.delete(CAMPUS_SESSION_COOKIE)
}
