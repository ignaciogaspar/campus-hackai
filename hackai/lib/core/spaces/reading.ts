/* Lo leído y lo no leído. Cada persona tiene, por canal, hasta qué `seq` leyó;
   sin marca es 0. Sin leer es lo de otros con `seq` mayor que esa marca: en un
   canal, los mensajes; en el de material, los archivos del espacio. Lo propio
   nunca está sin leer. */
import type { PersonId } from '@/lib/core/people'
import { ok, type Result } from '@/lib/result'
import type {
  ChannelId,
  Origin,
  SpaceId,
  SpacesStore,
  SpacesStoreError,
  StoredChannel,
  StoredMaterial,
  StoredMessage
} from '.'

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

/** Una novedad, como la muestra Hoy: el texto del mensaje o el nombre del archivo. */
export type Latest = { text: string; origin: Origin; createdAt: string }

/** Cuántas cosas no leyó en el canal y la más nueva de ellas. */
export function unreadIn(snapshot: Snapshot, channel: StoredChannel): { count: number; latest: Latest | null } {
  const mark = markOf(snapshot, channel.id)
  const items: (Latest & { seq: number })[] =
    channel.kind === 'material'
      ? snapshot.material
          .filter((m) => m.spaceId === channel.spaceId && isUnreadMaterial(snapshot.personId, mark, m))
          .map((m) => ({ seq: m.seq, text: m.name, origin: m.origin, createdAt: m.addedAt }))
      : snapshot.messages
          .filter((m) => m.channelId === channel.id && isUnreadMessage(snapshot.personId, mark, m))
          .map((m) => ({ seq: m.seq, text: m.text, origin: m.origin, createdAt: m.createdAt }))
  if (items.length === 0) return { count: 0, latest: null }
  const newest = items.reduce((a, b) => (b.seq > a.seq ? b : a))
  return { count: items.length, latest: { text: newest.text, origin: newest.origin, createdAt: newest.createdAt } }
}
