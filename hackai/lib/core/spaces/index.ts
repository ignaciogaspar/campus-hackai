/* Espacios (spaces): el espacio de la materia, con la sincronización con
   canales externos adentro. Interfaz y reglas en hackai/docs/ARQUITECTURA.md.

   - Un espacio por materia y facultad, creado la primera vez que alguien lo
     abre, con material de la materia y `#avisos` y `#consultas` por comisión.
   - La membresía se deduce de `sectionsOf` de Cursada; no se guarda aparte.
   - El alumno ve los canales de la materia y los de su comisión. En `#avisos`
     escriben solo los docentes de la comisión. Canales directos solo entre
     alumno y docente de la misma comisión.
   - Cada mensaje guarda su origen y su id externo y no entra dos veces. Si el
     envío al canal externo falla, queda pendiente y se reintenta.

   Usa Cursada, Personas y los puertos del canal externo, del aula virtual, de
   archivos y el reloj. */
import type { People, PersonId } from '@/lib/core/people'
import type { Studies } from '@/lib/core/studies'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalChannelPort } from '@/lib/ports/external-channel'
import type { FilesPort } from '@/lib/ports/files'
import { notImplemented, type ExternalFailure, type NotImplemented, type Result } from '@/lib/result'

export type SpaceId = string
export type ChannelId = string
export type MessageId = string

export type Origin = 'hackai' | 'discord' | 'moodle'

export type ChannelScope =
  | { kind: 'materia' }
  | { kind: 'comision'; sectionId: string }
  | { kind: 'directo'; personIds: [PersonId, PersonId] }

export type ExternalLink = { system: 'discord'; channelId: string }

export type Channel = {
  id: ChannelId
  spaceId: SpaceId
  name: string
  /** `material`, `avisos` y `consultas` son los canales por defecto; `libre`, los que crea un docente. */
  kind: 'material' | 'avisos' | 'consultas' | 'directo' | 'libre'
  scope: ChannelScope
  unread: number
  externalLink: ExternalLink | null
}

export type Attachment = { name: string; contentType: string; size: number; url: string }

export type Message = {
  id: MessageId
  channelId: ChannelId
  author: { personId: PersonId | null; name: string }
  text: string
  attachments: Attachment[]
  origin: Origin
  externalId: string | null
  /** `pendiente` si todavía no llegó al canal externo vinculado. */
  status: 'publicado' | 'pendiente'
  /** Mensaje al que responde, o `null`. */
  replyTo: MessageId | null
  /** Solo en `#consultas`: si el docente la marcó resuelta. */
  question: { resolved: boolean } | null
  createdAt: string
}

export type MaterialItem = {
  name: string
  url: string
  origin: Origin
  addedAt: string
}

export type Space = { id: SpaceId; subjectId: string; schoolId: string; name: string }

export type SpaceView = { space: Space; channels: Channel[]; material: MaterialItem[] }

export type ChannelView = { channel: Channel; messages: Message[] }

export type NewMessage = {
  text: string
  replyTo?: MessageId
  attachments?: { name: string; contentType: string; bytes: Uint8Array }[]
}

export type NewChannel = { name: string; scope: { kind: 'materia' } | { kind: 'comision'; sectionId: string } }

export type SyncReport = { channels: number; imported: number; sent: number; pending: number }

export type UnreadItem = {
  spaceId: SpaceId
  subjectId: string
  subjectName: string
  channelId: ChannelId
  channelName: string
  count: number
  latest: { text: string; origin: Origin; createdAt: string }
}

type AccessError = 'persona-desconocida' | 'sin-acceso' | NotImplemented

export type Spaces = {
  /** Trae lo nuevo del canal externo y de Moodle, y devuelve los canales que la persona ve, sus no leídos y el material. */
  open(personId: PersonId, subjectId: string): Promise<Result<SpaceView, 'materia-desconocida' | AccessError>>
  /** Mensajes del canal, con las consultas y sus respuestas; marca leído. */
  channel(personId: PersonId, channelId: ChannelId): Promise<Result<ChannelView, 'canal-desconocido' | AccessError>>
  /** Publica y lo envía al canal externo vinculado. Si el envío falla, queda pendiente. */
  post(personId: PersonId, channelId: ChannelId, message: NewMessage): Promise<Result<Message, 'canal-desconocido' | 'solo-docentes' | AccessError>>
  /** Marca una consulta como resuelta. */
  resolve(personId: PersonId, messageId: MessageId): Promise<Result<Message, 'mensaje-desconocido' | 'no-es-consulta' | 'solo-docentes' | AccessError>>
  /** Canal nuevo de la materia o de una comisión. Solo docentes. */
  createChannel(personId: PersonId, spaceId: SpaceId, channel: NewChannel): Promise<Result<Channel, 'espacio-desconocido' | 'solo-docentes' | 'nombre-repetido' | AccessError>>
  /** Canal directo entre un alumno y un docente de su comisión. */
  openDirect(personId: PersonId, otherPersonId: PersonId): Promise<Result<Channel, 'solo-alumno-docente' | 'sin-comision-en-comun' | AccessError>>
  /** Vincula un canal con uno del canal externo de la cátedra. Solo docentes. */
  link(personId: PersonId, channelId: ChannelId, external: ExternalLink): Promise<Result<Channel, 'canal-desconocido' | 'solo-docentes' | ExternalFailure | AccessError>>
  /** Sincroniza todos los canales vinculados: la corrida periódica. */
  syncAll(): Promise<Result<SyncReport, NotImplemented>>
  /** Novedades sin leer de todos sus espacios, para Hoy. */
  unreadFor(personId: PersonId): Promise<Result<UnreadItem[], 'persona-desconocida' | NotImplemented>>
}

export type SpacesDeps = {
  people: People
  studies: Studies
  externalChannel: ExternalChannelPort
  classroom: ClassroomPort
  files: FilesPort
  clock: ClockPort
}

export function createSpaces(_deps: SpacesDeps): Spaces {
  return {
    open: notImplemented,
    channel: notImplemented,
    post: notImplemented,
    resolve: notImplemented,
    createChannel: notImplemented,
    openDirect: notImplemented,
    link: notImplemented,
    syncAll: notImplemented,
    unreadFor: notImplemented,
  }
}
