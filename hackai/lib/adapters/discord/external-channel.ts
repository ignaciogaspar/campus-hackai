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
     recibió mensajes y se archivó entre dos lecturas no los pierde. El canal,
     la lista de hilos y los hilos con novedades se piden en paralelo.
   - Ante un 429 espera el `retry_after` que pide Discord y reintenta, hasta
     `maxRetries` veces y `maxRetryAfterMs` de espera. Si pide más, devuelve
     `falla-externa` en vez de bloquear, y la próxima sincronización reintenta.
     Una caída, un tiempo agotado o un error del servidor también vuelven como
     `falla-externa`.
   - El token solo viaja en el header `Authorization` hacia la API: nunca a la
     CDN, ni en errores ni en logs.
   - En el servidor de la cátedra lista los canales de texto y crea la
     categoría de la materia, el rol de sus docentes y sus canales. Un canal
     solo para docentes niega escribir a @everyone y se lo permite al rol de
     docentes y al bot, que si no quedaría afuera. Para eso el bot necesita
     Gestionar canales y Gestionar roles (docs/discord.md). */
import type {
  ExternalAttachment,
  ExternalChannelPort,
  ExternalGroup,
  ExternalMessage,
  ExternalServerChannel,
  ExternalServerError,
  ExternalWriters
} from '@/lib/ports/external-channel'
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
/** Tipos de canal de Discord: de texto y categoría. */
const GUILD_TEXT = 0
const GUILD_CATEGORY = 4
/** Tipos de destinatario de un permiso por canal: un rol o un miembro. */
const ROLE = 0
const MEMBER = 1
/** Permisos de Discord (bits). */
const VIEW_CHANNEL = 1n << 10n
const SEND_MESSAGES = 1n << 11n
const READ_MESSAGE_HISTORY = 1n << 16n
const CREATE_PUBLIC_THREADS = 1n << 35n
const SEND_MESSAGES_IN_THREADS = 1n << 38n
/** Escribir en un canal: mensajes, hilos y respuestas en hilos. */
const WRITE = SEND_MESSAGES | CREATE_PUBLIC_THREADS | SEND_MESSAGES_IN_THREADS
/** Lo que el bot necesita en cada canal que crea: verlo, leerlo y escribir. */
const BOT_ALLOW = VIEW_CHANNEL | READ_MESSAGE_HISTORY | WRITE
/** Errores de la API (JSON Error Codes) de un miembro o un usuario que no existen. */
const UNKNOWN_MEMBER = 10007
const UNKNOWN_USER = 10013
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
  name?: string
  position?: number
  guild_id?: string
  parent_id?: string | null
  last_message_id?: string | null
  thread_metadata?: { archived: boolean; archive_timestamp: string }
}

type DiscordRole = { id: string; name: string }

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
  async function api<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { Authorization: `Bot ${options.token}`, 'User-Agent': USER_AGENT }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const outcome = await send(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (outcome.kind === 'caida') throw new DiscordDown()
    if (outcome.kind === 'http') return { ok: false, error: { status: outcome.status, code: outcome.code } }
    // Sin contenido, como al darle un rol a un miembro.
    if (outcome.response.status === 204) return ok(null as T)
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
    const [{ threads: active }, archived] = await Promise.all([
      api<{ threads: DiscordChannel[] }>('GET', `/guilds/${guildId}/threads/active`).then(must),
      archivedThreads(channelId, cursor)
    ])
    const withNews = (t: DiscordChannel) =>
      t.parent_id === channelId &&
      (cursor === null || (t.last_message_id != null && BigInt(t.last_message_id) > BigInt(cursor)))
    return [...new Set([...active, ...archived].filter(withNews).map((t) => t.id))]
  }

  /** Hilos archivados del canal, del más reciente al más viejo, hasta los archivados antes del cursor. */
  async function archivedThreads(channelId: string, cursor: string | null): Promise<DiscordChannel[]> {
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
    return archived
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

  /** El id de usuario del bot, para darle permiso en los canales que crea. */
  let botId: string | null = null
  async function botUserId(): Promise<string> {
    botId ??= must(await api<DiscordUser>('GET', '/users/@me')).id
    return botId
  }

  /** Los canales del servidor, de todos los tipos. */
  async function guildChannels(serverId: string): Promise<Result<DiscordChannel[], ExternalServerError>> {
    return orServerError(await api<DiscordChannel[]>('GET', `/guilds/${serverId}/channels`))
  }

  /** La categoría con ese nombre, o una nueva. */
  async function ensureCategory(serverId: string, name: string): Promise<Result<string, ExternalServerError>> {
    const channels = await guildChannels(serverId)
    if (!channels.ok) return channels
    const found = channels.value.find((c) => c.type === GUILD_CATEGORY && sameName(c.name, name))
    if (found) return ok(found.id)
    const created = orServerError(
      await api<DiscordChannel>('POST', `/guilds/${serverId}/channels`, { name, type: GUILD_CATEGORY })
    )
    return created.ok ? ok(created.value.id) : created
  }

  /** El rol con ese nombre, o uno nuevo, sin permisos propios ni menciones. */
  async function ensureRole(serverId: string, name: string): Promise<Result<string, ExternalServerError>> {
    const roles = orServerError(await api<DiscordRole[]>('GET', `/guilds/${serverId}/roles`))
    if (!roles.ok) return roles
    const found = roles.value.find((r) => sameName(r.name, name))
    if (found) return ok(found.id)
    const created = orServerError(
      await api<DiscordRole>('POST', `/guilds/${serverId}/roles`, { name, permissions: '0', mentionable: false })
    )
    return created.ok ? ok(created.value.id) : created
  }

  /** Le da el rol a cada cuenta. Una que no es miembro del servidor (404) se saltea. */
  async function grantRole(
    serverId: string,
    roleId: string,
    userIds: string[]
  ): Promise<Result<null, ExternalServerError>> {
    for (const userId of userIds) {
      const granted = await api<null>('PUT', `/guilds/${serverId}/members/${userId}/roles/${roleId}`)
      if (!granted.ok && granted.error.status !== 404) return orServerError(granted)
    }
    return ok(null)
  }

  /** Permisos del canal: con `docentes`, @everyone no escribe y el rol de docentes sí. El bot, siempre. */
  async function overwritesFor(serverId: string, group: ExternalGroup, writers: ExternalWriters) {
    const bot = { id: await botUserId(), type: MEMBER, allow: String(BOT_ALLOW), deny: '0' }
    if (writers === 'todos') return [bot]
    return [
      // El id del rol @everyone es el del servidor.
      { id: serverId, type: ROLE, allow: '0', deny: String(WRITE) },
      { id: group.teachersRoleId, type: ROLE, allow: String(WRITE), deny: '0' },
      bot
    ]
  }

  return {
    capabilities: { delivery: 'cursor', threads: true, servers: true },

    read: (channelId, cursor) =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complejidad 39 (máximo 15). Se refactoriza después de la demo (#30).
      guard(async () => {
        const guild = await channelGuild(channelId)
        if (!guild.ok) return guild

        // El canal y la lista de hilos a la vez, y después los hilos con novedades a la vez: uno detrás del
        // otro sumaban un request entero por cada paso (#111).
        const [own, threadIds] = await Promise.all([
          readAfter(channelId, cursor, null),
          guild.value ? threadsWithNews(guild.value, channelId, cursor) : Promise.resolve([])
        ])
        const sources = [own, ...(await Promise.all(threadIds.map((id) => readAfter(id, cursor, id))))]

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
      }),

    serverChannels: (serverId) =>
      guard(async () => {
        const channels = await guildChannels(serverId)
        if (!channels.ok) return channels
        const categories = new Map(
          channels.value.filter((c) => c.type === GUILD_CATEGORY).map((c) => [c.id, c.name ?? ''])
        )
        // Solo los de texto: los de anuncios se publican distinto y no se leen como un canal común.
        const text = channels.value
          .filter((c) => c.type === GUILD_TEXT)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || byId(a, b))
        return ok(text.map((c) => toServerChannel(c, categories)))
      }),

    isMember: (serverId, userId) =>
      guard(async () => {
        const member = await api<unknown>('GET', `/guilds/${serverId}/members/${userId}`)
        if (member.ok) return ok(true)
        const unknown = member.error.code === UNKNOWN_MEMBER || member.error.code === UNKNOWN_USER
        return member.error.status === 404 && unknown ? ok(false) : orServerError(member)
      }),

    prepareGroup: (serverId, group) =>
      guard(async () => {
        const categoryId = await ensureCategory(serverId, group.name)
        if (!categoryId.ok) return categoryId
        const teachersRoleId = await ensureRole(serverId, teachersRoleName(group.name))
        if (!teachersRoleId.ok) return teachersRoleId
        const granted = await grantRole(serverId, teachersRoleId.value, group.teacherIds)
        if (!granted.ok) return granted
        return ok({ categoryId: categoryId.value, teachersRoleId: teachersRoleId.value })
      }),

    createChannel: (serverId, group, channel) =>
      guard(async () => {
        const created = orServerError(
          await api<DiscordChannel>('POST', `/guilds/${serverId}/channels`, {
            name: channel.name,
            type: GUILD_TEXT,
            parent_id: group.categoryId,
            permission_overwrites: await overwritesFor(serverId, group, channel.writers)
          })
        )
        if (!created.ok) return created
        guildOf.set(created.value.id, serverId)
        return ok(toServerChannel(created.value, new Map()))
      })
  }
}

/** El nombre del rol de los docentes de una materia. Discord corta los nombres de rol en 100 caracteres. */
function teachersRoleName(subject: string): string {
  return `Docentes · ${subject}`.slice(0, 100)
}

/** Si dos nombres de categoría o de rol se ven iguales, sin distinguir mayúsculas. */
function sameName(a: string | undefined, b: string): boolean {
  return (a ?? '').trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')
}

function toServerChannel(raw: DiscordChannel, categories: Map<string, string>): ExternalServerChannel {
  return {
    id: raw.id,
    name: raw.name ?? '',
    category: raw.parent_id ? (categories.get(raw.parent_id) ?? null) : null
  }
}

/** En el servidor, un 404 es que no existe (o el bot no está) y un 403, que al bot le falta un permiso.
    Cualquier otro error es una caída. */
function orServerError<T>(res: ApiResult<T>): Result<T, ExternalServerError> {
  if (res.ok) return res
  if (res.error.status === 404) return fail('servidor-inexistente')
  if (res.error.status === 403) return fail('sin-permisos')
  throw new DiscordDown()
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
