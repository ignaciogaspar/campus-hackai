/* Implementación de Espacios. Se importa solo desde ./index.ts: desde afuera
   del módulo se usa su interfaz. Las piezas viven al lado: quién entra y qué
   puede hacer (access), los canales (channels), lo leído (reading), los
   autores (authors), los mensajes y sus hilos (messages) y el material
   (material). Los archivos guardados se entregan acá, con la misma regla de
   quién ve qué. La sincronización con el canal externo es su propia pieza
   (sync): `open` trae lo nuevo, `post` envía, `link` vincula y trae lo que ya
   había, y `syncAll` es la corrida periódica. Lo de Moodle todavía no entra (#16). */
import type { PersonId } from '@/lib/core/people'
import type {
  AccessError,
  Channel,
  ChannelId,
  ChannelView,
  ExternalLink,
  MaterialItem,
  MaterialView,
  Message,
  MessageId,
  NewChannel,
  NewMessage,
  Space,
  SpaceId,
  Spaces,
  SpacesDeps,
  SpacesStoreError,
  SpaceView,
  StoredAttachment,
  StoredChannel,
  StoredMessage,
  StoredSpace
} from '@/lib/core/spaces'
import {
  canLink,
  canManage,
  canResolve,
  type Membership,
  membershipInSpace,
  membershipOf,
  postRefusal,
  sees,
  teachesSection,
  viewerOf
} from '@/lib/core/spaces/access'
import { authorsFrom } from '@/lib/core/spaces/authors'
import { channelName, ensureChannels, nameTaken, toChannel, visibleChannels } from '@/lib/core/spaces/channels'
import { materialItems, materialView } from '@/lib/core/spaces/material'
import { threadsOf, toMessage } from '@/lib/core/spaces/messages'
import {
  isUnreadMessage,
  loadSnapshot,
  markOf,
  materialVersion,
  messagesVersion,
  unreadIn
} from '@/lib/core/spaces/reading'
import { addCounts, createSync } from '@/lib/core/spaces/sync'
import { unreadFor } from '@/lib/core/spaces/unread'
import { isFileId } from '@/lib/ports/files'
import { fail, notImplemented, ok, type Result } from '@/lib/result'

/** Un canal que la persona ve, con su espacio y su membresía. */
type InChannel = { channel: StoredChannel; space: StoredSpace; member: Membership }

function toSpace(space: StoredSpace): Space {
  const { id, subjectId, subjectCode, schoolId, name } = space
  return { id, subjectId, subjectCode, schoolId, name }
}

const maxSeq = (items: { seq: number }[]) => items.reduce((max, i) => Math.max(max, i.seq), 0)

export function createSpacesModule(deps: SpacesDeps): Spaces {
  const { people, studies, files, clock, store, externalChannel, timer } = deps
  const sync = createSync({ people, studies, externalChannel, files, store, timer })

  /** El espacio de la materia y facultad de la membresía; lo crea si no existe. */
  async function spaceOf(member: Membership): Promise<Result<StoredSpace, SpacesStoreError>> {
    const key = { subjectId: member.subjectId, schoolId: member.schoolId }
    const found = await store.spacesFor([key])
    if (!found.ok) return found
    if (found.value[0]) return ok(found.value[0])
    return store.createSpace({
      ...key,
      subjectCode: member.subjectCode,
      name: member.subjectName,
      materialLayout: 'unidad'
    })
  }

  async function spaceView(
    member: Membership,
    space: StoredSpace,
    channels: StoredChannel[]
  ): Promise<Result<SpaceView, SpacesStoreError>> {
    const visible = visibleChannels(member, channels)
    const snapshot = await loadSnapshot(store, member.personId, visible, [space.id])
    if (!snapshot.ok) return snapshot
    const materialChannel = visible.find((c) => c.kind === 'material')
    const mark = materialChannel ? markOf(snapshot.value, materialChannel.id) : 0
    const items = await materialItems(snapshot.value.material, authorsFrom(people), member.personId, mark)
    return ok({
      space: toSpace(space),
      viewer: viewerOf(member),
      channels: visible.map((c) => toChannel(member, c, unreadIn(snapshot.value, c).count)),
      material: materialView(space.materialLayout, items),
      staleSince: member.staleSince
    })
  }

  async function open(personId: PersonId, subjectId: string): Promise<Result<SpaceView, AccessError>> {
    const member = await membershipOf(studies, personId, subjectId)
    if (!member.ok) return member
    const space = await spaceOf(member.value)
    if (!space.ok) return space
    const channels = await ensureChannels(store, space.value, member.value)
    if (!channels.ok) return channels
    // Lo nuevo del canal externo vinculado. Si no responde, se muestra lo que ya hay.
    // Traer lo nuevo de Moodle va acá (#16).
    await sync.ifDue(space.value.id, channels.value)
    return spaceView(member.value, space.value, channels.value)
  }

  /** El canal, si existe y la persona lo ve. */
  async function inChannel(
    personId: PersonId,
    channelId: string
  ): Promise<Result<InChannel, 'canal-desconocido' | AccessError>> {
    const channel = await store.channel(channelId)
    if (!channel.ok) return channel
    if (!channel.value) return fail('canal-desconocido')
    const space = await store.space(channel.value.spaceId)
    if (!space.ok) return space
    if (!space.value) return fail('canal-desconocido')
    const member = await membershipInSpace(studies, personId, space.value)
    if (!member.ok) return member
    if (!sees(member.value, channel.value)) return fail('sin-acceso')
    return ok({ channel: channel.value, space: space.value, member: member.value })
  }

  /** El material del espacio, con lo que la persona no había visto; marca visto hasta el último. */
  async function readMaterial({ channel, space, member }: InChannel): Promise<Result<ChannelView, SpacesStoreError>> {
    const material = await materialFor(member, space, channel.id)
    if (!material.ok) return material
    const marked = await store.markRead(member.personId, channel.id, material.value.lastSeq)
    if (!marked.ok) return marked
    return ok({
      space: toSpace(space),
      channel: toChannel(member, channel, 0),
      version: materialVersion(material.value.lastSeq),
      threads: [],
      material: material.value.view
    })
  }

  /** Los hilos del canal, con lo que la persona no había leído; marca leído hasta el último. */
  async function readMessages({ channel, space, member }: InChannel): Promise<Result<ChannelView, SpacesStoreError>> {
    const [marks, stored] = await Promise.all([
      store.readMarks(member.personId, [channel.id]),
      store.messages([channel.id])
    ])
    if (!marks.ok) return marks
    if (!stored.ok) return stored
    const mark = marks.value[channel.id] ?? 0
    const authors = authorsFrom(people)
    const messages = await Promise.all(
      stored.value.map((m) => toMessage(m, authors, isUnreadMessage(member.personId, mark, m)))
    )
    const marked = await store.markRead(member.personId, channel.id, maxSeq(stored.value))
    if (!marked.ok) return marked
    return ok({
      space: toSpace(space),
      channel: toChannel(member, channel, 0),
      version: messagesVersion(stored.value),
      threads: threadsOf(messages),
      material: null
    })
  }

  /** La raíz del hilo al que responde: el mensaje tiene que ser de este canal. */
  async function threadRoot(
    channelId: string,
    replyTo: MessageId | undefined
  ): Promise<Result<MessageId | null, 'mensaje-desconocido' | SpacesStoreError>> {
    if (replyTo === undefined) return ok(null)
    const target = await store.message(replyTo)
    if (!target.ok) return target
    if (!target.value || target.value.channelId !== channelId) return fail('mensaje-desconocido')
    return ok(target.value.replyTo ?? target.value.id)
  }

  /** Borra archivos que quedaron sin nada que los referencie. Es lo mejor que se
      puede hacer: si el borrado falla, el error que importa es el original. */
  async function discard(fileIds: Array<string | null>): Promise<void> {
    await Promise.all(fileIds.map((id) => (id === null ? null : files.delete(id))))
  }

  /** Guarda los adjuntos con Archivos. Si uno falla, no se publica el mensaje y
      se borran los que ya se habían guardado. */
  async function saveAttachments(
    attachments: NonNullable<NewMessage['attachments']>
  ): Promise<Result<StoredAttachment[], 'demasiado-grande' | 'falla-externa'>> {
    const saved: StoredAttachment[] = []
    for (const attachment of attachments) {
      const file = await files.save(attachment)
      if (!file.ok) {
        await discard(saved.map((a) => a.fileId))
        return file
      }
      saved.push({
        name: file.value.name,
        contentType: file.value.contentType,
        size: file.value.size,
        url: file.value.url,
        fileId: file.value.id
      })
    }
    return ok(saved)
  }

  /** Guarda un mensaje ya validado y lo marca leído para quien lo escribió. En un canal
      vinculado se guarda pendiente y se envía enseguida; si el envío falla, queda pendiente. */
  async function publish(
    { channel, member }: InChannel,
    draft: { text: string; replyTo: MessageId | null; attachments: StoredAttachment[] }
  ): Promise<Result<Message, SpacesStoreError>> {
    // Un mensaje de primer nivel de un alumno en #consultas es una consulta.
    const isQuestion = channel.kind === 'consultas' && draft.replyTo === null && member.role === 'alumno'
    const added = await store.addMessage({
      ...draft,
      channelId: channel.id,
      authorId: member.personId,
      authorName: null,
      origin: 'hackai',
      externalId: null,
      status: channel.externalLink ? 'pendiente' : 'publicado',
      resolved: isQuestion ? false : null,
      createdAt: clock.now().toISOString()
    })
    if (!added.ok) {
      // Ningún mensaje referencia los adjuntos: no se dejan sueltos en Archivos.
      await discard(draft.attachments.map((a) => a.fileId))
      return fail('falla-externa')
    }
    const marked = await store.markRead(member.personId, channel.id, added.value.seq)
    if (!marked.ok) return marked
    if (!channel.externalLink) return ok(await toMessage(added.value, authorsFrom(people), false))
    await sync.sendPending(channel)
    const sent = await store.message(added.value.id)
    return ok(await toMessage(sent.ok && sent.value ? sent.value : added.value, authorsFrom(people), false))
  }

  const post: Spaces['post'] = async (personId, channelId, message) => {
    const found = await inChannel(personId, channelId)
    if (!found.ok) return found
    const refusal = postRefusal(found.value.member, found.value.channel)
    if (refusal) return fail(refusal)
    const text = message.text.trim()
    if (text === '' && !message.attachments?.length) return fail('mensaje-vacio')
    const replyTo = await threadRoot(channelId, message.replyTo)
    if (!replyTo.ok) return replyTo
    const attachments = await saveAttachments(message.attachments ?? [])
    if (!attachments.ok) return attachments
    return publish(found.value, { text, replyTo: replyTo.value, attachments: attachments.value })
  }

  /** El mensaje, si existe y la persona ve su canal. */
  async function inMessage(
    personId: PersonId,
    messageId: MessageId
  ): Promise<Result<InChannel & { message: StoredMessage }, 'mensaje-desconocido' | AccessError>> {
    const message = await store.message(messageId)
    if (!message.ok) return message
    if (!message.value) return fail('mensaje-desconocido')
    const found = await inChannel(personId, message.value.channelId)
    if (!found.ok) return fail(found.error === 'canal-desconocido' ? 'mensaje-desconocido' : found.error)
    return ok({ ...found.value, message: message.value })
  }

  /** El mensaje como lo ve la persona, con si lo leyó. */
  async function seenBy(personId: PersonId, message: StoredMessage): Promise<Result<Message, SpacesStoreError>> {
    const marks = await store.readMarks(personId, [message.channelId])
    if (!marks.ok) return marks
    const unread = isUnreadMessage(personId, marks.value[message.channelId] ?? 0, message)
    return ok(await toMessage(message, authorsFrom(people), unread))
  }

  const resolve: Spaces['resolve'] = async (personId, messageId) => {
    const found = await inMessage(personId, messageId)
    if (!found.ok) return found
    if (found.value.message.resolved === null) return fail('no-es-consulta')
    if (!canResolve(found.value.member, found.value.channel)) return fail('solo-docentes')
    const resolved = await store.setResolved(messageId, true)
    if (!resolved.ok) return resolved
    return resolved.value ? seenBy(personId, resolved.value) : fail('mensaje-desconocido')
  }

  /** El espacio, si existe y la persona es de su materia. */
  async function inSpace(
    personId: PersonId,
    spaceId: SpaceId
  ): Promise<Result<{ space: StoredSpace; member: Membership }, 'espacio-desconocido' | AccessError>> {
    const space = await store.space(spaceId)
    if (!space.ok) return space
    if (!space.value) return fail('espacio-desconocido')
    const member = await membershipInSpace(studies, personId, space.value)
    if (!member.ok) return member
    return ok({ space: space.value, member: member.value })
  }

  /** Crea un canal ya autorizado, si el nombre es válido y no choca con otro. */
  async function addChannel(
    member: Membership,
    space: StoredSpace,
    wanted: NewChannel
  ): Promise<Result<Channel, 'nombre-invalido' | 'nombre-repetido' | SpacesStoreError>> {
    const name = channelName(wanted.name)
    if (name === null) return fail('nombre-invalido')
    const existing = await store.channels([space.id])
    if (!existing.ok) return existing
    if (nameTaken(existing.value, name, wanted.scope)) return fail('nombre-repetido')
    const created = await store.createChannel({
      spaceId: space.id,
      name,
      kind: 'libre',
      scope: wanted.scope,
      externalLink: null
    })
    if (!created.ok) return fail(created.error === 'duplicado' ? 'nombre-repetido' : created.error)
    return ok(toChannel(member, created.value, 0))
  }

  const createChannel: Spaces['createChannel'] = async (personId, spaceId, wanted) => {
    const found = await inSpace(personId, spaceId)
    if (!found.ok) return found
    const { member, space } = found.value
    const allowed = wanted.scope.kind === 'materia' ? canManage(member) : teachesSection(member, wanted.scope.sectionId)
    if (!allowed) return fail('solo-docentes')
    return addChannel(member, space, wanted)
  }

  /** El material del espacio como lo ve la persona, con lo que no había visto según
      su marca en el canal de material, y el `seq` del último archivo. */
  async function materialFor(
    member: Membership,
    space: StoredSpace,
    channelId: ChannelId | null
  ): Promise<Result<{ view: MaterialView; lastSeq: number }, SpacesStoreError>> {
    const [marks, stored] = await Promise.all([
      store.readMarks(member.personId, channelId ? [channelId] : []),
      store.material([space.id])
    ])
    if (!marks.ok) return marks
    if (!stored.ok) return stored
    const mark = channelId ? (marks.value[channelId] ?? 0) : 0
    const items = await materialItems(stored.value, authorsFrom(people), member.personId, mark)
    return ok({ view: materialView(space.materialLayout, items), lastSeq: maxSeq(stored.value) })
  }

  /** El espacio, si la persona es docente de la materia. */
  async function managing(
    personId: PersonId,
    spaceId: SpaceId
  ): Promise<
    Result<{ space: StoredSpace; member: Membership }, 'espacio-desconocido' | 'solo-docentes' | AccessError>
  > {
    const found = await inSpace(personId, spaceId)
    if (!found.ok) return found
    return canManage(found.value.member) ? found : fail('solo-docentes')
  }

  const addMaterial: Spaces['addMaterial'] = async (personId, spaceId, material) => {
    const found = await managing(personId, spaceId)
    if (!found.ok) return found
    if (material.bytes.byteLength === 0) return fail('archivo-vacio')
    const file = await files.save(material)
    if (!file.ok) return file
    const added = await store.addMaterial({
      spaceId,
      name: file.value.name,
      url: file.value.url,
      fileId: file.value.id,
      contentType: file.value.contentType,
      size: file.value.size,
      section: material.section?.trim() || null,
      origin: 'hackai',
      externalId: null,
      addedBy: personId,
      addedAt: clock.now().toISOString()
    })
    if (!added.ok) {
      // Ningún material referencia el archivo: no se deja suelto en Archivos.
      await discard([file.value.id])
      return fail('falla-externa')
    }
    const [item] = await materialItems([added.value], authorsFrom(people), personId, 0)
    await announceMaterial(spaceId, item)
    return ok(item)
  }

  /** Avisa en el canal externo del material que se subió en HackAI, si el canal de
      material está vinculado. Es lo mejor que se puede hacer: el archivo ya está en
      HackAI y un aviso que no sale no se reintenta. */
  async function announceMaterial(spaceId: SpaceId, item: MaterialItem): Promise<void> {
    const channels = await store.channels([spaceId])
    const link = channels.ok ? channels.value.find((c) => c.kind === 'material')?.externalLink : null
    if (!link) return
    const where = item.section ? ` (${item.section})` : ''
    const who = item.addedBy ? `**${item.addedBy.name}** subió` : 'Se subió'
    await externalChannel.post(
      link.channelId,
      `${who} material en HackAI${where}:
📎 ${item.name}`
    )
  }

  /** El canal externo ya vinculado con otro canal de HackAI. */
  async function linkedElsewhere(
    channelId: ChannelId,
    external: ExternalLink
  ): Promise<Result<boolean, SpacesStoreError>> {
    const linked = await store.linkedChannels()
    if (!linked.ok) return linked
    const same = (c: StoredChannel) =>
      c.id !== channelId &&
      c.externalLink?.system === external.system &&
      c.externalLink.channelId === external.channelId
    return ok(linked.value.some(same))
  }

  /** El canal, si la persona puede vincularlo y el canal externo no está vinculado con otro. */
  async function linkable(
    personId: PersonId,
    channelId: ChannelId,
    external: ExternalLink
  ): Promise<Result<InChannel, 'canal-desconocido' | 'solo-docentes' | 'canal-externo-en-uso' | AccessError>> {
    const found = await inChannel(personId, channelId)
    if (!found.ok) return found
    if (!canLink(found.value.member, found.value.channel)) return fail('solo-docentes')
    const taken = await linkedElsewhere(channelId, external)
    if (!taken.ok) return taken
    return taken.value ? fail('canal-externo-en-uso') : found
  }

  const link: Spaces['link'] = async (personId, channelId, external) => {
    const found = await linkable(personId, channelId, external)
    if (!found.ok) return found
    const { member } = found.value
    // Leerlo desde el principio comprueba que existe y trae lo que ya tenía.
    const page = await externalChannel.read(external.channelId, null)
    if (!page.ok) return fail(page.error === 'canal-inexistente' ? 'canal-externo-inexistente' : page.error)
    const linked = await store.linkChannel(channelId, external)
    if (!linked.ok) return linked
    if (!linked.value) return fail('canal-desconocido')
    // Si traerlo falla, el cursor no avanzó: lo trae la próxima sincronización.
    await sync.importFirst(linked.value, page.value)
    return ok(toChannel(member, linked.value, 0))
  }

  const version: Spaces['version'] = async (channelId) => {
    const channel = await store.channel(channelId)
    if (!channel.ok) return channel
    if (!channel.value) return fail('canal-desconocido')
    const { spaceId, kind } = channel.value
    const channels = await store.channels([spaceId])
    if (!channels.ok) return channels
    await sync.ifDue(spaceId, channels.value)
    if (kind === 'material') {
      const material = await store.material([spaceId])
      return material.ok ? ok(materialVersion(maxSeq(material.value))) : material
    }
    const messages = await store.messages([channelId])
    return messages.ok ? ok(messagesVersion(messages.value)) : messages
  }

  const syncAll: Spaces['syncAll'] = async () => {
    const linked = await store.linkedChannels()
    if (!linked.ok) return linked
    const bySpace = Map.groupBy(linked.value, (c) => c.spaceId)
    let total = { imported: 0, sent: 0, pending: 0 }
    for (const [spaceId, channels] of bySpace) total = addCounts(total, await sync.now(spaceId, channels))
    return ok({ channels: linked.value.length, ...total })
  }

  const organizeMaterial: Spaces['organizeMaterial'] = async (personId, spaceId, layout) => {
    const found = await managing(personId, spaceId)
    if (!found.ok) return found
    const space = await store.setMaterialLayout(spaceId, layout)
    if (!space.ok) return space
    if (!space.value) return fail('espacio-desconocido')
    const channels = await store.channels([spaceId])
    if (!channels.ok) return channels
    const channel = channels.value.find((c) => c.kind === 'material')
    const material = await materialFor(found.value.member, space.value, channel?.id ?? null)
    return material.ok ? ok(material.value.view) : material
  }

  /** Si la persona ve el espacio o el canal del archivo. Un dueño que ya no existe
      es un archivo desconocido. */
  async function seesFile(
    personId: PersonId,
    fileId: string
  ): Promise<Result<null, 'archivo-desconocido' | AccessError>> {
    const owner = await store.fileOwner(fileId)
    if (!owner.ok) return owner
    if (!owner.value) return fail('archivo-desconocido')
    const found =
      owner.value.kind === 'material'
        ? await inSpace(personId, owner.value.spaceId)
        : await inChannel(personId, owner.value.channelId)
    if (found.ok) return ok(null)
    if (found.error === 'espacio-desconocido' || found.error === 'canal-desconocido') return fail('archivo-desconocido')
    return fail(found.error)
  }

  const file: Spaces['file'] = async (personId, fileId) => {
    if (!isFileId(fileId)) return fail('archivo-desconocido')
    const allowed = await seesFile(personId, fileId)
    if (!allowed.ok) return allowed
    const content = await files.read(fileId)
    if (!content.ok) return fail(content.error === 'no-encontrado' ? 'archivo-desconocido' : content.error)
    return content
  }

  return {
    open,
    resolve,
    async channel(personId, channelId) {
      const found = await inChannel(personId, channelId)
      if (!found.ok) return found
      return found.value.channel.kind === 'material' ? readMaterial(found.value) : readMessages(found.value)
    },
    version,
    post,
    createChannel,
    addMaterial,
    organizeMaterial,
    openDirect: notImplemented,
    link,
    syncAll,
    unreadFor: (personId) => unreadFor(studies, store, personId),
    file
  }
}
