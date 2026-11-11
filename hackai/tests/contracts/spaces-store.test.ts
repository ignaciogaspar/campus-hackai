/* Batería de contrato del almacén de Espacios (el seam `SpacesStore`). La
   misma corre contra el almacén en memoria, contra el de Supabase con un
   PostgREST de mentira (sin red), y contra una base de prueba de verdad solo
   si están HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY,
   con supabase/migrations/0002_spaces.sql aplicada.

   Contra la base de verdad cada prueba usa materias y personas con un id
   propio de la corrida, para no chocar con datos de corridas anteriores, y al
   final borra los espacios que creó (sus canales, mensajes y material se
   borran en cascada). Los ids y los `seq` que asigna la base no se comparan
   por valor: solo su forma y su orden. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { createSupabaseSpacesStore } from '@/lib/adapters/supabase/spaces-store'
import type { SpacesStore, StoredChannel, StoredMaterial, StoredMessage, StoredSpace } from '@/lib/core/spaces'
import type { Result } from '@/lib/result'
import {
  createFakePostgrest,
  type FakeRow,
  invalidUuid,
  isUuid,
  PostgrestError
} from '@/tests/contracts/fake-postgrest'

/** El valor de un Result que tiene que haber salido bien. */
function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const CREATED_AT = '2026-11-11T13:00:00.000Z'
const RUN = randomUUID().slice(0, 8)

/** Ids de materia y de persona propios de cada prueba. */
function fresh() {
  const tag = `prueba-${RUN}-${randomUUID().slice(0, 8)}`
  return {
    subject: (n: number) => `${tag}-materia-${n}`,
    person: (n: number) => `${tag}-persona-${n}`
  }
}

type Ids = ReturnType<typeof fresh>

const spaceOf = (ids: Ids, n = 1, schoolId = 'fi'): Omit<StoredSpace, 'id'> => ({
  subjectId: ids.subject(n),
  subjectCode: `MAT${n}`,
  schoolId,
  name: `Materia ${n}`,
  materialLayout: 'unidad'
})

const channelOf = (spaceId: string, name: string, scope: StoredChannel['scope']): Omit<StoredChannel, 'id'> => ({
  spaceId,
  name,
  kind: name === 'avisos' || name === 'consultas' || name === 'material' ? name : 'libre',
  scope,
  externalLink: null
})

const messageOf = (channelId: string, fields: Partial<StoredMessage> = {}): Omit<StoredMessage, 'id' | 'seq'> => ({
  channelId,
  authorId: 'p-docente',
  authorName: null,
  text: 'Mañana no hay clase.',
  attachments: [],
  origin: 'hackai',
  externalId: null,
  status: 'publicado',
  replyTo: null,
  resolved: null,
  createdAt: CREATED_AT,
  ...fields
})

const materialOf = (spaceId: string, fields: Partial<StoredMaterial> = {}): Omit<StoredMaterial, 'id' | 'seq'> => ({
  spaceId,
  name: 'Guía 1.pdf',
  url: 'https://archivos.test/guia-1.pdf',
  fileId: null,
  contentType: 'application/pdf',
  size: 120_000,
  section: 'Unidad 1',
  origin: 'hackai',
  externalId: null,
  addedBy: 'p-docente',
  addedAt: CREATED_AT,
  ...fields
})

const withoutIds = <T extends { id: string; seq?: number }>({ id: _id, seq: _seq, ...rest }: T) => rest

function spacesStoreContract(name: string, make: () => SpacesStore, skip: string | false = false) {
  const it = (title: string, fn: (store: SpacesStore, ids: Ids) => Promise<void>) =>
    test(`${name}: ${title}`, { skip }, () => fn(make(), fresh()))

  /** Un espacio recién creado. */
  const newSpace = async (store: SpacesStore, ids: Ids, n = 1) => value(await store.createSpace(spaceOf(ids, n)))

  it('crea un espacio y lo encuentra por id y por materia y facultad', async (store, ids) => {
    const space = await newSpace(store, ids)
    assert.deepEqual(withoutIds(space), spaceOf(ids))
    assert.deepEqual(value(await store.space(space.id)), space)
    assert.deepEqual(value(await store.spacesFor([{ subjectId: ids.subject(1), schoolId: 'fi' }])), [space])
  })

  it('crear un espacio que ya existe devuelve el que estaba', async (store, ids) => {
    const first = await newSpace(store, ids)
    const again = value(await store.createSpace({ ...spaceOf(ids), name: 'Otro nombre', materialLayout: 'semana' }))
    assert.deepEqual(again, first)
    assert.deepEqual(value(await store.spacesFor([{ subjectId: ids.subject(1), schoolId: 'fi' }])), [first])
  })

  it('la misma materia en otra facultad es otro espacio', async (store, ids) => {
    const fi = await newSpace(store, ids)
    const fce = value(await store.createSpace(spaceOf(ids, 1, 'fce')))
    assert.notEqual(fce.id, fi.id)
  })

  it('trae solo los espacios pedidos, sin cruzar materias y facultades', async (store, ids) => {
    const a = await newSpace(store, ids, 1)
    const b = value(await store.createSpace(spaceOf(ids, 2, 'fce')))
    await store.createSpace(spaceOf(ids, 1, 'fce'))
    const found = value(
      await store.spacesFor([
        { subjectId: ids.subject(1), schoolId: 'fi' },
        { subjectId: ids.subject(2), schoolId: 'fce' },
        { subjectId: ids.subject(3), schoolId: 'fi' }
      ])
    )
    const byId = (x: StoredSpace, y: StoredSpace) => x.id.localeCompare(y.id)
    assert.deepEqual(found.sort(byId), [a, b].sort(byId))
  })

  it('cambia cómo se organiza el material', async (store, ids) => {
    const space = await newSpace(store, ids)
    assert.deepEqual(value(await store.setMaterialLayout(space.id, 'semana')), { ...space, materialLayout: 'semana' })
    assert.equal(value(await store.space(space.id))?.materialLayout, 'semana')
  })

  it('lo que no existe vuelve como null, tenga o no forma de id', async (store) => {
    for (const id of ['no-existe', randomUUID()]) {
      assert.equal(value(await store.space(id)), null)
      assert.equal(value(await store.channel(id)), null)
      assert.equal(value(await store.message(id)), null)
      assert.equal(value(await store.setMaterialLayout(id, 'todo')), null)
      assert.equal(value(await store.setResolved(id, true)), null)
    }
  })

  it('las lecturas de listas vacías o de ids que no existen vuelven vacías', async (store, ids) => {
    assert.deepEqual(value(await store.spacesFor([])), [])
    assert.deepEqual(value(await store.channels([])), [])
    assert.deepEqual(value(await store.messages([])), [])
    assert.deepEqual(value(await store.material([])), [])
    assert.deepEqual(value(await store.readMarks(ids.person(1), [])), {})
    assert.deepEqual(value(await store.channels(['no-existe', randomUUID()])), [])
    assert.deepEqual(value(await store.messages(['no-existe', randomUUID()])), [])
    assert.deepEqual(value(await store.material(['no-existe', randomUUID()])), [])
    assert.deepEqual(value(await store.readMarks(ids.person(1), ['no-existe', randomUUID()])), {})
  })

  it('guarda los canales con su alcance y su vínculo, y los devuelve en el orden en que se crearon', async (store, ids) => {
    const space = await newSpace(store, ids)
    const other = await newSpace(store, ids, 2)
    const wanted: Omit<StoredChannel, 'id'>[] = [
      channelOf(space.id, 'material', { kind: 'materia' }),
      {
        ...channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-a' }),
        externalLink: { system: 'discord', channelId: '1300000000000000101' }
      },
      channelOf(space.id, 'consultas', { kind: 'comision', sectionId: 'com-a' }),
      {
        ...channelOf(space.id, 'directo', { kind: 'directo', personIds: [ids.person(2), ids.person(1)] }),
        kind: 'directo'
      }
    ]
    const created: StoredChannel[] = []
    for (const channel of wanted) created.push(value(await store.createChannel(channel)))
    await store.createChannel(channelOf(other.id, 'material', { kind: 'materia' }))

    assert.deepEqual(created.map(withoutIds), wanted)
    assert.equal(new Set(created.map((c) => c.id)).size, created.length)
    assert.deepEqual(value(await store.channel(created[1].id)), created[1])
    assert.deepEqual(value(await store.channels([space.id])), created)
  })

  it('el nombre de un canal no se repite dentro de su alcance, pero sí entre alcances', async (store, ids) => {
    const space = await newSpace(store, ids)
    const other = await newSpace(store, ids, 2)
    value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-a' })))
    value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-b' })))
    value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'materia' })))
    value(await store.createChannel(channelOf(other.id, 'avisos', { kind: 'comision', sectionId: 'com-a' })))
    assert.deepEqual(
      await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-a' })),
      { ok: false, error: 'duplicado' }
    )
    assert.deepEqual(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'materia' })), {
      ok: false,
      error: 'duplicado'
    })
    assert.equal(value(await store.channels([space.id])).length, 3)
  })

  it('un canal directo es el mismo sin importar el orden de las dos personas', async (store, ids) => {
    const space = await newSpace(store, ids)
    const direct = (personIds: [string, string]) => ({
      ...channelOf(space.id, 'directo', { kind: 'directo', personIds }),
      kind: 'directo' as const
    })
    value(await store.createChannel(direct([ids.person(1), ids.person(2)])))
    assert.deepEqual(await store.createChannel(direct([ids.person(2), ids.person(1)])), {
      ok: false,
      error: 'duplicado'
    })
    value(await store.createChannel(direct([ids.person(1), ids.person(3)])))
  })

  it('guarda los mensajes con id y seq nuevos, y los devuelve por seq', async (store, ids) => {
    const space = await newSpace(store, ids)
    const avisos = value(
      await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-a' }))
    )
    const consultas = value(
      await store.createChannel(channelOf(space.id, 'consultas', { kind: 'comision', sectionId: 'com-a' }))
    )
    const question = messageOf(consultas.id, { authorId: ids.person(1), text: '¿Entra la unidad 3?', resolved: false })
    const first = value(await store.addMessage(messageOf(avisos.id)))
    const second = value(await store.addMessage(question))
    const fromDiscord = messageOf(avisos.id, {
      authorId: null,
      authorName: 'lucia.b',
      text: 'Subí el apunte',
      origin: 'discord',
      externalId: '1310000000000000001',
      attachments: [
        {
          name: 'apunte.pdf',
          contentType: 'application/pdf',
          size: 2048,
          url: 'https://cdn.test/apunte.pdf',
          fileId: randomUUID()
        }
      ]
    })
    const third = value(await store.addMessage(fromDiscord))
    const reply = messageOf(consultas.id, { text: 'Sí, entra.', replyTo: second.id, status: 'pendiente' })
    const fourth = value(await store.addMessage(reply))

    const all = [first, second, third, fourth]
    assert.deepEqual(all.map(withoutIds), [messageOf(avisos.id), question, fromDiscord, reply])
    assert.equal(new Set(all.map((m) => m.id)).size, 4)
    for (let i = 1; i < all.length; i++) assert.ok(all[i].seq > all[i - 1].seq, 'el seq crece con cada mensaje')
    assert.ok(all.every((m) => Number.isInteger(m.seq)))

    assert.deepEqual(value(await store.message(third.id)), third)
    assert.deepEqual(value(await store.messages([consultas.id, avisos.id])), all)
    assert.deepEqual(value(await store.messages([avisos.id])), [first, third])
  })

  it('un mensaje con el mismo id externo no entra dos veces al mismo canal, pero sí a otro', async (store, ids) => {
    const space = await newSpace(store, ids)
    const a = value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-a' })))
    const b = value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'comision', sectionId: 'com-b' })))
    const external = { origin: 'discord' as const, externalId: '1310000000000000002', authorId: null, authorName: 'x' }
    value(await store.addMessage(messageOf(a.id, external)))
    assert.deepEqual(await store.addMessage(messageOf(a.id, external)), { ok: false, error: 'duplicado' })
    value(await store.addMessage(messageOf(b.id, external)))
    // Sin id externo, nunca es repetido.
    value(await store.addMessage(messageOf(a.id)))
    value(await store.addMessage(messageOf(a.id)))
    assert.equal(value(await store.messages([a.id])).length, 3)
  })

  it('marca una consulta resuelta y la vuelve a abrir', async (store, ids) => {
    const space = await newSpace(store, ids)
    const consultas = value(
      await store.createChannel(channelOf(space.id, 'consultas', { kind: 'comision', sectionId: 'com-a' }))
    )
    const question = value(await store.addMessage(messageOf(consultas.id, { resolved: false })))
    assert.deepEqual(value(await store.setResolved(question.id, true)), { ...question, resolved: true })
    assert.deepEqual(value(await store.message(question.id)), { ...question, resolved: true })
    assert.deepEqual(value(await store.setResolved(question.id, false)), question)
  })

  it('guarda el material con id y seq nuevos, y lo devuelve por seq y por espacio', async (store, ids) => {
    const space = await newSpace(store, ids)
    const other = await newSpace(store, ids, 2)
    const guide = materialOf(space.id, { fileId: randomUUID() })
    const fromMoodle = materialOf(space.id, {
      name: 'Programa.pdf',
      section: null,
      origin: 'moodle',
      externalId: '501',
      addedBy: null,
      size: 3_500_000_000
    })
    const first = value(await store.addMaterial(guide))
    value(await store.addMaterial(materialOf(other.id)))
    const second = value(await store.addMaterial(fromMoodle))
    assert.deepEqual([first, second].map(withoutIds), [guide, fromMoodle])
    assert.notEqual(first.id, second.id)
    assert.ok(second.seq > first.seq, 'el seq crece con cada archivo')
    assert.deepEqual(value(await store.material([space.id])), [first, second])
    assert.equal(value(await store.material([space.id, other.id])).length, 3)
  })

  it('un archivo con el mismo origen e id externo no entra dos veces al mismo espacio', async (store, ids) => {
    const space = await newSpace(store, ids)
    const other = await newSpace(store, ids, 2)
    const moodle = { origin: 'moodle' as const, externalId: '502', addedBy: null }
    value(await store.addMaterial(materialOf(space.id, moodle)))
    assert.deepEqual(await store.addMaterial(materialOf(space.id, moodle)), { ok: false, error: 'duplicado' })
    value(await store.addMaterial(materialOf(space.id, { ...moodle, origin: 'discord' })))
    value(await store.addMaterial(materialOf(other.id, moodle)))
    value(await store.addMaterial(materialOf(space.id)))
    value(await store.addMaterial(materialOf(space.id)))
    assert.equal(value(await store.material([space.id])).length, 4)
  })

  it('sabe de qué material o de qué mensaje es cada archivo guardado', async (store, ids) => {
    const space = await newSpace(store, ids)
    const other = await newSpace(store, ids, 2)
    const consultas = value(
      await store.createChannel(channelOf(space.id, 'consultas', { kind: 'comision', sectionId: 'com-a' }))
    )
    const [guide, photo, sheet] = [randomUUID(), randomUUID(), randomUUID()]
    const attachment = (fileId: string | null, name: string) => ({
      name,
      contentType: 'image/png',
      size: 10,
      url: `https://cdn.test/${name}`,
      fileId
    })
    value(await store.addMaterial(materialOf(space.id, { origin: 'moodle', externalId: '7', addedBy: null })))
    value(await store.addMaterial(materialOf(other.id, { fileId: guide })))
    value(await store.addMessage(messageOf(consultas.id, { attachments: [attachment(null, 'enlace.png')] })))
    value(
      await store.addMessage(
        messageOf(consultas.id, { attachments: [attachment(sheet, 'hoja.png'), attachment(photo, 'foto.png')] })
      )
    )

    assert.deepEqual(value(await store.fileOwner(guide)), { kind: 'material', spaceId: other.id })
    assert.deepEqual(value(await store.fileOwner(photo)), { kind: 'adjunto', channelId: consultas.id })
    assert.deepEqual(value(await store.fileOwner(sheet)), { kind: 'adjunto', channelId: consultas.id })
  })

  it('un archivo que no es de ningún material ni mensaje no tiene dueño', async (store, ids) => {
    const space = await newSpace(store, ids)
    value(await store.addMaterial(materialOf(space.id)))
    for (const id of ['no-existe', randomUUID()]) assert.equal(value(await store.fileOwner(id)), null)
  })

  it('guarda hasta dónde leyó cada persona cada canal, sin retroceder nunca', async (store, ids) => {
    const space = await newSpace(store, ids)
    const a = value(await store.createChannel(channelOf(space.id, 'avisos', { kind: 'materia' })))
    const b = value(await store.createChannel(channelOf(space.id, 'consultas', { kind: 'materia' })))
    const c = value(await store.createChannel(channelOf(space.id, 'libre', { kind: 'materia' })))
    const [me, other] = [ids.person(1), ids.person(2)]

    assert.deepEqual(value(await store.readMarks(me, [a.id, b.id])), {})
    assert.deepEqual(await store.markRead(me, a.id, 5), { ok: true, value: null })
    value(await store.markRead(me, a.id, 3))
    value(await store.markRead(me, b.id, 0))
    value(await store.markRead(other, a.id, 9))
    value(await store.markRead(me, c.id, 7))

    assert.deepEqual(value(await store.readMarks(me, [a.id, b.id])), { [a.id]: 5, [b.id]: 0 })
    assert.deepEqual(value(await store.readMarks(other, [a.id, b.id, c.id])), { [a.id]: 9 })
    value(await store.markRead(me, a.id, 8))
    assert.deepEqual(value(await store.readMarks(me, [a.id])), { [a.id]: 8 })
  })

  it('marcar leído un canal que no existe no deja marca', async (store, ids) => {
    for (const id of ['no-existe', randomUUID()]) {
      assert.deepEqual(await store.markRead(ids.person(1), id, 4), { ok: true, value: null })
      assert.deepEqual(value(await store.readMarks(ids.person(1), [id])), {})
    }
  })
}

// --- El PostgREST de mentira con las tablas de 0002_spaces.sql -------------

/** Las tablas de 0002_spaces.sql, con las columnas que asigna la base y sus claves únicas. */
const TABLES = {
  spaces: {
    columns: ['id', 'subject_id', 'subject_code', 'school_id', 'name', 'material_layout'],
    uuid: ['id'],
    generated: { id: 'uuid' },
    unique: [['id'], ['subject_id', 'school_id']]
  },
  space_channels: {
    columns: [
      'id',
      'seq',
      'space_id',
      'name',
      'kind',
      'scope_kind',
      'section_id',
      'person_ids',
      'scope_key',
      'external_system',
      'external_channel_id'
    ],
    uuid: ['id', 'space_id'],
    generated: { id: 'uuid', seq: 'identity' },
    unique: [['id'], ['space_id', 'scope_key', 'name']]
  },
  space_messages: {
    columns: [
      'id',
      'seq',
      'channel_id',
      'author_id',
      'author_name',
      'text',
      'attachments',
      'origin',
      'external_id',
      'status',
      'reply_to',
      'resolved',
      'created_at'
    ],
    uuid: ['id', 'channel_id', 'reply_to'],
    jsonb: ['attachments'],
    generated: { id: 'uuid', seq: 'identity' },
    defaults: { attachments: [] },
    unique: [['id'], ['channel_id', 'external_id']]
  },
  space_material: {
    columns: [
      'id',
      'seq',
      'space_id',
      'name',
      'url',
      'file_id',
      'content_type',
      'size',
      'section',
      'origin',
      'external_id',
      'added_by',
      'added_at'
    ],
    uuid: ['id', 'space_id', 'file_id'],
    generated: { id: 'uuid', seq: 'identity' },
    unique: [['id'], ['file_id'], ['space_id', 'origin', 'external_id']]
  },
  space_reads: {
    columns: ['person_id', 'channel_id', 'last_seq'],
    uuid: ['channel_id'],
    unique: [['person_id', 'channel_id']]
  }
} satisfies Parameters<typeof createFakePostgrest>[0]['tables']

/** `space_mark_read` de la migración: marca leído sin retroceder, y nada si el canal no existe. */
function markRead(args: Record<string, unknown>, tables: Record<string, FakeRow[]>) {
  const { p_person_id: personId, p_channel_id: channelId, p_seq: seq } = args
  if (Object.keys(args).length !== 3 || typeof personId !== 'string' || typeof seq !== 'number')
    return new PostgrestError(404, 'PGRST202', 'space_mark_read no tiene esos argumentos')
  if (!isUuid(channelId)) return invalidUuid(channelId)
  if (!tables.space_channels.some((c) => c.id === channelId)) return undefined
  const mark = tables.space_reads.find((r) => r.person_id === personId && r.channel_id === channelId)
  if (!mark) tables.space_reads.push({ person_id: personId, channel_id: channelId, last_seq: seq })
  else mark.last_seq = Math.max(Number(mark.last_seq), seq)
  return undefined
}

const supabaseStore = (url: string, key: string, fetch?: typeof globalThis.fetch) =>
  createSupabaseSpacesStore({ client: supabaseClient(url, key, fetch) })

function supabaseClient(url: string, key: string, fetch?: typeof globalThis.fetch): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(fetch ? { global: { fetch } } : {})
  })
}

spacesStoreContract('almacén en memoria', () => createMemorySpacesStore())

spacesStoreContract('almacén de Supabase sin red', () =>
  supabaseStore(
    'http://spaces.test',
    'clave-de-prueba',
    createFakePostgrest({ tables: TABLES, functions: { space_mark_read: markRead } }).fetch
  )
)

const url = process.env.HACKAI_TEST_SUPABASE_URL
const key = process.env.HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY
spacesStoreContract(
  'almacén de Supabase',
  () => supabaseStore(url!, key!),
  url && key ? false : 'sin base de prueba: definí HACKAI_TEST_SUPABASE_URL y HACKAI_TEST_SUPABASE_SERVICE_ROLE_KEY'
)

if (url && key) {
  // Borra lo que dejó esta corrida: los canales, mensajes, material y lo leído caen en cascada.
  after(async () => {
    await supabaseClient(url, key).from('spaces').delete().like('subject_id', `prueba-${RUN}-%`)
  })
}
