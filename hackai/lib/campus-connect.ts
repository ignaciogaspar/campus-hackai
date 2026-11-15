/* Canjea la sesión del Campus de una cuenta real por el token de su app y lo deja cifrado en la cookie de su
   navegador (ADR 0010). Lo usan conectar el Campus y entrar con el SIU cuando la extensión trae las dos sesiones
   (ADR 0011). La sesión del Campus no se guarda. */
import 'server-only'
import { setServerCookie } from '@/lib/auth'
import { CAMPUS_SESSION_COOKIE, CAMPUS_SESSION_MAX_AGE, sealCampusSession } from '@/lib/campus-session'
import { system } from '@/lib/composition'

export type CampusConnectOutcome = 'conectado' | 'no-disponible' | 'sesion-invalida' | 'sin-respuesta'

export async function connectCampus(key: string, moodleSession: string): Promise<CampusConnectOutcome> {
  const live = system().campusLive
  if (!live) return 'no-disponible'
  const token = await live.signIn(key, moodleSession)
  if (!token.ok) return token.error === 'sesion-invalida' ? 'sesion-invalida' : 'sin-respuesta'
  await setServerCookie(CAMPUS_SESSION_COOKIE, sealCampusSession({ key, token: token.value }), CAMPUS_SESSION_MAX_AGE)
  return 'conectado'
}
