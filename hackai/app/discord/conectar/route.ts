/* «Conectar con Discord»: firma un `state` de un solo uso con la persona, el espacio y la materia, deja su
   nonce en una cookie y lleva a la página de autorización de Discord, donde el docente elige su servidor y
   agrega el bot. Vuelve por /discord/vuelta. Quién puede conectar lo decide Espacios al volver; el botón solo
   se le muestra al docente que gestiona el espacio. */
import { redirect } from 'next/navigation'
import { backToSpace, redirectUriFor } from '@/app/discord/redirect-uri'
import { requireSession, setServerCookie } from '@/lib/auth'
import { system } from '@/lib/composition'
import { createOAuthState, OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE } from '@/lib/oauth-state'

/** Ids de espacio y de materia: sin barras ni nada que cambie la ruta de vuelta. */
const ID = /^[\w-]{1,100}$/

export async function GET(request: Request) {
  const session = await requireSession()
  const params = new URL(request.url).searchParams
  const spaceId = params.get('espacio') ?? ''
  const subjectId = params.get('materia') ?? ''
  if (!ID.test(spaceId) || !ID.test(subjectId)) redirect('/materias')

  const { discordOAuth } = system()
  const secret = process.env.SESSION_SECRET
  if (!discordOAuth || !secret) redirect(backToSpace(subjectId, 'no-configurado'))

  const { state, nonce } = createOAuthState(secret, { personId: session.personId, spaceId, subjectId }, Date.now())
  await setServerCookie(OAUTH_STATE_COOKIE, nonce, OAUTH_STATE_MAX_AGE)
  redirect(discordOAuth.authorizeUrl(state, redirectUriFor(request)))
}
