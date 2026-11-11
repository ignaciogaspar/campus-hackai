/* Discord falso para los tests: un `fetch` que responde como la API REST v10 y
   la CDN de Discord, sin red. Guarda los mensajes en crudo, con la forma de la
   API (snake_case, hilos como canales aparte, mensajes de sistema), para que
   el adaptador real haga toda su traducción. */
import type { ExternalMessage } from '@/lib/ports/external-channel'

export const BOT_USER = { id: '1302000000000000001', username: 'HackAI', global_name: null, bot: true }
const GUILD = '1300000000000000001'

export type RawMessage = {
  id: string
  channel_id: string
  type: number
  content: string
  timestamp: string
  author: { id: string; username: string; global_name: string | null; bot?: boolean }
  attachments: { id: string; filename: string; content_type?: string; size: number; url: string }[]
  webhook_id?: string
  message_reference?: { message_id: string; channel_id: string }
  thread?: { id: string; name: string }
}

type RawChannel = {
  id: string
  type: number
  guild_id: string
  parent_id: string | null
  last_message_id: string | null
  thread_metadata?: { archived: boolean; archive_timestamp: string }
}

export type RecordedRequest = { method: string; url: string; headers: Record<string, string> }

export function createFakeDiscord() {
  const channels = new Map<string, RawChannel>()
  const messages = new Map<string, RawMessage[]>()
  const files = new Map<string, string>()
  const requests: RecordedRequest[] = []
  let lastId = 1320000000000000000n
  let throttled: { times: number; retryAfter: number }[] = []
  let down = false

  const nextId = () => String(++lastId)

  function addChannel(id: string, parentId: string | null = null): RawChannel {
    const channel: RawChannel = { id, type: parentId ? 11 : 0, guild_id: GUILD, parent_id: parentId, last_message_id: null }
    if (parentId) channel.thread_metadata = { archived: false, archive_timestamp: new Date().toISOString() }
    channels.set(id, channel)
    messages.set(id, [])
    return channel
  }

  function addMessage(raw: RawMessage) {
    if (!channels.has(raw.channel_id)) throw new Error(`Canal ${raw.channel_id} no cargado en el Discord falso`)
    messages.get(raw.channel_id)!.push(raw)
    channels.get(raw.channel_id)!.last_message_id = raw.id
    if (BigInt(raw.id) > lastId) lastId = BigInt(raw.id)
  }

  /** Abre un hilo desde un mensaje, como Start Thread from Message: el hilo
      tiene el id del mensaje y arranca con un mensaje de sistema (tipo 21). */
  function startThread(channelId: string, messageId: string, name: string): RawChannel {
    const thread = addChannel(messageId, channelId)
    const root = messages.get(channelId)!.find((m) => m.id === messageId)!
    root.thread = { id: messageId, name }
    addMessage({ ...systemMessage(messageId, 21), message_reference: { message_id: messageId, channel_id: channelId } })
    return thread
  }

  /** Archiva un hilo: deja de figurar entre los activos y pasa a los archivados. */
  function archiveThread(threadId: string, at: Date) {
    channels.get(threadId)!.thread_metadata = { archived: true, archive_timestamp: at.toISOString() }
  }

  function systemMessage(channelId: string, type: number): RawMessage {
    return { id: nextId(), channel_id: channelId, type, content: '', timestamp: new Date().toISOString(), author: BOT_USER, attachments: [] }
  }

  function json(status: number, body: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
  }

  const notFound = (code: number) => json(404, { message: 'Unknown', code })

  async function handle(method: string, url: URL, body: unknown): Promise<Response> {
    if (url.hostname === 'cdn.discordapp.com') {
      const file = files.get(url.toString())
      return file ? new Response(file, { status: 200 }) : new Response('This content is no longer available.', { status: 404 })
    }
    if (url.origin !== 'https://discord.com' || !url.pathname.startsWith('/api/v10/')) return json(400, { message: 'Ruta desconocida', code: 0 })
    const path = url.pathname.slice('/api/v10'.length).split('/').filter(Boolean)

    // GET /guilds/{guild}/threads/active
    if (path[0] === 'guilds' && path[2] === 'threads' && method === 'GET') {
      return json(200, { threads: [...channels.values()].filter((c) => c.thread_metadata && !c.thread_metadata.archived), members: [] })
    }
    if (path[0] !== 'channels') return json(400, { message: 'Ruta desconocida', code: 0 })
    const channel = channels.get(path[1])
    if (!channel) return notFound(10003)

    // GET /channels/{id}
    if (path.length === 2 && method === 'GET') return json(200, channel)

    // GET /channels/{id}/threads/archived/public?before&limit (del archivado más nuevo al más viejo)
    if (path.length === 5 && path[2] === 'threads' && path[3] === 'archived' && method === 'GET') {
      const before = url.searchParams.get('before')
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const archived = [...channels.values()]
        .filter((c) => c.parent_id === channel.id && c.thread_metadata?.archived)
        .filter((c) => !before || Date.parse(c.thread_metadata!.archive_timestamp) < Date.parse(before))
        .sort((a, b) => Date.parse(b.thread_metadata!.archive_timestamp) - Date.parse(a.thread_metadata!.archive_timestamp))
      return json(200, { threads: archived.slice(0, limit), members: [], has_more: archived.length > limit })
    }

    // GET /channels/{id}/messages?after&limit (del más nuevo al más viejo, como Discord)
    if (path.length === 3 && path[2] === 'messages' && method === 'GET') {
      const after = BigInt(url.searchParams.get('after') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const page = messages.get(channel.id)!
        .filter((m) => BigInt(m.id) > after)
        .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
        .slice(0, limit)
        .reverse()
      return json(200, page)
    }

    // POST /channels/{id}/messages
    if (path.length === 3 && path[2] === 'messages' && method === 'POST') {
      const { content } = body as { content: string }
      const created: RawMessage = { ...systemMessage(channel.id, 0), content, author: BOT_USER }
      addMessage(created)
      // Publicar en un hilo archivado lo desarchiva.
      if (channel.thread_metadata) channel.thread_metadata.archived = false
      return json(200, created)
    }

    const message = messages.get(channel.id)!.find((m) => m.id === path[3])

    // GET /channels/{id}/messages/{message}
    if (path.length === 4 && method === 'GET') return message ? json(200, message) : notFound(10008)

    // POST /channels/{id}/messages/{message}/threads
    if (path.length === 5 && path[4] === 'threads' && method === 'POST') {
      if (!message) return notFound(10008)
      if (message.thread) return json(400, { message: 'A thread has already been created for this message', code: 160004 })
      return json(201, startThread(channel.id, message.id, (body as { name: string }).name))
    }
    return json(400, { message: 'Ruta desconocida', code: 0 })
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = init?.method ?? 'GET'
    requests.push({ method, url: url.toString(), headers: { ...(init?.headers as Record<string, string>) } })
    if (down) throw new TypeError('fetch failed')
    if (throttled.length > 0) {
      const next = throttled[0]
      if (--next.times === 0) throttled = throttled.slice(1)
      return json(429, { message: 'You are being rate limited.', retry_after: next.retryAfter, global: false }, { 'Retry-After': String(Math.ceil(next.retryAfter)) })
    }
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    return handle(method, url, body)
  }

  return {
    fetch: fakeFetch,
    requests,
    addChannel,
    addMessage,
    startThread,
    archiveThread,
    addFile(url: string, content: string) {
      files.set(url, content)
    },
    /** Las próximas `times` requests responden 429 con este `retry_after` (segundos). */
    throttle(times: number, retryAfter: number) {
      throttled.push({ times, retryAfter })
    },
    setDown(value: boolean) {
      down = value
    },
    messagesOf(channelId: string) {
      return messages.get(channelId) ?? []
    },
  }
}

export type FakeDiscord = ReturnType<typeof createFakeDiscord>

/** Carga en el Discord falso los canales del set sintético, traducidos a la
    forma cruda de la API: los mensajes con `threadId` van al canal del hilo. */
export function seedFromSynthetic(fake: FakeDiscord, channels: { id: string; messages: ExternalMessage[] }[], files: Record<string, string>) {
  for (const channel of channels) {
    fake.addChannel(channel.id)
    for (const m of channel.messages.filter((m) => m.threadId === null)) fake.addMessage(toRaw(m, channel.id))
    for (const m of channel.messages.filter((m) => m.threadId !== null)) {
      if (!fake.messagesOf(m.threadId!).length) fake.startThread(channel.id, m.threadId!, 'Consulta')
      fake.addMessage(toRaw(m, m.threadId!))
    }
  }
  for (const [url, content] of Object.entries(files)) fake.addFile(url, content)
}

function toRaw(m: ExternalMessage, channelId: string): RawMessage {
  return {
    id: m.id,
    channel_id: channelId,
    type: 0,
    content: m.text,
    timestamp: m.createdAt.replace('Z', '+00:00'),
    author: m.viaWebhook
      ? { id: m.author.id, username: m.author.name, global_name: null, bot: true }
      : { id: m.author.id, username: m.author.name.toLowerCase(), global_name: m.author.name, ...(m.author.isBot ? { bot: true } : {}) },
    attachments: m.attachments.map((a) => ({ id: a.id, filename: a.filename, content_type: a.contentType, size: a.size, url: a.url })),
    ...(m.viaWebhook ? { webhook_id: m.author.id } : {}),
  }
}
