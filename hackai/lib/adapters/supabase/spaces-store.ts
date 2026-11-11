/* Almacén de Espacios sobre Supabase: espacios, canales, mensajes, material y
   lo leído, en las tablas propias `spaces`, `space_channels`,
   `space_messages`, `space_material` y `space_reads`
   (supabase/migrations/0002_spaces.sql). Se porta como el almacén en memoria y
   pasa la misma batería de contrato (tests/contracts/spaces-store.test.ts).

   Cada consulta tiene tiempo máximo, y una caída o un error de la base vuelve
   como `falla-externa`, nunca como excepción. Los ids propios son uuid: un id
   con otra forma no puede existir, así que se contesta como no encontrado sin
   preguntarle a la base (que lo rechazaría con un error). Las fechas vuelven
   en ISO con milisegundos y `Z`, la forma en que las escribe el reloj. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createQueryRunner } from '@/lib/adapters/supabase/query'
import type {
  Attachment,
  ChannelKind,
  ChannelScope,
  MaterialLayout,
  Origin,
  SpacesStore,
  StoredChannel,
  StoredMaterial,
  StoredMessage,
  StoredSpace
} from '@/lib/core/spaces'
import { fail, ok } from '@/lib/result'

export type SupabaseSpacesStoreOptions = {
  client: SupabaseClient
  /** Tiempo máximo de cada consulta a la base. */
  timeoutMs?: number
  log?: (message: string) => void
}

type SpaceRow = {
  id: string
  subject_id: string
  subject_code: string
  school_id: string
  name: string
  material_layout: MaterialLayout
}

type ChannelRow = {
  id: string
  space_id: string
  name: string
  kind: ChannelKind
  scope_kind: ChannelScope['kind']
  section_id: string | null
  person_ids: string[] | null
  scope_key: string
  external_system: 'discord' | null
  external_channel_id: string | null
}

type MessageRow = {
  id: string
  seq: number | string
  channel_id: string
  author_id: string | null
  author_name: string | null
  text: string
  attachments: Attachment[]
  origin: Origin
  external_id: string | null
  status: StoredMessage['status']
  reply_to: string | null
  resolved: boolean | null
  created_at: string
}

type MaterialRow = {
  id: string
  seq: number | string
  space_id: string
  name: string
  url: string
  content_type: string
  size: number | string
  section: string | null
  origin: Origin
  external_id: string | null
  added_by: string | null
  added_at: string
}

const SPACE_COLUMNS = 'id, subject_id, subject_code, school_id, name, material_layout'
const CHANNEL_COLUMNS =
  'id, space_id, name, kind, scope_kind, section_id, person_ids, scope_key, external_system, external_channel_id'
const MESSAGE_COLUMNS =
  'id, seq, channel_id, author_id, author_name, text, attachments, origin, external_id, status, reply_to, resolved, created_at'
const MATERIAL_COLUMNS =
  'id, seq, space_id, name, url, content_type, size, section, origin, external_id, added_by, added_at'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (id: string) => UUID.test(id)
/** Los ids que pueden existir, sin repetir. */
const uuids = (ids: string[]) => [...new Set(ids.filter(isUuid))]

const iso = (value: string) => new Date(value).toISOString()

/** La clave del alcance de un canal: los nombres no se repiten dentro de un mismo alcance. */
function scopeKey(scope: ChannelScope): string {
  if (scope.kind === 'comision') return `comision:${scope.sectionId}`
  if (scope.kind === 'directo') return `directo:${[...scope.personIds].sort().join(':')}`
  return 'materia'
}

function toSpace(row: SpaceRow): StoredSpace {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    schoolId: row.school_id,
    name: row.name,
    materialLayout: row.material_layout
  }
}

function toScope(row: ChannelRow): ChannelScope {
  if (row.scope_kind === 'comision') return { kind: 'comision', sectionId: row.section_id ?? '' }
  if (row.scope_kind === 'directo') {
    const [a = '', b = ''] = row.person_ids ?? []
    return { kind: 'directo', personIds: [a, b] }
  }
  return { kind: 'materia' }
}

function toChannel(row: ChannelRow): StoredChannel {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    kind: row.kind,
    scope: toScope(row),
    externalLink:
      row.external_system && row.external_channel_id
        ? { system: row.external_system, channelId: row.external_channel_id }
        : null
  }
}

function channelRow(channel: Omit<StoredChannel, 'id'>): Omit<ChannelRow, 'id'> {
  const { scope } = channel
  return {
    space_id: channel.spaceId,
    name: channel.name,
    kind: channel.kind,
    scope_kind: scope.kind,
    section_id: scope.kind === 'comision' ? scope.sectionId : null,
    person_ids: scope.kind === 'directo' ? [...scope.personIds] : null,
    scope_key: scopeKey(scope),
    external_system: channel.externalLink?.system ?? null,
    external_channel_id: channel.externalLink?.channelId ?? null
  }
}

function toMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    seq: Number(row.seq),
    channelId: row.channel_id,
    authorId: row.author_id,
    authorName: row.author_name,
    text: row.text,
    attachments: row.attachments ?? [],
    origin: row.origin,
    externalId: row.external_id,
    status: row.status,
    replyTo: row.reply_to,
    resolved: row.resolved,
    createdAt: iso(row.created_at)
  }
}

function messageRow(message: Omit<StoredMessage, 'id' | 'seq'>): Omit<MessageRow, 'id' | 'seq'> {
  return {
    channel_id: message.channelId,
    author_id: message.authorId,
    author_name: message.authorName,
    text: message.text,
    attachments: message.attachments,
    origin: message.origin,
    external_id: message.externalId,
    status: message.status,
    reply_to: message.replyTo,
    resolved: message.resolved,
    created_at: message.createdAt
  }
}

function toMaterial(row: MaterialRow): StoredMaterial {
  return {
    id: row.id,
    seq: Number(row.seq),
    spaceId: row.space_id,
    name: row.name,
    url: row.url,
    contentType: row.content_type,
    size: Number(row.size),
    section: row.section,
    origin: row.origin,
    externalId: row.external_id,
    addedBy: row.added_by,
    addedAt: iso(row.added_at)
  }
}

function materialRow(item: Omit<StoredMaterial, 'id' | 'seq'>): Omit<MaterialRow, 'id' | 'seq'> {
  return {
    space_id: item.spaceId,
    name: item.name,
    url: item.url,
    content_type: item.contentType,
    size: item.size,
    section: item.section,
    origin: item.origin,
    external_id: item.externalId,
    added_by: item.addedBy,
    added_at: item.addedAt
  }
}

export function createSupabaseSpacesStore({
  client,
  timeoutMs = 5000,
  log = console.warn
}: SupabaseSpacesStoreOptions): SpacesStore {
  const run = createQueryRunner({ name: 'spaces-store', timeoutMs, log })

  /** El espacio de esa materia y facultad, si existe. */
  const spaceOf = (subjectId: string, schoolId: string) =>
    run<SpaceRow>('espacio de la materia', (s) =>
      client
        .from('spaces')
        .select(SPACE_COLUMNS)
        .eq('subject_id', subjectId)
        .eq('school_id', schoolId)
        .abortSignal(s)
        .maybeSingle()
    )

  return {
    async spacesFor(keys) {
      if (!keys.length) return ok([])
      const subjectIds = [...new Set(keys.map((k) => k.subjectId))]
      const schoolIds = [...new Set(keys.map((k) => k.schoolId))]
      const rows = await run<SpaceRow[]>('espacios', (s) =>
        client
          .from('spaces')
          .select(SPACE_COLUMNS)
          .in('subject_id', subjectIds)
          .in('school_id', schoolIds)
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      // Los dos `in` traen también cruces de materia y facultad que no se pidieron.
      const wanted = (row: SpaceRow) => keys.some((k) => k.subjectId === row.subject_id && k.schoolId === row.school_id)
      return ok((rows.value ?? []).filter(wanted).map(toSpace))
    },

    async space(spaceId) {
      if (!isUuid(spaceId)) return ok(null)
      const row = await run<SpaceRow>('espacio', (s) =>
        client.from('spaces').select(SPACE_COLUMNS).eq('id', spaceId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toSpace(row.value) : null)
    },

    async createSpace(space) {
      const created = await run<SpaceRow>('crear espacio', (s) =>
        client
          .from('spaces')
          .insert({
            subject_id: space.subjectId,
            subject_code: space.subjectCode,
            school_id: space.schoolId,
            name: space.name,
            material_layout: space.materialLayout
          })
          .select(SPACE_COLUMNS)
          .abortSignal(s)
          .single()
      )
      if (created.ok && created.value) return ok(toSpace(created.value))
      if (created.ok || created.error !== 'duplicado') return fail('falla-externa')
      // Ya existía, o alguien lo creó recién: se devuelve ese.
      const existing = await spaceOf(space.subjectId, space.schoolId)
      if (!existing.ok || !existing.value) return fail('falla-externa')
      return ok(toSpace(existing.value))
    },

    async setMaterialLayout(spaceId, layout) {
      if (!isUuid(spaceId)) return ok(null)
      const row = await run<SpaceRow>('organizar material', (s) =>
        client
          .from('spaces')
          .update({ material_layout: layout })
          .eq('id', spaceId)
          .select(SPACE_COLUMNS)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toSpace(row.value) : null)
    },

    async channels(spaceIds) {
      const ids = uuids(spaceIds)
      if (!ids.length) return ok([])
      const rows = await run<ChannelRow[]>('canales', (s) =>
        client.from('space_channels').select(CHANNEL_COLUMNS).in('space_id', ids).order('seq').abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toChannel))
    },

    async channel(channelId) {
      if (!isUuid(channelId)) return ok(null)
      const row = await run<ChannelRow>('canal', (s) =>
        client.from('space_channels').select(CHANNEL_COLUMNS).eq('id', channelId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toChannel(row.value) : null)
    },

    async createChannel(channel) {
      const row = await run<ChannelRow>('crear canal', (s) =>
        client.from('space_channels').insert(channelRow(channel)).select(CHANNEL_COLUMNS).abortSignal(s).single()
      )
      if (!row.ok) return fail(row.error)
      if (!row.value) return fail('falla-externa')
      return ok(toChannel(row.value))
    },

    async messages(channelIds) {
      const ids = uuids(channelIds)
      if (!ids.length) return ok([])
      const rows = await run<MessageRow[]>('mensajes', (s) =>
        client.from('space_messages').select(MESSAGE_COLUMNS).in('channel_id', ids).order('seq').abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toMessage))
    },

    async message(messageId) {
      if (!isUuid(messageId)) return ok(null)
      const row = await run<MessageRow>('mensaje', (s) =>
        client.from('space_messages').select(MESSAGE_COLUMNS).eq('id', messageId).abortSignal(s).maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toMessage(row.value) : null)
    },

    async addMessage(message) {
      const row = await run<MessageRow>('guardar mensaje', (s) =>
        client.from('space_messages').insert(messageRow(message)).select(MESSAGE_COLUMNS).abortSignal(s).single()
      )
      if (!row.ok) return fail(row.error)
      if (!row.value) return fail('falla-externa')
      return ok(toMessage(row.value))
    },

    async setResolved(messageId, resolved) {
      if (!isUuid(messageId)) return ok(null)
      const row = await run<MessageRow>('resolver consulta', (s) =>
        client
          .from('space_messages')
          .update({ resolved })
          .eq('id', messageId)
          .select(MESSAGE_COLUMNS)
          .abortSignal(s)
          .maybeSingle()
      )
      if (!row.ok) return fail('falla-externa')
      return ok(row.value ? toMessage(row.value) : null)
    },

    async material(spaceIds) {
      const ids = uuids(spaceIds)
      if (!ids.length) return ok([])
      const rows = await run<MaterialRow[]>('material', (s) =>
        client.from('space_material').select(MATERIAL_COLUMNS).in('space_id', ids).order('seq').abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      return ok((rows.value ?? []).map(toMaterial))
    },

    async addMaterial(item) {
      const row = await run<MaterialRow>('guardar material', (s) =>
        client.from('space_material').insert(materialRow(item)).select(MATERIAL_COLUMNS).abortSignal(s).single()
      )
      if (!row.ok) return fail(row.error)
      if (!row.value) return fail('falla-externa')
      return ok(toMaterial(row.value))
    },

    async readMarks(personId, channelIds) {
      const ids = uuids(channelIds)
      if (!ids.length) return ok({})
      const rows = await run<{ channel_id: string; last_seq: number | string }[]>('leídos', (s) =>
        client
          .from('space_reads')
          .select('channel_id, last_seq')
          .eq('person_id', personId)
          .in('channel_id', ids)
          .abortSignal(s)
      )
      if (!rows.ok) return fail('falla-externa')
      const marks: Record<string, number> = {}
      for (const row of rows.value ?? []) marks[row.channel_id] = Number(row.last_seq)
      return ok(marks)
    },

    async markRead(personId, channelId, seq) {
      // Un canal con otra forma de id no existe: no deja marca.
      if (!isUuid(channelId)) return ok(null)
      const done = await run<null>('marcar leído', (s) =>
        client.rpc('space_mark_read', { p_person_id: personId, p_channel_id: channelId, p_seq: seq }).abortSignal(s)
      )
      if (!done.ok) return fail('falla-externa')
      return ok(null)
    }
  }
}
