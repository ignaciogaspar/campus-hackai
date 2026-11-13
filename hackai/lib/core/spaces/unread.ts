/* Las novedades sin leer de una persona en todos sus espacios, para
   Novedades, Hoy y la navegación: por canal, cuánto no leyó y lo más nuevo,
   con quién lo publicó; en un directo, de quién es; y si todo es de un mismo
   hilo (o es una consulta nueva), cuál. Solo cuentan las comisiones actuales y los espacios que ya
   existen: pedir novedades no crea espacios. */
import type { People, PersonId } from '@/lib/core/people'
import type { MessageId, SpacesStore, StoredChannel, StoredMessage, UnreadItem, UnreadLatest } from '@/lib/core/spaces'
import { type Authors, authorsFrom } from '@/lib/core/spaces/authors'
import { type CurrentSpace, currentSpaces } from '@/lib/core/spaces/current-spaces'
import { counterpartOf } from '@/lib/core/spaces/direct'
import { loadSnapshot, type Snapshot, type UnreadIn, unreadIn } from '@/lib/core/spaces/reading'
import type { Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

const newest = <T extends { seq: number }>(items: T[]): T => items.reduce((a, b) => (b.seq > a.seq ? b : a))

/** Lo que se muestra de un mensaje: su texto o, si solo trae adjuntos, el nombre del primero. */
function shownText(message: StoredMessage): string {
  const text = message.text.trim()
  return text === '' && message.attachments.length > 0 ? message.attachments[0].name : text
}

/** Lo más nuevo que no leyó, con quién lo publicó o lo subió. */
async function latestOf(authors: Authors, unread: UnreadIn): Promise<UnreadLatest> {
  if (unread.material.length > 0) {
    const item = newest(unread.material)
    const author = item.addedBy ? await authors.ofPerson(item.addedBy) : null
    return { text: item.name, origin: item.origin, createdAt: item.addedAt, author }
  }
  const message = newest(unread.messages)
  return {
    text: shownText(message),
    origin: message.origin,
    createdAt: message.createdAt,
    author: await authors.ofMessage(message)
  }
}

/** El hilo de lo sin leer, si es uno solo y trae alguna respuesta o es una consulta: una consulta nueva sin
    respuestas lleva a su hilo, donde está «Responder». Un aviso suelto lleva al canal. */
function threadOf(messages: StoredMessage[]): MessageId | null {
  const roots = new Set(messages.map((m) => m.replyTo ?? m.id))
  if (roots.size !== 1) return null
  const isThread = messages.some((m) => m.replyTo !== null || m.resolved !== null)
  return isThread ? [...roots][0] : null
}

/** La novedad de un canal, o `null` si no hay nada sin leer. */
async function itemOf(
  authors: Authors,
  { space, member }: CurrentSpace,
  channel: StoredChannel,
  snapshot: Snapshot
): Promise<UnreadItem | null> {
  const unread = unreadIn(snapshot, channel)
  if (unread.count === 0) return null
  const [latest, counterpart] = await Promise.all([latestOf(authors, unread), counterpartOf(authors, member, channel)])
  return {
    spaceId: space.id,
    subjectId: space.subjectId,
    subjectName: space.name,
    channelId: channel.id,
    channelName: channel.name,
    kind: channel.kind,
    sectionId: channel.scope.kind === 'comision' ? channel.scope.sectionId : null,
    count: unread.count,
    latest,
    counterpart,
    thread: threadOf(unread.messages)
  }
}

const newestFirst = (a: UnreadItem, b: UnreadItem) =>
  b.latest.createdAt.localeCompare(a.latest.createdAt) || a.subjectName.localeCompare(b.subjectName, 'es')

export async function unreadFor(
  { studies, people, store }: { studies: Studies; people: People; store: SpacesStore },
  personId: PersonId
): Promise<Result<UnreadItem[], 'persona-desconocida' | ExternalFailure>> {
  const found = await currentSpaces(studies, store, personId)
  if (!found.ok) return found
  const visible = found.value
  if (visible.length === 0) return ok([])
  const snapshot = await loadSnapshot(
    store,
    personId,
    visible.flatMap((v) => v.channels),
    visible.map((v) => v.space.id)
  )
  if (!snapshot.ok) return snapshot
  const authors = authorsFrom(people)
  const items = await Promise.all(
    visible.flatMap((v) => v.channels.map((channel) => itemOf(authors, v, channel, snapshot.value)))
  )
  return ok(items.filter((item) => item !== null).sort(newestFirst))
}
