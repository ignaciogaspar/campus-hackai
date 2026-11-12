/* Las novedades sin leer de una persona en todos sus espacios, para
   Novedades, Hoy y la navegación: por canal, cuánto no leyó y lo más nuevo,
   con quién lo publicó; en un directo, de quién es; y si todo es de un mismo
   hilo, cuál. Solo cuentan las comisiones actuales y los espacios que ya
   existen: pedir novedades no crea espacios. */
import type { People, PersonId } from '@/lib/core/people'
import type {
  MessageId,
  SpacesStore,
  StoredChannel,
  StoredMessage,
  StoredSpace,
  UnreadItem,
  UnreadLatest
} from '@/lib/core/spaces'
import { type Membership, membershipFrom, sectionsOf } from '@/lib/core/spaces/access'
import { type Authors, authorsFrom } from '@/lib/core/spaces/authors'
import { visibleChannels } from '@/lib/core/spaces/channels'
import { counterpartOf } from '@/lib/core/spaces/direct'
import { loadSnapshot, type Snapshot, type UnreadIn, unreadIn } from '@/lib/core/spaces/reading'
import type { MySection, Studies } from '@/lib/core/studies'
import { type ExternalFailure, ok, type Result } from '@/lib/result'

/** Una membresía por materia, con la facultad de su primera comisión actual. */
function membershipsOf(personId: PersonId, sections: MySection[]): Membership[] {
  const current = sections.filter((s) => s.current)
  const subjectIds = [...new Set(current.map((s) => s.subjectId))]
  return subjectIds.map((subjectId) => {
    const ofSubject = current.filter((s) => s.subjectId === subjectId)
    const school = ofSubject[0].schoolId
    return membershipFrom(
      personId,
      ofSubject.filter((s) => s.schoolId === school),
      null
    )
  })
}

/** Los canales que la persona ve en un espacio, con su membresía. */
type Visible = { space: StoredSpace; member: Membership; channels: StoredChannel[] }

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

/** El hilo de lo sin leer, si es uno solo y trae alguna respuesta. */
function threadOf(messages: StoredMessage[]): MessageId | null {
  const roots = new Set(messages.map((m) => m.replyTo ?? m.id))
  const hasReply = messages.some((m) => m.replyTo !== null)
  return roots.size === 1 && hasReply ? [...roots][0] : null
}

/** La novedad de un canal, o `null` si no hay nada sin leer. */
async function itemOf(
  authors: Authors,
  { space, member }: Visible,
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
  const read = await sectionsOf(studies, personId)
  if (!read.ok) return read
  const members = membershipsOf(personId, read.value.sections)
  if (members.length === 0) return ok([])
  const spaces = await store.spacesFor(members.map((m) => ({ subjectId: m.subjectId, schoolId: m.schoolId })))
  if (!spaces.ok) return spaces
  if (spaces.value.length === 0) return ok([])
  const spaceIds = spaces.value.map((s) => s.id)
  const channels = await store.channels(spaceIds)
  if (!channels.ok) return channels

  const visible = spaces.value.flatMap((space): Visible[] => {
    const member = members.find((m) => m.subjectId === space.subjectId && m.schoolId === space.schoolId)
    const ofSpace = channels.value.filter((c) => c.spaceId === space.id)
    return member ? [{ space, member, channels: visibleChannels(member, ofSpace) }] : []
  })
  const snapshot = await loadSnapshot(
    store,
    personId,
    visible.flatMap((v) => v.channels),
    spaceIds
  )
  if (!snapshot.ok) return snapshot
  const authors = authorsFrom(people)
  const items = await Promise.all(
    visible.flatMap((v) => v.channels.map((channel) => itemOf(authors, v, channel, snapshot.value)))
  )
  return ok(items.filter((item) => item !== null).sort(newestFirst))
}
