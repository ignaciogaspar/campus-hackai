/* La vuelta de la autorización de Discord. Vale solo si su `state` es el que firmó /discord/conectar para
   esta persona, con el nonce de su cookie, sin vencer y sin usarse antes (lib/oauth-state.ts): una vuelta que
   no empezó en HackAI se rechaza sin hablar con Discord. Si vale, canjea el código, y Espacios conecta el
   espacio con el servidor y vincula la cuenta de Discord con la persona. Siempre vuelve al espacio con un
   aviso en `?discord=`, salga bien o mal. */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { backToSpace, redirectUriFor } from '@/app/discord/redirect-uri'
import { getSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { consumeOAuthState, OAUTH_STATE_COOKIE } from '@/lib/oauth-state'

/** Los nonces ya usados en este proceso. En `globalThis` por lo mismo que `system()`: Next.js puede cargar
    esta ruta en más de una capa. La cookie se borra al volver, así que en otra instancia tampoco se repite. */
const holder = globalThis as typeof globalThis & { __hackaiUsedOAuthStates?: Set<string> }
holder.__hackaiUsedOAuthStates ??= new Set()
const used = holder.__hackaiUsedOAuthStates

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) redirect('/')
  const params = new URL(request.url).searchParams
  const jar = await cookies()
  const nonce = jar.get(OAUTH_STATE_COOKIE)?.value ?? null
  jar.delete(OAUTH_STATE_COOKIE)

  const secret = process.env.SESSION_SECRET ?? ''
  const checked = consumeOAuthState(secret, params.get('state'), {
    personId: session.personId,
    nonce,
    now: Date.now(),
    used
  })
  if (!checked.ok) redirect('/discord/rechazado')
  const { spaceId, subjectId } = checked.value

  const { discordOAuth, spaces } = system()
  if (!discordOAuth) redirect(backToSpace(subjectId, 'no-configurado'))
  // Cancelar en Discord vuelve con `error=access_denied` y sin código.
  const code = params.get('code')
  if (!code) redirect(backToSpace(subjectId, params.get('error') === 'access_denied' ? 'cancelado' : 'falla-externa'))

  const authorized = await discordOAuth.exchange(code, redirectUriFor(request))
  if (!authorized.ok) redirect(backToSpace(subjectId, authorized.error))
  const { userId, serverId } = authorized.value
  const connected = await spaces.connect(session.personId, spaceId, { system: 'discord', serverId }, userId)
  if (!connected.ok)
    redirect(backToSpace(subjectId, connected.error === 'sin-acceso' ? 'solo-docentes' : connected.error))
  redirect(backToSpace(subjectId, 'conectado'))
}
