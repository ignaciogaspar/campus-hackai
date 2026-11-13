'use server'
/* Conectar el Campus Virtual de quien entró con su cuenta real del SIU (ADR
   0010): pega su sesión del Campus, HackAI la canjea por el token de su app
   móvil, prueba que lea y guarda solo el token, cifrado en una cookie de su
   navegador (lib/campus-session.ts). La sesión del Campus no se guarda, y ni
   la sesión ni el token van a la base ni a los logs. */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ConnectState } from '@/components/session/siu-connect-state'
import { getSession, homeFor, setServerCookie } from '@/lib/auth'
import {
  CAMPUS_SESSION_COOKIE,
  CAMPUS_SESSION_MAX_AGE,
  moodleSessionFromInput,
  sealCampusSession
} from '@/lib/campus-session'
import { system } from '@/lib/composition'
import { isMobileUserAgent } from '@/lib/device'
import { safeReturnTo } from '@/lib/return-to'
import { realKeyOf } from '@/lib/siu-session'

export async function connectCampusAction(_previous: ConnectState, form: FormData): Promise<ConnectState> {
  if (isMobileUserAgent((await headers()).get('user-agent')))
    return { kind: 'error', message: 'El Campus se conecta desde una compu.' }
  const session = await getSession()
  const key = session ? realKeyOf(session.personId) : null
  const live = system().campusLive
  if (!session || !key || !live)
    return { kind: 'error', message: 'Conectar el Campus es para quien entró con su cuenta real del SIU.' }
  if (form.get('consent') !== 'si')
    return { kind: 'error', message: 'Para conectar el Campus tenés que aceptar cómo lo usamos.' }
  const moodleSession = moodleSessionFromInput(form.get('session'))
  if (!moodleSession)
    return { kind: 'error', message: 'Eso no parece una sesión del Campus. Copiá solo el valor de la cookie.' }

  const token = await live.signIn(key, moodleSession)
  if (!token.ok)
    return {
      kind: 'error',
      message:
        token.error === 'sesion-invalida'
          ? 'El Campus no reconoció esa sesión: puede haber vencido. Volvé a entrar al Campus y copiá la cookie de nuevo.'
          : 'El Campus no respondió o no dejó leer tus cursos. Probá de nuevo en un rato.'
    }

  await setServerCookie(CAMPUS_SESSION_COOKIE, sealCampusSession({ key, token: token.value }), CAMPUS_SESSION_MAX_AGE)
  redirect(safeReturnTo(form.get('next')) ?? homeFor(session.role))
}
