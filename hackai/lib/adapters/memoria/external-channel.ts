/* Canal externo en memoria, con la forma de Discord: ids crecientes tipo
   snowflake, lectura desde un cursor, hilos y adjuntos que se bajan por URL.
   Arranca con los canales del set de datos sintéticos. */
import type { SyntheticData } from '@/lib/adapters/synthetic-data'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalChannelPort, ExternalMessage } from '@/lib/ports/external-channel'
import { fail, ok } from '@/lib/result'

/** El bot de HackAI en el canal externo. */
const BOT = { id: '1302000000000000001', name: 'HackAI', isBot: true }

export function createMemoryExternalChannel(data: SyntheticData, clock: ClockPort): ExternalChannelPort {
  const channels = structuredClone(data.discord.channels)
  const files = { ...data.discord.files }
  let lastId = channels
    .flatMap((c) => c.messages.map((m) => BigInt(m.id)))
    .reduce((max, id) => (id > max ? id : max), 1310000000000000000n)

  const copy = <T>(value: T): T => structuredClone(value)

  function append(channelId: string, text: string, threadId: string | null): ExternalMessage | null {
    const channel = channels.find((c) => c.id === channelId)
    if (!channel) return null
    lastId += 1n
    const message: ExternalMessage = {
      id: String(lastId),
      channelId,
      author: { ...BOT },
      text,
      attachments: [],
      threadId,
      viaWebhook: false,
      createdAt: clock.now().toISOString(),
    }
    channel.messages.push(message)
    return message
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

    async download(attachment) {
      const content = files[attachment.url]
      if (content === undefined) return fail('adjunto-vencido')
      return ok({ filename: attachment.filename, contentType: attachment.contentType, bytes: new TextEncoder().encode(content) })
    },
  }
}
