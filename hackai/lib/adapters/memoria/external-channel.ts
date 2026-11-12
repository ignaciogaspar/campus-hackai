/* Canal externo en memoria, con la forma de Discord: ids crecientes tipo
   snowflake, lectura desde un cursor, hilos y adjuntos que se bajan por URL.
   Arranca con los canales del set de datos sintéticos. Además del puerto,
   `receive` simula que alguien escribe en el canal externo, para probar la
   vuelta sin Discord. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalAttachment, ExternalChannelPort, ExternalMessage } from '@/lib/ports/external-channel'
import { fail, ok } from '@/lib/result'

/** El bot de HackAI en el canal externo. */
const BOT = { id: '1302000000000000001', name: 'HackAI', isBot: true }

/** Lo que escribe alguien en el canal externo. Un adjunto `vencido` ya no se puede bajar. */
export type IncomingMessage = {
  author: { id: string; name: string; isBot?: boolean }
  text: string
  threadId?: string | null
  attachments?: { filename: string; contentType: string; content: string; expired?: boolean }[]
}

export type MemoryExternalChannel = ExternalChannelPort & {
  /** Simula un mensaje de una persona en el canal externo. `null` si el canal no existe. */
  receive(channelId: string, message: IncomingMessage): ExternalMessage | null
}

export function createMemoryExternalChannel(data: SyntheticData, clock: ClockPort): MemoryExternalChannel {
  const channels = structuredClone(data.discord.channels)
  const files = { ...data.discord.files }
  let lastId = channels
    .flatMap((c) => c.messages.map((m) => BigInt(m.id)))
    // biome-ignore lint/complexity/useMathMinMax: son BigInt, y Math.max no los acepta.
    .reduce((max, id) => (id > max ? id : max), 1310000000000000000n)

  const copy = <T>(value: T): T => structuredClone(value)

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
    capabilities: { delivery: 'cursor', threads: true },

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
