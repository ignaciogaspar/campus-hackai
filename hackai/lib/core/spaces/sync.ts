/* La sincronización de los canales vinculados con el canal externo de la
   cátedra (ADR 0005). Es una pieza de Espacios: se usa desde `open`, `post`,
   `link` y `syncAll`, y nada de afuera la llama directo.

   - De ida: lo publicado en HackAI en un canal vinculado se guarda pendiente y
     se envía; si el envío falla, queda pendiente y se reintenta en la próxima
     sincronización, en el orden en que se publicó. Una respuesta va al hilo de
     su mensaje, y una consulta abre un hilo para que la respuesta quede junta.
   - De vuelta: se lee el canal externo desde el cursor guardado. En el canal
     de material, los adjuntos entran al material; en los demás, cada mensaje
     entra al canal, y si es de un hilo, como respuesta a su mensaje. El autor
     se busca en Personas por su id externo; si no está vinculado, queda el
     nombre con que llegó.
   - Las reglas de quién escribe valen también para lo que llega: en el canal
     de material solo entran los adjuntos de docentes de la materia, y en
     `#avisos`, los mensajes de docentes de la comisión. Un bot o un webhook
     (los configura quien administra el servidor) también entra. Un alumno o
     alguien sin cuenta vinculada no: el canal externo puede dejar escribir a
     todos, pero HackAI no lo publica.
   - Cada mensaje y cada archivo guarda su origen y su id externo, así nada
     entra dos veces: ni lo que vuelve de lo que envió HackAI, ni lo que se
     relee después de una sincronización cortada.
   - Los adjuntos se copian a Archivos al leerlos, porque las URLs de Discord
     vencen. Uno que ya venció queda con su enlace original.
   - El cursor avanza solo si se guardó todo lo leído: si algo falla a la
     mitad, la próxima sincronización relee desde el mismo punto.
   - Una sola sincronización a la vez por espacio, para no enviar dos veces el
     mismo pendiente; y desde `open`, no más de una cada `SYNC_EVERY_MS`. */
import type { People, PersonId } from '@/lib/core/people'
import type {
  ExternalLink,
  MessageId,
  SpaceId,
  SpacesStore,
  StoredAttachment,
  StoredChannel,
  StoredMessage
} from '@/lib/core/spaces'
import { canManage, membershipOf, postRefusal } from '@/lib/core/spaces/access'
import { authorsFrom } from '@/lib/core/spaces/authors'
import type { Studies } from '@/lib/core/studies'
import type {
  ExternalAttachment,
  ExternalChannelError,
  ExternalChannelPort,
  ExternalMessage,
  ExternalPage
} from '@/lib/ports/external-channel'
import type { FilesPort, StoredFile } from '@/lib/ports/files'
import { type ExternalFailure, fail, ok, type Result } from '@/lib/result'

/** Desde `open`, un espacio no se sincroniza más de una vez en este tiempo. */
export const SYNC_EVERY_MS = 5000

/** Lo más largo que acepta Discord en un mensaje. */
const MAX_TEXT = 2000

export type SyncCounts = { imported: number; sent: number; pending: number }

const NOTHING: SyncCounts = { imported: 0, sent: 0, pending: 0 }

export function addCounts(a: SyncCounts, b: SyncCounts): SyncCounts {
  return { imported: a.imported + b.imported, sent: a.sent + b.sent, pending: a.pending + b.pending }
}

export type SyncDeps = {
  people: People
  studies: Studies
  externalChannel: ExternalChannelPort
  files: FilesPort
  store: SpacesStore
  /** Milisegundos que avanzan siempre, aunque el reloj de la demo esté fijo. */
  timer: () => number
}

type Linked = StoredChannel & { externalLink: ExternalLink }

const isLinked = (channel: StoredChannel): channel is Linked => channel.externalLink !== null

/** Si el autor de un mensaje externo puede publicar en el canal. */
type Gate = (message: ExternalMessage, authorId: PersonId | null) => Promise<boolean>

export function createSync({ people, studies, externalChannel, files, store, timer }: SyncDeps) {
  /** La cola de cada espacio: lo que se sincroniza espera a lo anterior. */
  const queues = new Map<SpaceId, Promise<unknown>>()
  /** Cuándo empezó la última sincronización de cada espacio, según `timer`. */
  const lastSync = new Map<SpaceId, number>()

  function exclusive<T>(spaceId: SpaceId, run: () => Promise<T>): Promise<T> {
    const next = (queues.get(spaceId) ?? Promise.resolve()).then(run, run)
    const tail = next.catch(() => undefined)
    queues.set(spaceId, tail)
    void tail.then(() => {
      if (queues.get(spaceId) === tail) queues.delete(spaceId)
    })
    return next
  }

  /** Borra archivos que quedaron sin nada que los referencie. */
  async function discard(fileIds: Array<string | null>): Promise<void> {
    await Promise.all(fileIds.map((id) => (id === null ? null : files.delete(id))))
  }

  // De ida

  /** El texto que se envía: el texto, los nombres de los adjuntos y, al final, quién lo
      escribió en HackAI. El texto va primero porque Discord nombra el hilo de una
      consulta con la primera línea; el autor va en letra chica (`-#`, subtexto de Discord). */
  async function outgoingText(message: StoredMessage): Promise<string> {
    const author = await authorsFrom(people).ofMessage(message)
    const who = author.role === 'profesor' ? `${author.name} (docente)` : author.name
    const signature = `-# ${who} · desde HackAI`
    const body = [
      ...(message.text ? [message.text] : []),
      ...message.attachments.map((a) => `📎 ${a.name} (está en HackAI)`)
    ].join('\n')
    return `${body.slice(0, MAX_TEXT - signature.length - 1)}\n${signature}`
  }

  /** El id externo del mensaje al que responde. `null` si nunca va a tener uno (se
      publicó antes de vincular el canal): la respuesta va suelta. Si la raíz todavía
      está pendiente, falla, y la respuesta espera a que salga. */
  async function externalRoot(replyTo: MessageId): Promise<Result<string | null, ExternalFailure>> {
    const root = await store.message(replyTo)
    if (!root.ok) return root
    if (root.value?.externalId) return ok(root.value.externalId)
    return root.value?.status === 'pendiente' ? fail('falla-externa') : ok(null)
  }

  type Sent = Result<ExternalMessage, ExternalChannelError | 'mensaje-inexistente' | 'no-soportado'>

  async function sendReply(link: ExternalLink, replyTo: MessageId, text: string): Promise<Sent> {
    const root = await externalRoot(replyTo)
    if (!root.ok) return root
    if (root.value === null || !externalChannel.capabilities.threads) return externalChannel.post(link.channelId, text)
    const replied = await externalChannel.reply(link.channelId, root.value, text)
    // Si borraron el mensaje en el canal externo, la respuesta va suelta.
    return !replied.ok && replied.error === 'mensaje-inexistente' ? externalChannel.post(link.channelId, text) : replied
  }

  /** Envía un mensaje pendiente y lo marca publicado con su id externo. */
  async function sendOne(link: ExternalLink, message: StoredMessage): Promise<Result<null, ExternalFailure>> {
    const text = await outgoingText(message)
    const sent =
      message.replyTo === null
        ? await externalChannel.post(link.channelId, text)
        : await sendReply(link, message.replyTo, text)
    if (!sent.ok) return fail('falla-externa')
    // Una consulta abre su hilo. Si no se puede, igual llegó: se responde con «Responder».
    if (message.resolved !== null && externalChannel.capabilities.threads) {
      await externalChannel.openThread(link.channelId, sent.value.id)
    }
    const marked = await store.markSent(message.id, sent.value.id)
    return marked.ok ? ok(null) : fail('falla-externa')
  }

  /** Envía los pendientes del canal en el orden en que se publicaron. Se corta en
      el primero que falla, para que una respuesta no llegue antes que su mensaje. */
  async function sendPending(channel: Linked): Promise<SyncCounts> {
    const stored = await store.messages([channel.id])
    if (!stored.ok) return NOTHING
    const pending = stored.value.filter((m) => m.status === 'pendiente')
    let sent = 0
    for (const message of pending) {
      const done = await sendOne(channel.externalLink, message)
      if (!done.ok) break
      sent += 1
    }
    return { imported: 0, sent, pending: pending.length - sent }
  }

  // De vuelta

  /** La persona dueña de la cuenta externa, o el nombre con que llegó. */
  async function authorOf(
    link: ExternalLink,
    message: ExternalMessage
  ): Promise<{ authorId: PersonId | null; authorName: string | null }> {
    const owner = await people.byExternalAccount(link.system, message.author.id)
    return owner.ok && owner.value
      ? { authorId: owner.value, authorName: null }
      : { authorId: null, authorName: message.author.name }
  }

  /** Copia un adjunto a Archivos. `null` si su enlace ya venció o es más grande de lo que se guarda. */
  async function copyAttachment(attachment: ExternalAttachment): Promise<Result<StoredFile | null, ExternalFailure>> {
    const downloaded = await externalChannel.download(attachment)
    if (!downloaded.ok) return downloaded.error === 'adjunto-vencido' ? ok(null) : fail('falla-externa')
    const saved = await files.save({
      name: downloaded.value.filename,
      contentType: downloaded.value.contentType,
      bytes: downloaded.value.bytes
    })
    if (!saved.ok) return saved.error === 'demasiado-grande' ? ok(null) : fail(saved.error)
    return ok(saved.value)
  }

  /** Los adjuntos de un mensaje externo, copiados a Archivos. Uno que no se pudo copiar queda con su enlace. */
  async function copyAttachments(message: ExternalMessage): Promise<Result<StoredAttachment[], ExternalFailure>> {
    const copied: StoredAttachment[] = []
    for (const attachment of message.attachments) {
      const file = await copyAttachment(attachment)
      if (!file.ok) {
        await discard(copied.map((a) => a.fileId))
        return file
      }
      const { filename: name, contentType, size, url } = attachment
      copied.push(
        file.value
          ? {
              name: file.value.name,
              contentType: file.value.contentType,
              size: file.value.size,
              url: file.value.url,
              fileId: file.value.id
            }
          : { name, contentType, size, url, fileId: null }
      )
    }
    return ok(copied)
  }

  /** Si el mensaje externo es una consulta: uno de primer nivel en `#consultas` que no escribió un docente. */
  async function isQuestion(channel: StoredChannel, authorId: PersonId | null, replyTo: MessageId | null) {
    if (channel.kind !== 'consultas' || replyTo !== null) return false
    if (authorId === null) return true
    const person = await people.get(authorId)
    return !person.ok || person.value.role !== 'profesor'
  }

  /** Los mensajes del canal por id externo, para no importar dos veces y encontrar la raíz de un hilo. */
  async function byExternalId(channel: StoredChannel): Promise<Result<Map<string, StoredMessage>, ExternalFailure>> {
    const stored = await store.messages([channel.id])
    if (!stored.ok) return stored
    return ok(new Map(stored.value.filter((m) => m.externalId !== null).map((m) => [m.externalId!, m])))
  }

  /** El mensaje de HackAI al que responde, si es de un hilo cuyo mensaje ya entró. Si no, va suelto. */
  function threadRootOf(known: Map<string, StoredMessage>, message: ExternalMessage): MessageId | null {
    const root = message.threadId === null ? undefined : known.get(message.threadId)
    return root ? (root.replyTo ?? root.id) : null
  }

  /** Guarda un mensaje externo en el canal. Devuelve cuántos entraron: 0 si ya estaba. */
  async function importMessage(
    channel: Linked,
    known: Map<string, StoredMessage>,
    allowed: Gate,
    message: ExternalMessage
  ): Promise<Result<number, ExternalFailure>> {
    if (known.has(message.id)) return ok(0)
    const replyTo = threadRootOf(known, message)
    const author = await authorOf(channel.externalLink, message)
    if (!(await allowed(message, author.authorId))) return ok(0)
    const attachments = await copyAttachments(message)
    if (!attachments.ok) return attachments
    const added = await store.addMessage({
      channelId: channel.id,
      ...author,
      text: message.text,
      attachments: attachments.value,
      origin: channel.externalLink.system,
      externalId: message.id,
      status: 'publicado',
      replyTo,
      resolved: (await isQuestion(channel, author.authorId, replyTo)) ? false : null,
      createdAt: message.createdAt
    })
    if (!added.ok) {
      await discard(attachments.value.map((a) => a.fileId))
      return added.error === 'duplicado' ? ok(0) : fail(added.error)
    }
    known.set(message.id, added.value)
    return ok(1)
  }

  /** Copia un adjunto y lo guarda en el material. Devuelve cuántos entraron: 0 si ya
      estaba o si no se pudo copiar (su enlace vence y el material quedaría roto). */
  async function importAttachment(
    channel: Linked,
    message: ExternalMessage,
    attachment: ExternalAttachment,
    authorId: PersonId | null
  ): Promise<Result<number, ExternalFailure>> {
    const file = await copyAttachment(attachment)
    if (!file.ok) return file
    if (!file.value) return ok(0)
    const added = await store.addMaterial({
      spaceId: channel.spaceId,
      name: file.value.name,
      url: file.value.url,
      fileId: file.value.id,
      contentType: file.value.contentType,
      size: file.value.size,
      section: null,
      origin: channel.externalLink.system,
      externalId: attachment.id,
      addedBy: authorId,
      addedAt: message.createdAt
    })
    if (added.ok) return ok(1)
    await discard([file.value.id])
    return added.error === 'duplicado' ? ok(0) : fail(added.error)
  }

  /** Guarda en el material los adjuntos de un mensaje del canal de material. El texto no entra: el material no lleva mensajes. */
  async function importMaterial(
    channel: Linked,
    known: Set<string>,
    allowed: Gate,
    message: ExternalMessage
  ): Promise<Result<number, ExternalFailure>> {
    let imported = 0
    const { authorId } = await authorOf(channel.externalLink, message)
    if (!(await allowed(message, authorId))) return ok(0)
    for (const attachment of message.attachments.filter((a) => !known.has(a.id))) {
      const added = await importAttachment(channel, message, attachment, authorId)
      if (!added.ok) return added
      known.add(attachment.id)
      imported += added.value
    }
    return ok(imported)
  }

  /** Quién puede publicar en el canal lo que llega del canal externo: en el material,
      los docentes de la materia; en `#avisos`, los de la comisión; en el resto, todos.
      Bots y webhooks entran siempre. Se pregunta una vez por autor y lectura. */
  async function gateFor(channel: Linked): Promise<Result<Gate, ExternalFailure>> {
    if (channel.kind !== 'material' && channel.kind !== 'avisos') return ok(async () => true)
    const space = await store.space(channel.spaceId)
    if (!space.ok) return space
    const where = space.value
    if (!where) return ok(async () => false)
    const decided = new Map<PersonId, Promise<boolean>>()
    const decide = async (personId: PersonId) => {
      const member = await membershipOf(studies, personId, where.subjectId, where.schoolId)
      if (!member.ok) return false
      return channel.kind === 'material' ? canManage(member.value) : postRefusal(member.value, channel) === null
    }
    return ok(async (message, authorId) => {
      if (message.author.isBot) return true
      if (authorId === null) return false
      if (!decided.has(authorId)) decided.set(authorId, decide(authorId))
      return decided.get(authorId)!
    })
  }

  async function importer(
    channel: Linked
  ): Promise<Result<(message: ExternalMessage) => Promise<Result<number, ExternalFailure>>, ExternalFailure>> {
    const gate = await gateFor(channel)
    if (!gate.ok) return gate
    const allowed = gate.value
    if (channel.kind !== 'material') {
      const known = await byExternalId(channel)
      return known.ok ? ok((m) => importMessage(channel, known.value, allowed, m)) : known
    }
    const material = await store.material([channel.spaceId])
    if (!material.ok) return material
    const origin = channel.externalLink.system
    const known = new Set(material.value.filter((m) => m.origin === origin).map((m) => m.externalId ?? ''))
    return ok((m) => importMaterial(channel, known, allowed, m))
  }

  /** Guarda lo leído y avanza el cursor solo si entró todo. */
  async function importPage(channel: Linked, page: ExternalPage): Promise<Result<number, ExternalFailure>> {
    const importOne = await importer(channel)
    if (!importOne.ok) return importOne
    let imported = 0
    for (const message of page.messages) {
      const done = await importOne.value(message)
      if (!done.ok) return done
      imported += done.value
    }
    const saved = await store.setSyncCursor(channel.id, page.cursor)
    return saved.ok ? ok(imported) : saved
  }

  async function importNew(channel: Linked): Promise<SyncCounts> {
    const cursor = await store.syncCursor(channel.id)
    if (!cursor.ok) return NOTHING
    const page = await externalChannel.read(channel.externalLink.channelId, cursor.value)
    if (!page.ok) return NOTHING
    const imported = await importPage(channel, page.value)
    return { ...NOTHING, imported: imported.ok ? imported.value : 0 }
  }

  /** Primero envía lo pendiente y después trae lo nuevo: lo recién enviado vuelve con su id externo y no se duplica. */
  async function syncChannel(channel: Linked): Promise<SyncCounts> {
    const sent = await sendPending(channel)
    return addCounts(sent, await importNew(channel))
  }

  async function syncChannels(channels: Linked[]): Promise<SyncCounts> {
    let total = NOTHING
    for (const channel of channels) total = addCounts(total, await syncChannel(channel))
    return total
  }

  return {
    /** Sincroniza los canales vinculados de un espacio, salvo que se haya hecho hace menos de `SYNC_EVERY_MS`. */
    async ifDue(spaceId: SpaceId, channels: StoredChannel[]): Promise<void> {
      const linked = channels.filter(isLinked)
      if (!linked.length) return
      const now = timer()
      const last = lastSync.get(spaceId)
      if (last !== undefined && now - last < SYNC_EVERY_MS) return
      lastSync.set(spaceId, now)
      await exclusive(spaceId, () => syncChannels(linked))
    },

    /** Sincroniza los canales vinculados de un espacio ya, sin mirar cuándo fue la última vez. */
    now(spaceId: SpaceId, channels: StoredChannel[]): Promise<SyncCounts> {
      lastSync.set(spaceId, timer())
      return exclusive(spaceId, () => syncChannels(channels.filter(isLinked)))
    },

    /** Envía los pendientes de un canal, como después de publicar. */
    sendPending(channel: StoredChannel): Promise<SyncCounts> {
      return isLinked(channel) ? exclusive(channel.spaceId, () => sendPending(channel)) : Promise.resolve(NOTHING)
    },

    /** Trae una primera lectura del canal externo recién vinculado. */
    importFirst(channel: StoredChannel, page: ExternalPage): Promise<Result<number, ExternalFailure>> {
      if (!isLinked(channel)) return Promise.resolve(ok(0))
      return exclusive(channel.spaceId, () => importPage(channel, page))
    }
  }
}

export type Sync = ReturnType<typeof createSync>
