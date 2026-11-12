/* Canal externo en memoria, con la forma de Discord: ids crecientes tipo
   snowflake, lectura desde un cursor, hilos y adjuntos que se bajan por URL.
   Arranca con los canales del set de datos sintéticos. Además del puerto,
   `receive` simula que alguien escribe en el canal externo, para probar la
   vuelta sin Discord.

   Los canales sintéticos están en un servidor (`MEMORY_SERVER`) del que son
   miembros todas las personas sintéticas con cuenta de Discord. Ahí se crean
   la categoría, el rol de docentes y los canales; `serverState` muestra cómo
   quedaron, con quién escribe en cada canal. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ClockPort } from '@/lib/ports/clock'
import type {
  ExternalAttachment,
  ExternalChannelPort,
  ExternalMessage,
  ExternalServerChannel,
  ExternalWriters
} from '@/lib/ports/external-channel'
import { fail, ok } from '@/lib/result'

/** El servidor de la cátedra en memoria. */
export const MEMORY_SERVER = '1300000000000000001'

/** El bot de HackAI en el canal externo. */
const BOT = { id: '1302000000000000001', name: 'HackAI', isBot: true }

/** Lo que escribe alguien en el canal externo. Un adjunto `vencido` ya no se puede bajar. */
export type IncomingMessage = {
  author: { id: string; name: string; isBot?: boolean }
  text: string
  threadId?: string | null
  attachments?: { filename: string; contentType: string; content: string; expired?: boolean }[]
}

/** Cómo quedó el servidor: sus categorías, sus roles con sus miembros y sus canales con quién escribe. */
export type MemoryServerState = {
  categories: { id: string; name: string }[]
  roles: { id: string; name: string; members: string[] }[]
  channels: (ExternalServerChannel & { writers: ExternalWriters | null })[]
}

export type MemoryExternalChannel = ExternalChannelPort & {
  /** Simula un mensaje de una persona en el canal externo. `null` si el canal no existe. */
  receive(channelId: string, message: IncomingMessage): ExternalMessage | null
  /** Cómo quedó un servidor, o `null` si no existe. */
  serverState(serverId: string): MemoryServerState | null
  /** Simula que una cuenta entra al servidor. */
  join(serverId: string, userId: string): void
}

type MemoryServer = {
  members: Set<string>
  categories: { id: string; name: string }[]
  roles: { id: string; name: string; members: Set<string> }[]
  /** Los canales del servidor, con su categoría y quién escribe (`null` en los que no creó HackAI). */
  channels: { id: string; categoryId: string | null; writers: ExternalWriters | null }[]
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

export function createMemoryExternalChannel(data: SyntheticData, clock: ClockPort): MemoryExternalChannel {
  const channels = structuredClone(data.discord.channels)
  const files = { ...data.discord.files }
  let lastId = channels
    .flatMap((c) => c.messages.map((m) => BigInt(m.id)))
    // biome-ignore lint/complexity/useMathMinMax: son BigInt, y Math.max no los acepta.
    .reduce((max, id) => (id > max ? id : max), 1310000000000000000n)

  const copy = <T>(value: T): T => structuredClone(value)

  const servers = new Map<string, MemoryServer>([
    [
      MEMORY_SERVER,
      {
        members: new Set(data.people.flatMap((p) => (p.discordId ? [p.discordId] : []))),
        categories: [],
        roles: [],
        channels: channels.map((c) => ({ id: c.id, categoryId: null, writers: null }))
      }
    ]
  ])

  function toServerChannel(server: MemoryServer, entry: MemoryServer['channels'][number]): ExternalServerChannel {
    const name = channels.find((c) => c.id === entry.id)?.name ?? ''
    const category = server.categories.find((c) => c.id === entry.categoryId)?.name ?? null
    return { id: entry.id, name, category }
  }

  const nextId = () => {
    lastId += 1n
    return String(lastId)
  }

  function append(
    channelId: string,
    text: string,
    threadId: string | null,
    fields: Partial<Pick<ExternalMessage, 'author' | 'attachments'>> = {}
  ): ExternalMessage | null {
    const channel = channels.find((c) => c.id === channelId)
    if (!channel) return null
    const message: ExternalMessage = {
      id: nextId(),
      channelId,
      author: { ...BOT },
      text,
      attachments: [],
      threadId,
      viaWebhook: false,
      createdAt: clock.now().toISOString(),
      ...fields
    }
    channel.messages.push(message)
    return message
  }

  function attachmentOf(channelId: string, incoming: NonNullable<IncomingMessage['attachments']>[number]) {
    const id = nextId()
    const bytes = new TextEncoder().encode(incoming.content).byteLength
    const attachment: ExternalAttachment = {
      id,
      filename: incoming.filename,
      contentType: incoming.contentType,
      size: bytes,
      url: `https://cdn.discordapp.com/attachments/${channelId}/${id}/${encodeURIComponent(incoming.filename)}?ex=vence`
    }
    if (!incoming.expired) files[attachment.url] = incoming.content
    return attachment
  }

  return {
    capabilities: { delivery: 'cursor', threads: true, servers: true },

    async read(channelId, cursor) {
      const channel = channels.find((c) => c.id === channelId)
      if (!channel) return fail('canal-inexistente')
      const after = BigInt(cursor ?? '0')
      const messages = channel.messages
        .filter((m) => BigInt(m.id) > after)
        .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
      return ok({ messages: copy(messages), cursor: messages.at(-1)?.id ?? cursor })
    },

    async post(channelId, text) {
      const message = append(channelId, text, null)
      return message ? ok(copy(message)) : fail('canal-inexistente')
    },

    async reply(channelId, threadId, text) {
      const channel = channels.find((c) => c.id === channelId)
      if (!channel) return fail('canal-inexistente')
      if (!channel.messages.some((m) => m.id === threadId)) return fail('mensaje-inexistente')
      return ok(copy(append(channelId, text, threadId)!))
    },

    async openThread(channelId, messageId) {
      const channel = channels.find((c) => c.id === channelId)
      if (!channel) return fail('canal-inexistente')
      return channel.messages.some((m) => m.id === messageId) ? ok(null) : fail('mensaje-inexistente')
    },

    receive(channelId, incoming) {
      if (!channels.some((c) => c.id === channelId)) return null
      const author = { isBot: false, ...incoming.author }
      const attachments = (incoming.attachments ?? []).map((a) => attachmentOf(channelId, a))
      return copy(append(channelId, incoming.text, incoming.threadId ?? null, { author, attachments }))
    },

    serverState(serverId) {
      const server = servers.get(serverId)
      if (!server) return null
      return copy({
        categories: server.categories,
        roles: server.roles.map((r) => ({ id: r.id, name: r.name, members: [...r.members] })),
        channels: server.channels.map((c) => ({ ...toServerChannel(server, c), writers: c.writers }))
      })
    },

    join(serverId, userId) {
      servers.get(serverId)?.members.add(userId)
    },

    async serverChannels(serverId) {
      const server = servers.get(serverId)
      if (!server) return fail('servidor-inexistente')
      return ok(server.channels.map((c) => toServerChannel(server, c)))
    },

    async isMember(serverId, userId) {
      const server = servers.get(serverId)
      return server ? ok(server.members.has(userId)) : fail('servidor-inexistente')
    },

    async prepareGroup(serverId, group) {
      const server = servers.get(serverId)
      if (!server) return fail('servidor-inexistente')
      let category = server.categories.find((c) => sameName(c.name, group.name))
      if (!category) {
        category = { id: nextId(), name: group.name }
        server.categories.push(category)
      }
      const roleName = `Docentes · ${group.name}`
      let role = server.roles.find((r) => sameName(r.name, roleName))
      if (!role) {
        role = { id: nextId(), name: roleName, members: new Set() }
        server.roles.push(role)
      }
      for (const id of group.teacherIds) if (server.members.has(id)) role.members.add(id)
      return ok({ categoryId: category.id, teachersRoleId: role.id })
    },

    async createChannel(serverId, group, channel) {
      const server = servers.get(serverId)
      if (!server) return fail('servidor-inexistente')
      const id = nextId()
      channels.push({ id, name: channel.name, messages: [] })
      const entry = { id, categoryId: group.categoryId, writers: channel.writers }
      server.channels.push(entry)
      return ok(toServerChannel(server, entry))
    },

    async download(attachment) {
      const content = files[attachment.url]
      if (content === undefined) return fail('adjunto-vencido')
      return ok({
        filename: attachment.filename,
        contentType: attachment.contentType,
        bytes: new TextEncoder().encode(content)
      })
    }
  }
}
