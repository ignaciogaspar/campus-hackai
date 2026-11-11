/* Espacios (spaces): el espacio de la materia, con la sincronización con
   canales externos adentro. Interfaz y reglas en hackai/docs/ARQUITECTURA.md.

   - Un espacio por materia y facultad, creado la primera vez que alguien lo
     abre, con material de la materia y `#avisos` y `#consultas` por comisión.
     Los canales de una comisión se crean la primera vez que alguien de esa
     comisión abre el espacio.
   - La membresía se deduce de `sectionsOf` de Cursada; no se guarda aparte.
   - El alumno ve los canales de la materia y los de su comisión. En `#avisos`
     escriben solo los docentes de la comisión; el material lo suben los
     docentes de la materia. Canales directos solo entre alumno y docente de la
     misma comisión.
   - Cada mensaje guarda su origen y su id externo y no entra dos veces. Si el
     envío al canal externo falla, queda pendiente y se reintenta.
   - Un archivo guardado (material o adjunto) se entrega solo a quien ve su
     espacio o su canal.

   Usa Cursada, Personas y los puertos del canal externo, del aula virtual, de
   archivos y el reloj. */
import type { People, PersonId, Role } from '@/lib/core/people'
import { createSpacesModule } from '@/lib/core/spaces/module'
import type { Studies } from '@/lib/core/studies'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalChannelPort } from '@/lib/ports/external-channel'
import type { FileContent, FilesError, FilesPort } from '@/lib/ports/files'
import type { ExternalFailure, NotImplemented, Result } from '@/lib/result'

export type SpaceId = string
export type ChannelId = string
export type MessageId = string
export type MaterialId = string

export type Origin = 'hackai' | 'discord' | 'moodle'

export type ChannelScope =
  | { kind: 'materia' }
  | { kind: 'comision'; sectionId: string }
  | { kind: 'directo'; personIds: [PersonId, PersonId] }

export type ChannelKind = 'material' | 'avisos' | 'consultas' | 'directo' | 'libre'

export type ExternalLink = { system: 'discord'; channelId: string }

/** Un canal visto por una persona: sus no leídos y lo que puede hacer en él. */
export type Channel = {
  id: ChannelId
  spaceId: SpaceId
  /** Sin `#`, en minúsculas y con guiones: `avisos`, `consultas`, `material`, `parciales-viejos`. */
  name: string
  /** `material`, `avisos` y `consultas` son los canales por defecto; `libre`, los que crea un docente. */
  kind: ChannelKind
  scope: ChannelScope
  /** Nombre de la comisión si el canal es de una comisión (`A`); si no, `null`. */
  sectionName: string | null
  /** Mensajes de otros que la persona no leyó. En el canal de material, archivos nuevos. */
  unread: number
  /** Si la persona puede publicar mensajes en el canal. En el de material nadie publica mensajes: el material se sube aparte. */
  canPost: boolean
  /** Si la persona puede marcar resueltas las consultas del canal. */
  canResolve: boolean
  externalLink: ExternalLink | null
}

export type Attachment = { name: string; contentType: string; size: number; url: string }

export type Author = {
  personId: PersonId | null
  name: string
  /** `null` si viene de un canal externo y no está vinculado a ninguna persona. */
  role: Role | null
}

export type Message = {
  id: MessageId
  channelId: ChannelId
  author: Author
  text: string
  attachments: Attachment[]
  origin: Origin
  externalId: string | null
  /** `pendiente` si todavía no llegó al canal externo vinculado. */
  status: 'publicado' | 'pendiente'
  /** Mensaje al que responde, o `null`. */
  replyTo: MessageId | null
  /** Solo las consultas de un alumno en `#consultas`: si el docente la marcó resuelta. */
  question: { resolved: boolean } | null
  /** Si la persona que mira no lo había leído. Lo propio nunca está sin leer. */
  unread: boolean
  createdAt: string
}

/** Un mensaje con sus respuestas, en orden. En `#consultas`, una consulta y su hilo. */
export type Thread = { message: Message; replies: Message[] }

export type MaterialItem = {
  id: MaterialId
  name: string
  url: string
  contentType: string
  /** En bytes; 0 si no se sabe, como en los recursos de Moodle. */
  size: number
  origin: Origin
  /** La unidad o el tema donde lo puso el docente, o `null`. */
  section: string | null
  addedBy: { personId: PersonId | null; name: string } | null
  addedAt: string
  /** Si la persona que mira no lo había visto. Lo que subió ella nunca está sin ver. */
  unread: boolean
}

/** Cómo organiza el material el docente: por unidad o tema, por semana, o sin secciones. */
export type MaterialLayout = 'unidad' | 'semana' | 'todo'

export type MaterialSection = { title: string; items: MaterialItem[] }

export type MaterialView = {
  layout: MaterialLayout
  /** Las secciones según `layout`, en el orden en que se muestran. Vacío si no hay material. */
  sections: MaterialSection[]
  /** Las unidades o temas ya usados, para elegir uno al subir. */
  sectionNames: string[]
  /** Los tres últimos archivos, el más nuevo primero. */
  recent: MaterialItem[]
}

export type Space = {
  id: SpaceId
  subjectId: string
  subjectCode: string
  schoolId: string
  /** El nombre de la materia. */
  name: string
}

/** Una comisión de la persona en este espacio, con sus docentes. */
export type SpaceSection = {
  sectionId: string
  name: string
  termName: string
  current: boolean
  teachers: { personId: PersonId | null; name: string }[]
}

/** Quién mira el espacio y qué puede hacer. */
export type SpaceViewer = {
  personId: PersonId
  role: Role
  /** Sus comisiones de esta materia y facultad: las actuales primero. */
  sections: SpaceSection[]
  /** Docente de alguna comisión del espacio: crea canales y sube y organiza el material. */
  canManage: boolean
}

export type SpaceView = {
  space: Space
  viewer: SpaceViewer
  /** Los canales que la persona ve, en el orden en que se muestran. */
  channels: Channel[]
  material: MaterialView
  /** Si la membresía salió de una lectura desactualizada de Cursada, su hora; si no, `null`. */
  staleSince: string | null
}

export type ChannelView = {
  space: Space
  channel: Channel
  /** Mensajes de primer nivel con sus respuestas, del más viejo al más nuevo. Vacío en el canal de material. */
  threads: Thread[]
  /** Solo en el canal de material: el material del espacio. */
  material: MaterialView | null
}

export type NewMessage = {
  text: string
  replyTo?: MessageId
  attachments?: { name: string; contentType: string; bytes: Uint8Array }[]
}

export type NewChannel = { name: string; scope: { kind: 'materia' } | { kind: 'comision'; sectionId: string } }

export type NewMaterial = { name: string; contentType: string; bytes: Uint8Array; section?: string | null }

export type SyncReport = { channels: number; imported: number; sent: number; pending: number }

export type UnreadItem = {
  spaceId: SpaceId
  subjectId: string
  subjectName: string
  channelId: ChannelId
  channelName: string
  kind: ChannelKind
  count: number
  latest: { text: string; origin: Origin; createdAt: string }
}

/** Por qué una persona no puede entrar: no existe, no es de la materia o Cursada no respondió. */
export type AccessError = 'persona-desconocida' | 'sin-acceso' | ExternalFailure

export type Spaces = {
  /** Trae lo nuevo del canal externo y de Moodle, y devuelve los canales que la persona ve, sus no leídos y el material.
      Crea el espacio y los canales de las comisiones de la persona si no existen. */
  open(personId: PersonId, subjectId: string): Promise<Result<SpaceView, AccessError>>
  /** Mensajes del canal, con las consultas y sus respuestas; marca leído. */
  channel(personId: PersonId, channelId: ChannelId): Promise<Result<ChannelView, 'canal-desconocido' | AccessError>>
  /** Publica y lo envía al canal externo vinculado. Si el envío falla, queda pendiente. El canal de
      material no lleva mensajes (`sin-mensajes`): el material se sube con `addMaterial`. */
  post(
    personId: PersonId,
    channelId: ChannelId,
    message: NewMessage
  ): Promise<
    Result<
      Message,
      | 'canal-desconocido'
      | 'solo-docentes'
      | 'sin-mensajes'
      | 'mensaje-vacio'
      | 'mensaje-desconocido'
      | FilesError
      | AccessError
    >
  >
  /** Marca una consulta como resuelta. Solo los docentes de su comisión. */
  resolve(
    personId: PersonId,
    messageId: MessageId
  ): Promise<Result<Message, 'mensaje-desconocido' | 'no-es-consulta' | 'solo-docentes' | AccessError>>
  /** Canal nuevo de la materia o de una comisión. Solo docentes: de la materia, o de esa comisión. */
  createChannel(
    personId: PersonId,
    spaceId: SpaceId,
    channel: NewChannel
  ): Promise<
    Result<Channel, 'espacio-desconocido' | 'solo-docentes' | 'nombre-invalido' | 'nombre-repetido' | AccessError>
  >
  /** Sube un archivo al material de la materia, con Archivos. Solo docentes de la materia. */
  addMaterial(
    personId: PersonId,
    spaceId: SpaceId,
    material: NewMaterial
  ): Promise<Result<MaterialItem, 'espacio-desconocido' | 'solo-docentes' | 'archivo-vacio' | FilesError | AccessError>>
  /** Cómo se organiza el material del espacio. Solo docentes de la materia. */
  organizeMaterial(
    personId: PersonId,
    spaceId: SpaceId,
    layout: MaterialLayout
  ): Promise<Result<MaterialView, 'espacio-desconocido' | 'solo-docentes' | AccessError>>
  /** Canal directo entre un alumno y un docente de su comisión. */
  openDirect(
    personId: PersonId,
    otherPersonId: PersonId
  ): Promise<Result<Channel, 'solo-alumno-docente' | 'sin-comision-en-comun' | AccessError | NotImplemented>>
  /** Vincula un canal con uno del canal externo de la cátedra. Solo docentes. */
  link(
    personId: PersonId,
    channelId: ChannelId,
    external: ExternalLink
  ): Promise<Result<Channel, 'canal-desconocido' | 'solo-docentes' | AccessError | NotImplemented>>
  /** Sincroniza todos los canales vinculados: la corrida periódica. */
  syncAll(): Promise<Result<SyncReport, NotImplemented>>
  /** Novedades sin leer de todos sus espacios, para Hoy y la navegación. No crea espacios. */
  unreadFor(personId: PersonId): Promise<Result<UnreadItem[], 'persona-desconocida' | ExternalFailure>>
  /** Los bytes de un archivo guardado, con el id que lleva su URL. Del material,
      para quien es del espacio; de un adjunto, para quien ve su canal. Un id que
      no es de ningún material ni adjunto es `archivo-desconocido`. */
  file(personId: PersonId, fileId: string): Promise<Result<FileContent, 'archivo-desconocido' | AccessError>>
}

// Almacén de Espacios: un seam interno, que se inyecta al armar el módulo y no
// es parte de su interfaz. Guarda espacios, canales, mensajes, material y hasta
// dónde leyó cada persona cada canal. No sabe de permisos: eso es del módulo.

/** Un espacio guardado. Único por materia y facultad. */
export type StoredSpace = {
  id: SpaceId
  subjectId: string
  subjectCode: string
  schoolId: string
  name: string
  materialLayout: MaterialLayout
}

/** Un canal guardado. Único por espacio, alcance y nombre (dos comisiones pueden tener cada una su `avisos`). */
export type StoredChannel = {
  id: ChannelId
  spaceId: SpaceId
  name: string
  kind: ChannelKind
  scope: ChannelScope
  externalLink: ExternalLink | null
}

/** Un adjunto guardado: con el id del archivo en Archivos, para saber de qué
    canal es al entregarlo, o `null` si no se copió a Archivos. */
export type StoredAttachment = Attachment & { fileId: string | null }

/** Un mensaje guardado. `seq` crece con cada mensaje que entra al almacén y ordena los mensajes y lo leído. */
export type StoredMessage = {
  id: MessageId
  seq: number
  channelId: ChannelId
  /** La persona de HackAI que lo escribió, o `null` si viene de un canal externo sin vincular. */
  authorId: PersonId | null
  /** El nombre con que llegó del canal externo; `null` si el autor es una persona de HackAI. */
  authorName: string | null
  text: string
  attachments: StoredAttachment[]
  origin: Origin
  externalId: string | null
  status: 'publicado' | 'pendiente'
  replyTo: MessageId | null
  /** `null` si no es una consulta. */
  resolved: boolean | null
  createdAt: string
}

/** Un archivo del material guardado. `seq` crece con cada archivo que entra al almacén. */
export type StoredMaterial = {
  id: MaterialId
  seq: number
  spaceId: SpaceId
  name: string
  url: string
  /** El id del archivo en Archivos, o `null` si es un enlace (de Moodle o de afuera). */
  fileId: string | null
  contentType: string
  size: number
  section: string | null
  origin: Origin
  externalId: string | null
  /** La persona que lo subió, o `null` si vino de Moodle o de un canal externo sin vincular. */
  addedBy: PersonId | null
  addedAt: string
}

export type SpacesStoreError = ExternalFailure

/** De quién es un archivo guardado: del material de un espacio o de un mensaje de un canal. */
export type FileOwner = { kind: 'material'; spaceId: SpaceId } | { kind: 'adjunto'; channelId: ChannelId }

export type SpacesStore = {
  /** Los espacios de esas materias y facultades que ya existen. */
  spacesFor(keys: { subjectId: string; schoolId: string }[]): Promise<Result<StoredSpace[], SpacesStoreError>>
  space(spaceId: SpaceId): Promise<Result<StoredSpace | null, SpacesStoreError>>
  /** Crea el espacio; si ya existe uno para esa materia y facultad, devuelve ese. */
  createSpace(space: Omit<StoredSpace, 'id'>): Promise<Result<StoredSpace, SpacesStoreError>>
  setMaterialLayout(spaceId: SpaceId, layout: MaterialLayout): Promise<Result<StoredSpace | null, SpacesStoreError>>

  /** Los canales de esos espacios, en el orden en que se crearon. */
  channels(spaceIds: SpaceId[]): Promise<Result<StoredChannel[], SpacesStoreError>>
  channel(channelId: ChannelId): Promise<Result<StoredChannel | null, SpacesStoreError>>
  /** Crea el canal; `duplicado` si ya hay uno con ese nombre en ese espacio y alcance. */
  createChannel(channel: Omit<StoredChannel, 'id'>): Promise<Result<StoredChannel, 'duplicado' | SpacesStoreError>>

  /** Los mensajes de esos canales, por `seq`. */
  messages(channelIds: ChannelId[]): Promise<Result<StoredMessage[], SpacesStoreError>>
  message(messageId: MessageId): Promise<Result<StoredMessage | null, SpacesStoreError>>
  /** Guarda un mensaje y le asigna id y `seq`. `duplicado` si ya hay uno con ese id externo en el canal. */
  addMessage(message: Omit<StoredMessage, 'id' | 'seq'>): Promise<Result<StoredMessage, 'duplicado' | SpacesStoreError>>
  setResolved(messageId: MessageId, resolved: boolean): Promise<Result<StoredMessage | null, SpacesStoreError>>

  /** El material de esos espacios, por `seq`. */
  material(spaceIds: SpaceId[]): Promise<Result<StoredMaterial[], SpacesStoreError>>
  /** Guarda un archivo del material y le asigna id y `seq`. `duplicado` si ya hay uno con ese origen e id externo en el espacio. */
  addMaterial(item: Omit<StoredMaterial, 'id' | 'seq'>): Promise<Result<StoredMaterial, 'duplicado' | SpacesStoreError>>
  /** De qué material o de qué mensaje es el archivo con ese id de Archivos; `null` si de ninguno. */
  fileOwner(fileId: string): Promise<Result<FileOwner | null, SpacesStoreError>>

  /** Hasta qué `seq` leyó la persona cada canal. Un canal que nunca abrió no aparece. */
  readMarks(personId: PersonId, channelIds: ChannelId[]): Promise<Result<Record<ChannelId, number>, SpacesStoreError>>
  /** Marca leído hasta `seq`. Nunca retrocede: un `seq` menor que el guardado no cambia nada. */
  markRead(personId: PersonId, channelId: ChannelId, seq: number): Promise<Result<null, SpacesStoreError>>
}

export type SpacesDeps = {
  people: People
  studies: Studies
  externalChannel: ExternalChannelPort
  classroom: ClassroomPort
  files: FilesPort
  clock: ClockPort
  store: SpacesStore
}

export function createSpaces(deps: SpacesDeps): Spaces {
  return createSpacesModule(deps)
}
