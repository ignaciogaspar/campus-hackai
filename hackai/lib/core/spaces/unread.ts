/* Las novedades sin leer de una persona en todos sus espacios, para
   Novedades, Hoy y la navegación: por canal, cuánto no leyó y lo más nuevo,
   con quién lo publicó; en un directo, de quién es; y si todo es de un mismo
   hilo, cuál. Solo cuentan las comisiones actuales y los espacios que ya
   existen: pedir novedades no crea espacios. También marcarlas todas como
   leídas de una vez. */
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

/** El hilo de lo sin leer, si es uno solo y trae alguna respuesta. */
function threadOf(messages: StoredMessage[]): MessageId | null {
  const roots = new Set(messages.map((m) => m.replyTo ?? m.id))
  const hasReply = messages.some((m) => m.replyTo !== null)
  return roots.size === 1 && hasReply ? [...roots][0] : null
}

/** Si algo de lo sin leer responde a un hilo que abrió la persona. */
function repliesToMine(snapshot: Snapshot, unread: StoredMessage[]): boolean {
  const mine = new Set(snapshot.messages.filter((m) => m.authorId === snapshot.personId).map((m) => m.id))
  return unread.some((m) => m.replyTo !== null && mine.has(m.replyTo))
}

/** Las consultas sin leer que nadie más que quien preguntó respondió todavía, y no están resueltas. */
function unansweredIn(snapshot: Snapshot, channel: StoredChannel, unread: StoredMessage[]): number {
  if (channel.kind !== 'consultas') return 0
  const replies = snapshot.messages.filter((m) => m.channelId === channel.id && m.replyTo !== null)
  const answered = (question: StoredMessage) =>
    replies.some((r) => r.replyTo === question.id && r.authorId !== question.authorId)
  return unread.filter((m) => m.replyTo === null && m.resolved !== true && !answered(m)).length
}

/** El nombre de la comisión del canal, si es de una. */
function sectionNameOf(member: CurrentSpace['member'], channel: StoredChannel): string | null {
  const { scope } = channel
  if (scope.kind !== 'comision') return null
  return member.sections.find((s) => s.sectionId === scope.sectionId)?.name ?? null
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
    sectionName: sectionNameOf(member, channel),
    count: unread.count,
    latest,
    counterpart,
    thread: threadOf(unread.messages),
    repliedToMine: repliesToMine(snapshot, unread.messages),
    unanswered: unansweredIn(snapshot, channel, unread.messages)
  }
}

const newestFirst = (a: UnreadItem, b: UnreadItem) =>
  b.latest.createdAt.localeCompare(a.latest.createdAt) || a.subjectName.localeCompare(b.subjectName, 'es')

type UnreadDeps = { studies: Studies; people: People; store: SpacesStore }

/** Sus espacios actuales y qué leyó de cada canal. */
async function visibleWithSnapshot(
  { studies, store }: UnreadDeps,
  personId: PersonId
): Promise<Result<{ visible: CurrentSpace[]; snapshot: Snapshot | null }, 'persona-desconocida' | ExternalFailure>> {
  const found = await currentSpaces(studies, store, personId)
  if (!found.ok) return found
  const visible = found.value
  if (visible.length === 0) return ok({ visible, snapshot: null })
  const snapshot = await loadSnapshot(
    store,
    personId,
    visible.flatMap((v) => v.channels),
    visible.map((v) => v.space.id)
  )
  if (!snapshot.ok) return snapshot
  return ok({ visible, snapshot: snapshot.value })
}

/** Hasta qué `seq` llega un canal: su último mensaje o, en el de material, el último archivo del espacio. */
function lastSeqIn(snapshot: Snapshot, channel: StoredChannel): number {
  const seqs =
    channel.kind === 'material'
      ? snapshot.material.filter((m) => m.spaceId === channel.spaceId).map((m) => m.seq)
      : snapshot.messages.filter((m) => m.channelId === channel.id).map((m) => m.seq)
  return Math.max(0, ...seqs)
}

/** Marca leído todo lo que no leyó en sus espacios actuales. Devuelve cuántas novedades marcó. */
export async function markAllRead(
  deps: UnreadDeps,
  personId: PersonId
): Promise<Result<number, 'persona-desconocida' | ExternalFailure>> {
  const read = await visibleWithSnapshot(deps, personId)
  if (!read.ok) return read
  const { visible, snapshot } = read.value
  if (!snapshot) return ok(0)
  const pending = visible
    .flatMap((v) => v.channels)
    .map((channel) => ({ channel, count: unreadIn(snapshot, channel).count }))
    .filter((p) => p.count > 0)
  const marked = await Promise.all(
    pending.map((p) => deps.store.markRead(personId, p.channel.id, lastSeqIn(snapshot, p.channel)))
  )
  const failed = marked.find((m) => !m.ok)
  if (failed && !failed.ok) return failed
  return ok(pending.reduce((n, p) => n + p.count, 0))
}

export async function unreadFor(
  deps: UnreadDeps,
  personId: PersonId
): Promise<Result<UnreadItem[], 'persona-desconocida' | ExternalFailure>> {
  const { people } = deps
  const read = await visibleWithSnapshot(deps, personId)
  if (!read.ok) return read
  const { visible, snapshot } = read.value
  if (!snapshot) return ok([])
  const authors = authorsFrom(people)
  const items = await Promise.all(
    visible.flatMap((v) => v.channels.map((channel) => itemOf(authors, v, channel, snapshot)))
  )
  return ok(items.filter((item) => item !== null).sort(newestFirst))
}
