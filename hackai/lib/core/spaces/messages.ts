/* Los mensajes como los ve una persona y cómo se arman los hilos: cada mensaje
   de primer nivel con sus respuestas. Una respuesta a una respuesta se guarda
   colgada de la raíz, así que los hilos tienen un solo nivel. */

import type { Message, StoredMessage, Thread } from '@/lib/core/spaces'
import type { Authors } from '@/lib/core/spaces/authors'

export async function toMessage(stored: StoredMessage, authors: Authors, unread: boolean): Promise<Message> {
  return {
    id: stored.id,
    channelId: stored.channelId,
    author: await authors.ofMessage(stored),
    text: stored.text,
    attachments: stored.attachments,
    origin: stored.origin,
    externalId: stored.externalId,
    status: stored.status,
    replyTo: stored.replyTo,
    question: stored.resolved === null ? null : { resolved: stored.resolved },
    unread,
    createdAt: stored.createdAt
  }
}

/** Los mensajes de primer nivel por orden de llegada, cada uno con sus respuestas.
    Espera los mensajes ordenados por `seq`, como los da el almacén. */
export function threadsOf(messages: Message[]): Thread[] {
  const threads = messages.filter((m) => m.replyTo === null).map((message): Thread => ({ message, replies: [] }))
  const byId = new Map(threads.map((t) => [t.message.id, t]))
  for (const message of messages) {
    if (message.replyTo !== null) byId.get(message.replyTo)?.replies.push(message)
  }
  return threads
}
