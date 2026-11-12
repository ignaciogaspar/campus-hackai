/* «Conectar con Discord» contra un Discord falso: la URL de autorización y el canje del código. Sin red. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOT_PERMISSIONS, createDiscordOAuth } from '@/lib/adapters/discord/oauth'

const CLIENT = '1569889274470334484'
const SECRET = 'secreto-que-no-se-filtra'
const REDIRECT = 'https://hackai.test/discord/vuelta'
const USER = '1290000000000000001'
const GUILD = '1300000000000000001'

type Call = { url: string; method: string; body: string | null; auth: string | null }

function fakeDiscord(overrides: { token?: () => Response; me?: () => Response } = {}) {
  const calls: Call[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? String(init.body) : null,
      auth: headers.get('Authorization')
    })
    if (url.endsWith('/oauth2/token')) {
      return (
        overrides.token?.() ??
        Response.json({ access_token: 'acceso', token_type: 'Bearer', scope: 'bot identify', guild: { id: GUILD } })
      )
    }
    if (url.endsWith('/users/@me')) return overrides.me?.() ?? Response.json({ id: USER, username: 'mledesma' })
    return new Response(null, { status: 404 })
  }
  return { fetch, calls }
}

test('la autorización pide los scopes bot e identify, los permisos del bot, la URL de vuelta y el state', () => {
  const oauth = createDiscordOAuth({ clientId: CLIENT, clientSecret: SECRET })
  const url = new URL(oauth.authorizeUrl('state-firmado', REDIRECT))
  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize')
  assert.equal(url.searchParams.get('client_id'), CLIENT)
  assert.equal(url.searchParams.get('scope'), 'bot identify')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT)
  assert.equal(url.searchParams.get('state'), 'state-firmado')
  // Ver canales, enviar mensajes, historial, hilos públicos, mensajes en hilos, gestionar canales y roles.
  assert.equal(url.searchParams.get('permissions'), '309506149392')
  assert.equal(BOT_PERMISSIONS, '309506149392')
  assert.ok(!url.toString().includes(SECRET), 'el secreto no va en la URL')
})

test('el canje devuelve la cuenta que autorizó y el servidor donde quedó el bot', async () => {
  const { fetch, calls } = fakeDiscord()
  const oauth = createDiscordOAuth({ clientId: CLIENT, clientSecret: SECRET, fetch })

  assert.deepEqual(await oauth.exchange('codigo', REDIRECT, null), {
    ok: true,
    value: { userId: USER, serverId: GUILD }
  })

  const token = new URLSearchParams(calls[0].body ?? '')
  assert.deepEqual(Object.fromEntries(token), {
    client_id: CLIENT,
    client_secret: SECRET,
    grant_type: 'authorization_code',
    code: 'codigo',
    redirect_uri: REDIRECT
  })
  assert.equal(calls[1].auth, 'Bearer acceso')
})

test('un código que Discord no acepta, una vuelta sin servidor o Discord caído vuelven como valores', async () => {
  const rejected = fakeDiscord({ token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) })
  assert.deepEqual(
    await createDiscordOAuth({ clientId: CLIENT, clientSecret: SECRET, fetch: rejected.fetch }).exchange(
      'x',
      REDIRECT,
      null
    ),
    {
      ok: false,
      error: 'codigo-invalido'
    }
  )

  const noGuild = fakeDiscord({ token: () => Response.json({ access_token: 'acceso' }) })
  const oauth = createDiscordOAuth({ clientId: CLIENT, clientSecret: SECRET, fetch: noGuild.fetch })
  assert.deepEqual(await oauth.exchange('x', REDIRECT, null), { ok: false, error: 'sin-servidor' })
  assert.deepEqual(await oauth.exchange('x', REDIRECT, GUILD), { ok: true, value: { userId: USER, serverId: GUILD } })

  const down: typeof globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  assert.deepEqual(
    await createDiscordOAuth({ clientId: CLIENT, clientSecret: SECRET, fetch: down }).exchange('x', REDIRECT, null),
    {
      ok: false,
      error: 'falla-externa'
    }
  )
})
