/* Lo leído y lo no leído. Cada persona tiene, por canal, hasta qué `seq` leyó;
   sin marca es 0. Sin leer es lo de otros con `seq` mayor que esa marca: en un
   canal, los mensajes; en el de material, los archivos del espacio. Lo propio
   nunca está sin leer. */
import type { PersonId } from '@/lib/core/people'
import type {
  ChannelId,
  SpaceId,
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredMaterial,
  StoredMessage
} from '@/lib/core/spaces'
import { ok, type Result } from '@/lib/result'

/** Lo que hace falta para saber qué no leyó una persona en unos canales. */
export type Snapshot = {
  personId: PersonId
  marks: Record<ChannelId, number>
  messages: StoredMessage[]
  material: StoredMaterial[]
}

export async function loadSnapshot(
  store: SpacesStore,
  personId: PersonId,
  channels: StoredChannel[],
  spaceIds: SpaceId[]
): Promise<Result<Snapshot, SpacesStoreError>> {
  const ids = channels.map((c) => c.id)
  const withMessages = channels.filter((c) => c.kind !== 'material').map((c) => c.id)
  const [marks, messages, material] = await Promise.all([
    store.readMarks(personId, ids),
    withMessages.length > 0 ? store.messages(withMessages) : Promise.resolve(ok<StoredMessage[]>([])),
    spaceIds.length > 0 ? store.material(spaceIds) : Promise.resolve(ok<StoredMaterial[]>([]))
  ])
  if (!marks.ok) return marks
  if (!messages.ok) return messages
  if (!material.ok) return material
  return ok({ personId, marks: marks.value, messages: messages.value, material: material.value })
}

export function markOf(snapshot: Snapshot, channelId: ChannelId): number {
  return snapshot.marks[channelId] ?? 0
}

export function isUnreadMessage(personId: PersonId, mark: number, message: StoredMessage): boolean {
  return message.seq > mark && message.authorId !== personId
}

export function isUnreadMaterial(personId: PersonId, mark: number, item: StoredMaterial): boolean {
  return item.seq > mark && item.addedBy !== personId
}

/** Lo que la persona no leyó en un canal: mensajes o, en el de material, archivos, por `seq`. */
export type UnreadIn = { count: number; messages: StoredMessage[]; material: StoredMaterial[] }

/** Lo que no leyó en el canal. */
export function unreadIn(snapshot: Snapshot, channel: StoredChannel): UnreadIn {
  const mark = markOf(snapshot, channel.id)
  if (channel.kind === 'material') {
    const material = snapshot.material.filter(
      (m) => m.spaceId === channel.spaceId && isUnreadMaterial(snapshot.personId, mark, m)
    )
    return { count: material.length, messages: [], material }
  }
  const messages = snapshot.messages.filter(
    (m) => m.channelId === channel.id && isUnreadMessage(snapshot.personId, mark, m)
  )
  return { count: messages.length, messages, material: [] }
}
