'use server'
/* Entrar con la cuenta real del SIU: quien entra pega su sesión del SIU, HackAI
   la valida contra el SIU, reconoce a la persona y abre su sesión. La sesión
   del SIU queda cifrada en una cookie de su navegador (lib/siu-session.ts),
   nunca en la base ni en logs. ADR 0009. Si la extensión trajo también la sesión del Campus (ADR 0011), lo
   conecta en el mismo paso; si no, o si el Campus no la reconoce, ofrece conectarlo después. Al volver a entrar
   porque venció la sesión del SIU, vuelve a la pantalla donde estaba (`next`), y si su Campus sigue conectado no lo
   pide de nuevo. */
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ConnectState } from '@/components/session/siu-connect-state'
import { homeFor, setServerCookie, startSession } from '@/lib/auth'
import { connectCampus } from '@/lib/campus-connect'
import { CAMPUS_SESSION_COOKIE, campusSessionOf, moodleSessionFromInput } from '@/lib/campus-session'
import { system } from '@/lib/composition'
import { isMobileUserAgent } from '@/lib/device'
import { safeReturnTo } from '@/lib/return-to'
import { hasSessionSecret } from '@/lib/session-token'
import { SIU_SESSION_COOKIE, SIU_SESSION_MAX_AGE, sealSiuSession, siuSessionFromInput } from '@/lib/siu-session'

export async function connectSiuAction(_previous: ConnectState, form: FormData): Promise<ConnectState> {
  if (isMobileUserAgent((await headers()).get('user-agent')))
    return { kind: 'error', message: 'Las cuentas reales del SIU se usan desde una compu.' }
  if (form.get('consent') !== 'si')
    return { kind: 'error', message: 'Para entrar con tu cuenta tenés que aceptar cómo usamos tu sesión del SIU.' }
  const session = siuSessionFromInput(form.get('session'))
  if (!session) return { kind: 'error', message: 'Eso no parece una sesión del SIU. Copiá solo el valor de la cookie.' }
  const live = system().siuLive
  if (!live?.canConnect || !hasSessionSecret())
    return { kind: 'error', message: 'Entrar con la cuenta del SIU no está disponible en este HackAI.' }

  const who = await live.signIn(session)
  if (!who)
    return {
      kind: 'error',
      message: 'El SIU no reconoció esa sesión: puede haber vencido. Volvé a entrar al SIU y copiá la cookie de nuevo.'
    }
  // Leer su SIU antes de abrir la sesión: si no se puede, mejor decirlo acá que en una pantalla vacía.
  const person = await system().people.get(who.personId)
  if (!person.ok)
    return { kind: 'error', message: 'Entramos al SIU, pero no pudimos leer tus datos. Probá de nuevo en un rato.' }

  await setServerCookie(SIU_SESSION_COOKIE, sealSiuSession({ key: who.key, session }), SIU_SESSION_MAX_AGE)
  await startSession({ personId: who.personId, role: 'alumno' })
  const home = safeReturnTo(form.get('next')) ?? homeFor('alumno')
  if (!system().campusLive) redirect(home)
  const moodleSession = moodleSessionFromInput(form.get('campusSession'))
  if (moodleSession && (await connectCampus(who.key, moodleSession)) === 'conectado') redirect(home)
  if (campusSessionOf(who.key, (await cookies()).get(CAMPUS_SESSION_COOKIE)?.value)) redirect(home)
  // El segundo paso, que se puede saltear: conectar el Campus Virtual (ADR 0010).
  redirect('/conectar-campus')
}
