/* Puerto del canal externo de la cátedra (Discord primero; Slack queda
   diseñado). Research: docs/research/2026-11-10-canales-externos-apis.md.
   Lee los mensajes nuevos de un canal desde un cursor, publica, responde en un
   hilo y baja un adjunto antes de que venza su URL. Los ids de autor son ids
   del canal externo; Personas los mapea. */
import type { ExternalFailure, Result } from '@/lib/result'

export type ExternalChannelCapabilities = {
  /** `cursor`: se lee consultando (Discord). `evento`: el sistema avisa y el
      adaptador lo entrega por el mismo cursor (Slack). */
  delivery: 'cursor' | 'evento'
  /** Soporta responder en hilos. */
  threads: boolean
}

export type ExternalAttachment = {
  id: string
  filename: string
  contentType: string
  size: number
  /** Las URLs de Discord vencen: hay que bajar el archivo al leerlo. */
  url: string
}

export type ExternalMessage = {
  id: string
  channelId: string
  author: { id: string; name: string; isBot: boolean }
  text: string
  attachments: ExternalAttachment[]
  /** Mensaje raíz del hilo al que pertenece, o `null`. */
  threadId: string | null
  /** Publicado por un webhook y no por una cuenta. */
  viaWebhook: boolean
  createdAt: string
}

export type ExternalPage = {
  messages: ExternalMessage[]
  /** Cursor para la siguiente lectura. Igual al anterior si no hubo nada. */
  cursor: string | null
}

export type ExternalDownload = { filename: string; contentType: string; bytes: Uint8Array }

export type ExternalChannelError = 'canal-inexistente' | ExternalFailure

export type ExternalChannelPort = {
  capabilities: ExternalChannelCapabilities

  /** Mensajes posteriores a `cursor`, del más viejo al más nuevo. Con `null`, desde el principio. */
  read(channelId: string, cursor: string | null): Promise<Result<ExternalPage, ExternalChannelError>>
  post(channelId: string, text: string): Promise<Result<ExternalMessage, ExternalChannelError>>
  reply(
    channelId: string,
    threadId: string,
    text: string
  ): Promise<Result<ExternalMessage, ExternalChannelError | 'mensaje-inexistente' | 'no-soportado'>>
  /** Abre un hilo sobre un mensaje, sin escribir nada en él, para que las respuestas
      queden juntas. Si ya tenía uno, no hace nada. */
  openThread(
    channelId: string,
    messageId: string
  ): Promise<Result<null, ExternalChannelError | 'mensaje-inexistente' | 'no-soportado'>>
  download(attachment: ExternalAttachment): Promise<Result<ExternalDownload, 'adjunto-vencido' | ExternalFailure>>
}
