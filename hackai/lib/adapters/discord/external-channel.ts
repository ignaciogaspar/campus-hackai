/* Canal externo sobre la API REST v10 de Discord, sin gateway: lee consultando
   desde un cursor, publica, abre hilos, responde en ellos y baja adjuntos.
   Research:
   docs/research/2026-11-10-canales-externos-apis.md.

   - El bot necesita el intent Message Content: sin él, Discord devuelve el
     texto y los adjuntos vacíos (guía: docs/discord.md).
   - El cursor es el id (snowflake) del último mensaje leído. Como los ids son
     crecientes en todo Discord, el mismo cursor sirve para el canal y sus hilos.
   - Un hilo de Discord es un canal aparte cuyo id es el del mensaje que lo
     empezó. Sus mensajes se devuelven con el `channelId` del canal padre y ese
     id como `threadId`. Una respuesta con «Responder» (tipo REPLY) vuelve con
     el primer mensaje de su cadena como `threadId`, aunque esté en una lectura
     anterior.
   - Se leen los hilos activos y los archivados después del cursor: un hilo que
     recibió mensajes y se archivó entre dos lecturas no los pierde.
   - Ante un 429 espera el `retry_after` que pide Discord y reintenta, hasta
     `maxRetries` veces y `maxRetryAfterMs` de espera. Si pide más, devuelve
     `falla-externa` en vez de bloquear, y la próxima sincronización reintenta.
     Una caída, un tiempo agotado o un error del servidor también vuelven como
     `falla-externa`.
   - El token solo viaja en el header `Authorization` hacia la API: nunca a la
     CDN, ni en errores ni en logs. */
import type { ExternalAttachment, ExternalChannelPort, ExternalMessage } from '@/lib/ports/external-channel'
import { type ExternalFailure, fail, type Ok, ok, type Result } from '@/lib/result'

export type DiscordOptions = {
  /** Token del bot. Se lee de `DISCORD_BOT_TOKEN`; nunca se escribe en el repo. */
  token: string
  /** Para los tests: se inyecta un `fetch` con respuestas de ejemplo, sin red. */
  fetch?: typeof fetch
  /** Para los tests: esperar sin esperar. */
  sleep?: (ms: number) => Promise<void>
  /** Tiempo máximo de cada request, en milisegundos. */
  timeoutMs?: number
  /** Cuántas veces reintenta después de un 429. */
  maxRetries?: number
  /** Si Discord pide esperar más que esto, se da por caído en vez de bloquear. */
  maxRetryAfterMs?: number
}

const API = 'https://discord.com/api/v10'
const USER_AGENT = 'DiscordBot (https://github.com/ignaciogaspar/campus-hackai, 0.1.0)'
/** Hosts de la CDN de Discord: `download` no baja nada de otro lado. */
const CDN_HOSTS = ['cdn.discordapp.com', 'media.discordapp.net']
/** `limit` máximo de Get Channel Messages y de los hilos archivados. */
const PAGE_SIZE = 100
/** Páginas por fuente en una lectura; lo que sobra queda para la siguiente. */
const MAX_PAGES = 10
/** Cuántos mensajes sube, como máximo, para encontrar la raíz de una cadena de respuestas. */
const MAX_CHAIN = 20
/** Tipos de mensaje de Discord que son de personas. El resto es del sistema. */
const DEFAULT = 0
const REPLY = 19
/** Error de la API de Discord (JSON Error Codes) al abrir un hilo que ya existe. */
const THREAD_ALREADY_CREATED = 160004
/** Origen de los snowflakes de Discord: 2015-01-01 en milisegundos. */
const DISCORD_EPOCH = 1420070400000n

type DiscordUser = { id: string; username: string; global_name?: string | null; bot?: boolean }

type DiscordAttachment = {
  id: string
  filename: string
  content_type?: string
  size: number
  url: string
}

type DiscordMessage = {
  id: string
  channel_id: string
  type: number
  content: string
  timestamp: string
  author: DiscordUser
  attachments?: DiscordAttachment[]
  webhook_id?: string
  message_reference?: { message_id?: string }
  thread?: { id: string }
}

type DiscordChannel = {
  id: string
  type: number
  guild_id?: string
  parent_id?: string | null
  last_message_id?: string | null
  thread_metadata?: { archived: boolean; archive_timestamp: string }
}

type ArchivedThreads = { threads: DiscordChannel[]; has_more: boolean }

/** Un error HTTP de Discord, con su código de la API si vino en el cuerpo. */
type HttpError = { status: number; code: number | null }

/** Lo que pasó con un request: respondió bien, respondió un error, o no respondió. */
type HttpOutcome = { kind: 'ok'; response: Response } | ({ kind: 'http' } & HttpError) | { kind: 'caida' }

type ApiResult<T> = Ok<T> | { ok: false; error: HttpError }

/** Mensajes leídos de un canal o hilo. `complete` es falso si quedaron sin leer por el tope de páginas. */
type Source = { threadId: string | null; messages: DiscordMessage[]; complete: boolean }

class DiscordDown extends Error {}

export function createDiscordExternalChannel(options: DiscordOptions): ExternalChannelPort {
  if (!options.token.trim()) throw new Error('El adaptador de Discord necesita el token del bot (DISCORD_BOT_TOKEN)')

  const doFetch = options.fetch ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxRetries = options.maxRetries ?? 3
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 30_000
  /** Servidor de cada canal, para buscar sus hilos activos. */
  const guildOf = new Map<string, string | null>()
  /** Raíz de la cadena de cada mensaje ya visto (`null` si él mismo es raíz). */
  const rootOf = new Map<string, string | null>()

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 19 (máximo 15). Se refactoriza después de la demo (#30).
  async function send(url: string, init: RequestInit): Promise<HttpOutcome> {
    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      } catch {
        return { kind: 'caida' }
      }
      if (response.status === 429) {
        const wait = await retryAfterMs(response)
        if (attempt >= maxRetries || wait === null || wait > maxRetryAfterMs) return { kind: 'caida' }
        await sleep(wait)
        continue
      }
      if (response.ok) return { kind: 'ok', response }
      if (response.status >= 500) return { kind: 'caida' }
      return { kind: 'http', status: response.status, code: await numberField(response, 'code') }
    }
  }

  /** Request a la API con el token del bot. Devuelve el JSON o el error HTTP;
      una caída tira `DiscordDown`, que `guard` convierte en `falla-externa`. */
  async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { Authorization: `Bot ${options.token}`, 'User-Agent': USER_AGENT }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const outcome = await send(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (outcome.kind === 'caida') throw new DiscordDown()
    if (outcome.kind === 'http') return { ok: false, error: { status: outcome.status, code: outcome.code } }
    try {
      return ok((await outcome.response.json()) as T)
    } catch {
      throw new DiscordDown()
    }
  }

  /** Comprueba que el canal existe y recuerda su servidor. */
  async function channelGuild(channelId: string): Promise<Result<string | null, 'canal-inexistente'>> {
    if (guildOf.has(channelId)) return ok(guildOf.get(channelId)!)
    const channel = orNotFound(await api<DiscordChannel>('GET', `/channels/${channelId}`), 'canal-inexistente')
    if (!channel.ok) return channel
    guildOf.set(channelId, channel.value.guild_id ?? null)
    return ok(channel.value.guild_id ?? null)
  }

  /** Mensajes de un canal (o hilo) posteriores a `after`, del más viejo al más nuevo. */
  async function readAfter(channelId: string, after: string | null, threadId: string | null): Promise<Source> {
    const messages: DiscordMessage[] = []
    let from = after ?? '0'
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = must(
        await api<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=${PAGE_SIZE}&after=${from}`)
      ).sort(byId)
      messages.push(...batch)
      if (batch.length < PAGE_SIZE) return { threadId, messages, complete: true }
      from = batch.at(-1)!.id
    }
    return { threadId, messages, complete: false }
  }

  /** Hilos del canal con mensajes posteriores al cursor: los activos y los
      archivados después del cursor, que ya no figuran entre los activos. */
  async function threadsWithNews(guildId: string, channelId: string, cursor: string | null): Promise<string[]> {
    const { threads: active } = must(
      await api<{ threads: DiscordChannel[] }>('GET', `/guilds/${guildId}/threads/active`)
    )
    const archived: DiscordChannel[] = []
    const since = cursor === null ? null : snowflakeTime(cursor)
    let before: string | null = null
    for (let page = 0; page < MAX_PAGES; page++) {
      const query: string = `?limit=${PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      const res: ArchivedThreads = must(
        await api<ArchivedThreads>('GET', `/channels/${channelId}/threads/archived/public${query}`)
      )
      archived.push(...res.threads)
      const last: string | undefined = res.threads.at(-1)?.thread_metadata?.archive_timestamp
      if (!res.has_more || !last || (since !== null && Date.parse(last) < since)) break
      before = last
    }
    const withNews = (t: DiscordChannel) =>
      t.parent_id === channelId &&
      (cursor === null || (t.last_message_id != null && BigInt(t.last_message_id) > BigInt(cursor)))
    return [...new Set([...active, ...archived].filter(withNews).map((t) => t.id))]
  }

  /** Primer mensaje de la cadena de respuestas a la que pertenece `messageId`.
      Sube por `message_reference` pidiendo a Discord los que no vio en esta lectura. */
  async function chainRoot(channelId: string, messageId: string): Promise<string> {
    let current = messageId
    for (let depth = 0; depth < MAX_CHAIN; depth++) {
      if (rootOf.has(current)) return rootOf.get(current) ?? current
      const res = await api<DiscordMessage>('GET', `/channels/${channelId}/messages/${current}`)
      if (!res.ok && res.error.status === 404) return current
      const parent = repliesTo(must(res))
      if (!parent) {
        rootOf.set(current, null)
        return current
      }
      current = parent
    }
    return current
  }

  /** Abre el hilo sobre el mensaje si todavía no tiene uno. Un hilo que otro
      abrió recién (`THREAD_ALREADY_CREATED`) también sirve. */
  async function ensureThread(
    channelId: string,
    messageId: string
  ): Promise<Result<null, 'canal-inexistente' | 'mensaje-inexistente'>> {
    const guild = await channelGuild(channelId)
    if (!guild.ok) return guild
    const root = orNotFound(
      await api<DiscordMessage>('GET', `/channels/${channelId}/messages/${messageId}`),
      'mensaje-inexistente'
    )
    if (!root.ok) return root
    if (root.value.thread) return ok(null)
    const created = await api<DiscordChannel>('POST', `/channels/${channelId}/messages/${messageId}/threads`, {
      name: threadName(root.value.content),
      auto_archive_duration: 10080
    })
    if (!created.ok && created.error.code !== THREAD_ALREADY_CREATED) throw new DiscordDown()
    return ok(null)
  }

  return {
    capabilities: { delivery: 'cursor', threads: true },

    read: (channelId, cursor) =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 39 (máximo 15). Se refactoriza después de la demo (#30).
      guard(async () => {
        const guild = await channelGuild(channelId)
        if (!guild.ok) return guild

        const sources = [await readAfter(channelId, cursor, null)]
        if (guild.value) {
          for (const threadId of await threadsWithNews(guild.value, channelId, cursor)) {
            sources.push(await readAfter(threadId, cursor, threadId))
          }
        }

        // Si una fuente quedó cortada, el cursor no puede pasar su último mensaje leído.
        const limit = sources
          .filter((s) => !s.complete)
          .map((s) => BigInt(s.messages.at(-1)!.id))
          .reduce<bigint | null>((min, id) => (min === null || id < min ? id : min), null)

        const messages: ExternalMessage[] = []
        for (const source of sources) {
          for (const raw of source.messages) {
            if (limit !== null && BigInt(raw.id) > limit) continue
            if (raw.type !== DEFAULT && raw.type !== REPLY) continue
            const parent = repliesTo(raw)
            const thread = source.threadId ?? (parent ? await chainRoot(channelId, parent) : null)
            rootOf.set(raw.id, thread)
            messages.push(toMessage(raw, channelId, thread))
          }
        }
        messages.sort(byId)
        return ok({ messages, cursor: messages.at(-1)?.id ?? (limit !== null ? String(limit) : cursor) })
      }),

    post: (channelId, text) =>
      guard(async () => {
        const posted = orNotFound(
          await api<DiscordMessage>('POST', `/channels/${channelId}/messages`, createMessageBody(text)),
          'canal-inexistente'
        )
        return posted.ok ? ok(toMessage(posted.value, channelId, null)) : posted
      }),

    reply: (channelId, threadId, text) =>
      guard(async () => {
        const thread = await ensureThread(channelId, threadId)
        if (!thread.ok) return thread

        const posted = must(
          await api<DiscordMessage>('POST', `/channels/${threadId}/messages`, createMessageBody(text))
        )
        rootOf.set(posted.id, threadId)
        return ok(toMessage(posted, channelId, threadId))
      }),

    openThread: (channelId, messageId) =>
      guard(async () => {
        const thread = await ensureThread(channelId, messageId)
        return thread.ok ? ok(null) : thread
      }),

    download: (attachment) =>
      guard(async () => {
        if (!isDiscordCdn(attachment.url)) return fail('falla-externa')
        const outcome = await send(attachment.url, { method: 'GET', headers: { 'User-Agent': USER_AGENT } })
        if (outcome.kind === 'caida') return fail('falla-externa')
        if (outcome.kind === 'http')
          return fail([403, 404, 410].includes(outcome.status) ? 'adjunto-vencido' : 'falla-externa')
        const bytes = new Uint8Array(await outcome.response.arrayBuffer())
        return ok({ filename: attachment.filename, contentType: attachment.contentType, bytes })
      })
  }
}

/** Una caída o una respuesta con forma inesperada vuelven como `falla-externa`, no como excepción. */
async function guard<T, E extends string>(run: () => Promise<Result<T, E>>): Promise<Result<T, E | ExternalFailure>> {
  try {
    return await run()
  } catch {
    return fail('falla-externa')
  }
}

/** El cuerpo de una respuesta que tuvo que salir bien; cualquier error es una caída. */
function must<T>(res: ApiResult<T>): T {
  if (res.ok) return res.value
  throw new DiscordDown()
}

/** Un 404 es el error del dominio que corresponde; cualquier otro error es una caída. */
function orNotFound<T, E extends string>(res: ApiResult<T>, notFound: E): Result<T, E> {
  if (res.ok) return res
  if (res.error.status === 404) return fail(notFound)
  throw new DiscordDown()
}

/** Mensaje al que responde, si es una respuesta. Un reenvío también trae
    `message_reference`, pero es de tipo DEFAULT y no forma cadena. */
function repliesTo(raw: DiscordMessage): string | null {
  return raw.type === REPLY ? (raw.message_reference?.message_id ?? null) : null
}

function toMessage(raw: DiscordMessage, channelId: string, threadId: string | null): ExternalMessage {
  const viaWebhook = raw.webhook_id != null
  return {
    id: raw.id,
    channelId,
    author: {
      id: raw.author.id,
      name: raw.author.global_name || raw.author.username,
      isBot: raw.author.bot === true || viaWebhook
    },
    text: raw.content,
    attachments: (raw.attachments ?? []).map(toAttachment),
    threadId,
    viaWebhook,
    createdAt: new Date(raw.timestamp).toISOString()
  }
}

function toAttachment(raw: DiscordAttachment): ExternalAttachment {
  return {
    id: raw.id,
    filename: raw.filename,
    contentType: raw.content_type ?? 'application/octet-stream',
    size: raw.size,
    url: raw.url
  }
}

/** Cuerpo de Create Message. Sin menciones: un texto de HackAI no notifica a
    nadie por arroba (pregunta abierta 12 de docs/product/preguntas-abiertas.md). */
function createMessageBody(text: string) {
  return { content: text, allowed_mentions: { parse: [] } }
}

/** Nombre del hilo: la primera línea del mensaje, hasta 100 caracteres. */
function threadName(content: string): string {
  const firstLine = content.trim().split('\n')[0].trim()
  return (firstLine || 'Consulta').slice(0, 100)
}

function byId(a: { id: string }, b: { id: string }): number {
  const x = BigInt(a.id)
  const y = BigInt(b.id)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Momento en que se creó un snowflake, en milisegundos. */
function snowflakeTime(id: string): number {
  return Number((BigInt(id) >> 22n) + DISCORD_EPOCH)
}

function isDiscordCdn(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && CDN_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

/** Milisegundos que pide esperar un 429: `retry_after` del cuerpo (segundos) o el header `Retry-After`. */
async function retryAfterMs(response: Response): Promise<number | null> {
  const seconds =
    (await numberField(response.clone(), 'retry_after')) ??
    (response.headers.has('Retry-After') ? Number(response.headers.get('Retry-After')) : null)
  return seconds !== null && Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null
}

/** Un campo numérico del cuerpo JSON de una respuesta, o `null`. */
async function numberField(response: Response, field: 'code' | 'retry_after'): Promise<number | null> {
  try {
    const value = ((await response.json()) as Record<string, unknown>)[field]
    return typeof value === 'number' ? value : null
  } catch {
    return null
  }
}
