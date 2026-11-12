/* «Conectar con Discord»: la autorización OAuth2 de Discord con los scopes `bot` e `identify`, con `fetch`
   (ADR 0002). El docente elige su servidor en la página de Discord y el bot se agrega con los permisos que
   necesita; al volver, el código se canjea por un token con el que se lee su cuenta. El token no se guarda:
   alcanza con el id de la cuenta y el del servidor. Qué cargar en el Developer Portal: docs/discord.md.

   El secreto de la aplicación (`DISCORD_CLIENT_SECRET`) solo viaja en el canje, hacia la API de Discord. */
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

export type DiscordOAuthOptions = {
  /** El Application ID del Developer Portal. No es secreto. */
  clientId: string
  /** El Client Secret, de `DISCORD_CLIENT_SECRET`. Nunca se escribe en el repo ni en logs. */
  clientSecret: string
  /** Para los tests: un `fetch` con respuestas de ejemplo, sin red. */
  fetch?: typeof fetch
  timeoutMs?: number
}

/** Lo que dice Discord al volver de autorizar: quién autorizó y en qué servidor quedó el bot. */
export type DiscordAuthorization = { userId: string; serverId: string }

export type DiscordOAuth = {
  /** La página de Discord donde el docente elige el servidor y autoriza. `redirectUri` tiene que estar cargada
      en el Developer Portal, igual. */
  authorizeUrl(state: string, redirectUri: string): string
  /** Canjea el código de la vuelta. `codigo-invalido` si Discord no lo acepta (vencido, usado o de otra
      aplicación); `sin-servidor` si la respuesta no trae el servidor donde quedó el bot. El servidor sale solo de
      la respuesta de Discord, nunca del `guild_id` de la URL de vuelta, que lo puede armar quien navega. */
  exchange(
    code: string,
    redirectUri: string
  ): Promise<Result<DiscordAuthorization, 'codigo-invalido' | 'sin-servidor' | ExternalFailure>>
}

const API = 'https://discord.com/api/v10'
const AUTHORIZE = 'https://discord.com/oauth2/authorize'

/** Los permisos del bot: ver canales, enviar mensajes, leer el historial, crear hilos públicos, enviar mensajes
    en hilos, gestionar canales y gestionar roles. Los mismos que la URL de invitación de docs/discord.md. */
export const BOT_PERMISSIONS = String(
  (1n << 10n) | (1n << 11n) | (1n << 16n) | (1n << 35n) | (1n << 38n) | (1n << 4n) | (1n << 28n)
)

const SNOWFLAKE = /^\d{17,20}$/

export function createDiscordOAuth(options: DiscordOAuthOptions): DiscordOAuth {
  if (!options.clientId.trim() || !options.clientSecret.trim())
    throw new Error('Conectar con Discord necesita DISCORD_CLIENT_ID y DISCORD_CLIENT_SECRET')
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000

  async function request(url: string, init: RequestInit): Promise<Response | null> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch {
      return null
    }
  }

  async function json(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const body = await response.json()
      return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  return {
    authorizeUrl(state, redirectUri) {
      const params = new URLSearchParams({
        client_id: options.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'bot identify',
        permissions: BOT_PERMISSIONS,
        state,
        prompt: 'consent'
      })
      return `${AUTHORIZE}?${params}`
    },

    async exchange(code, redirectUri) {
      const granted = await grant(code, redirectUri)
      if (!granted.ok) return granted
      // Con el scope `bot`, la respuesta trae el servidor donde quedó el bot.
      const { serverId } = granted.value
      if (!serverId || !SNOWFLAKE.test(serverId)) return fail('sin-servidor')
      const userId = await accountOf(granted.value.accessToken)
      return userId ? ok({ userId, serverId }) : fail('falla-externa')
    }
  }

  /** Canjea el código por un token de acceso, con el servidor donde quedó el bot si Discord lo dice. */
  async function grant(
    code: string,
    redirectUri: string
  ): Promise<Result<{ accessToken: string; serverId: string | null }, 'codigo-invalido' | ExternalFailure>> {
    const token = await request(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    })
    if (!token || token.status >= 500) return fail('falla-externa')
    if (!token.ok) return fail('codigo-invalido')
    const body = await json(token)
    const accessToken = body?.access_token
    if (typeof accessToken !== 'string') return fail('falla-externa')
    const guild = body?.guild as { id?: unknown } | undefined
    return ok({ accessToken, serverId: typeof guild?.id === 'string' ? guild.id : null })
  }

  /** El id de la cuenta de Discord del token, o `null` si Discord no responde. */
  async function accountOf(accessToken: string): Promise<string | null> {
    const me = await request(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!me?.ok) return null
    const id = (await json(me))?.id
    return typeof id === 'string' && SNOWFLAKE.test(id) ? id : null
  }
}
