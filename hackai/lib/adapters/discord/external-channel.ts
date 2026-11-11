/* Canal externo sobre la API REST v10 de Discord, sin gateway: lee consultando
   desde un cursor, publica, responde en hilos y baja adjuntos. Research:
   docs/research/2026-11-10-canales-externos-apis.md.

   - El bot necesita el intent Message Content: sin él, Discord devuelve el
     texto y los adjuntos vacíos (guía: docs/discord.md).
   - El cursor es el id (snowflake) del último mensaje leído. Como los ids son
     crecientes en todo Discord, el mismo cursor sirve para el canal y sus hilos.
   - Un hilo de Discord es un canal aparte cuyo id es el del mensaje que lo
     empezó. Sus mensajes se devuelven con el `channelId` del canal padre y ese
     id como `threadId`, igual que una respuesta (`message_reference`).
   - Los hilos se leen de los activos del servidor: un hilo archivado vuelve a
     estar activo cuando recibe un mensaje, así que alcanza si se sincroniza al
     menos una vez por hora (el archivado más corto de Discord).
   - Ante un 429 espera el `retry_after` que pide Discord y reintenta. Una caída,
     un tiempo agotado o un error del servidor vuelven como `falla-externa`.
   - El token solo viaja en el header `Authorization` hacia la API: nunca a la
     CDN, ni en errores ni en logs. */
import type {
  ExternalAttachment,
  ExternalChannelPort,
  ExternalMessage,
} from '@/lib/ports/external-channel'
import { fail, ok, type ExternalFailure, type Result } from '@/lib/result'

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
/** `limit` máximo de Get Channel Messages. */
const PAGE_SIZE = 100
/** Páginas por fuente en una lectura; lo que sobra queda para la siguiente. */
const MAX_PAGES = 10
/** Tipos de mensaje que son de personas: DEFAULT y REPLY. El resto es del sistema. */
const USER_MESSAGE_TYPES = new Set([0, 19])
/** Error de la API de Discord (JSON Error Codes) al abrir un hilo que ya existe. */
const THREAD_ALREADY_CREATED = 160004

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
}

/** Respuesta de un request: el cuerpo, un error HTTP con su código de Discord, o caída. */
type Reply =
  | { kind: 'ok'; response: Response }
  | { kind: 'http'; status: number; code: number | null }
  | { kind: 'caida' }

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

  async function send(url: string, init: RequestInit): Promise<Reply> {
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
      return { kind: 'http', status: response.status, code: await errorCode(response) }
    }
  }

  /** Request a la API con el token del bot. Devuelve el JSON o el error HTTP;
      una caída tira `DiscordDown`, que `guard` convierte en `falla-externa`. */
  async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ ok: true; body: T } | { ok: false; status: number; code: number | null }> {
    const headers: Record<string, string> = { Authorization: `Bot ${options.token}`, 'User-Agent': USER_AGENT }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const reply = await send(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    if (reply.kind === 'caida') throw new DiscordDown()
    if (reply.kind === 'http') return { ok: false, status: reply.status, code: reply.code }
    try {
      return { ok: true, body: (await reply.response.json()) as T }
    } catch {
      throw new DiscordDown()
    }
  }

  /** Comprueba que el canal existe y recuerda su servidor. */
  async function channelGuild(channelId: string): Promise<Result<string | null, 'canal-inexistente'>> {
    if (guildOf.has(channelId)) return ok(guildOf.get(channelId)!)
    const res = await api<DiscordChannel>('GET', `/channels/${channelId}`)
    if (!res.ok) {
      if (res.status === 404) return fail('canal-inexistente')
      throw new DiscordDown()
    }
    guildOf.set(channelId, res.body.guild_id ?? null)
    return ok(res.body.guild_id ?? null)
  }

  /** Mensajes de un canal (o hilo) posteriores a `after`, del más viejo al más
      nuevo. `complete` es falso si quedaron mensajes sin leer por el tope de páginas. */
  async function readAfter(channelId: string, after: string | null): Promise<{ messages: DiscordMessage[]; complete: boolean }> {
    const messages: DiscordMessage[] = []
    let from = after ?? '0'
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await api<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=${PAGE_SIZE}&after=${from}`)
      if (!res.ok) throw new DiscordDown()
      const batch = [...res.body].sort(byId)
      messages.push(...batch)
      if (batch.length < PAGE_SIZE) return { messages, complete: true }
      from = batch.at(-1)!.id
    }
    return { messages, complete: false }
  }

  return {
    capabilities: { delivery: 'cursor', threads: true },

    read: (channelId, cursor) => guard(async () => {
      const guild = await channelGuild(channelId)
      if (!guild.ok) return guild

      const sources: { threadId: string | null; read: { messages: DiscordMessage[]; complete: boolean } }[] = [
        { threadId: null, read: await readAfter(channelId, cursor) },
      ]
      if (guild.value) {
        const active = await api<{ threads: DiscordChannel[] }>('GET', `/guilds/${guild.value}/threads/active`)
        if (!active.ok) throw new DiscordDown()
        const threads = active.body.threads.filter((t) => t.parent_id === channelId
          && (cursor === null || (t.last_message_id != null && BigInt(t.last_message_id) > BigInt(cursor))))
        for (const thread of threads) sources.push({ threadId: thread.id, read: await readAfter(thread.id, cursor) })
      }

      // Si una fuente quedó cortada, el cursor no puede pasar su último mensaje leído.
      const limit = sources
        .filter((s) => !s.read.complete)
        .map((s) => BigInt(s.read.messages.at(-1)!.id))
        .reduce<bigint | null>((min, id) => (min === null || id < min ? id : min), null)

      const rootOf = new Map<string, string | null>()
      const messages: ExternalMessage[] = []
      for (const { threadId, read } of sources) {
        for (const raw of read.messages) {
          if (limit !== null && BigInt(raw.id) > limit) continue
          if (!USER_MESSAGE_TYPES.has(raw.type)) continue
          const referenced = raw.message_reference?.message_id ?? null
          const thread = threadId ?? (referenced ? rootOf.get(referenced) ?? referenced : null)
          rootOf.set(raw.id, thread)
          messages.push(toMessage(raw, channelId, thread))
        }
      }
      messages.sort(byId)
      return ok({ messages, cursor: messages.at(-1)?.id ?? (limit !== null ? String(limit) : cursor) })
    }),

    post: (channelId, text) => guard(async () => {
      const res = await api<DiscordMessage>('POST', `/channels/${channelId}/messages`, message(text))
      if (!res.ok) {
        if (res.status === 404) return fail('canal-inexistente')
        throw new DiscordDown()
      }
      return ok(toMessage(res.body, channelId, null))
    }),

    reply: (channelId, threadId, text) => guard(async () => {
      const guild = await channelGuild(channelId)
      if (!guild.ok) return guild

      const root = await api<DiscordMessage>('GET', `/channels/${channelId}/messages/${threadId}`)
      if (!root.ok) {
        if (root.status === 404) return fail('mensaje-inexistente')
        throw new DiscordDown()
      }
      if (!root.body.thread) {
        const created = await api<DiscordChannel>('POST', `/channels/${channelId}/messages/${threadId}/threads`, {
          name: threadName(root.body.content),
          auto_archive_duration: 10080,
        })
        if (!created.ok && created.code !== THREAD_ALREADY_CREATED) throw new DiscordDown()
      }

      const res = await api<DiscordMessage>('POST', `/channels/${threadId}/messages`, message(text))
      if (!res.ok) throw new DiscordDown()
      return ok(toMessage(res.body, channelId, threadId))
    }),

    download: (attachment) => guard(async () => {
      if (!isDiscordCdn(attachment.url)) return fail('falla-externa')
      const reply = await send(attachment.url, { method: 'GET', headers: { 'User-Agent': USER_AGENT } })
      if (reply.kind === 'caida') return fail('falla-externa')
      if (reply.kind === 'http') return fail([403, 404, 410].includes(reply.status) ? 'adjunto-vencido' : 'falla-externa')
      const bytes = new Uint8Array(await reply.response.arrayBuffer())
      return ok({ filename: attachment.filename, contentType: attachment.contentType, bytes })
    }),
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

function toMessage(raw: DiscordMessage, channelId: string, threadId: string | null): ExternalMessage {
  const viaWebhook = raw.webhook_id != null
  return {
    id: raw.id,
    channelId,
    author: {
      id: raw.author.id,
      name: raw.author.global_name || raw.author.username,
      isBot: raw.author.bot === true || viaWebhook,
    },
    text: raw.content,
    attachments: (raw.attachments ?? []).map(toAttachment),
    threadId,
    viaWebhook,
    createdAt: new Date(raw.timestamp).toISOString(),
  }
}

function toAttachment(raw: DiscordAttachment): ExternalAttachment {
  return {
    id: raw.id,
    filename: raw.filename,
    contentType: raw.content_type ?? 'application/octet-stream',
    size: raw.size,
    url: raw.url,
  }
}

/** Cuerpo de Create Message. Sin menciones: un texto de HackAI no notifica a nadie por arroba. */
function message(text: string) {
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
  try {
    const body = (await response.clone().json()) as { retry_after?: unknown }
    if (typeof body.retry_after === 'number') return Math.ceil(body.retry_after * 1000)
  } catch {
    // Sin cuerpo JSON: se usa el header.
  }
  const header = Number(response.headers.get('Retry-After'))
  return Number.isFinite(header) && response.headers.has('Retry-After') ? Math.ceil(header * 1000) : null
}

async function errorCode(response: Response): Promise<number | null> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return typeof body.code === 'number' ? body.code : null
  } catch {
    return null
  }
}
