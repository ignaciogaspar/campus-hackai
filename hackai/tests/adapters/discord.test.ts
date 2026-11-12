/* Lo propio del adaptador de Discord, más allá de la batería de contrato:
   la traducción de respuestas crudas de la API, los 429, las caídas, el token
   y la paginación. Sin red: `fetch` es el Discord falso. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDiscordExternalChannel, type DiscordOptions } from '@/lib/adapters/discord/external-channel'
import { createFakeDiscord, type RawMessage } from '@/tests/contracts/fake-discord'

const TOKEN = 'token-de-prueba-que-no-se-filtra'
const CHANNEL = '1301000000000000010'
const CDN = 'https://cdn.discordapp.com/attachments'

function setup(options: Partial<DiscordOptions> = {}) {
  const fake = createFakeDiscord()
  fake.addChannel(CHANNEL)
  const waits: number[] = []
  const port = createDiscordExternalChannel({
    token: TOKEN,
    fetch: fake.fetch,
    sleep: async (ms) => {
      waits.push(ms)
    },
    ...options
  })
  return { fake, port, waits }
}

const raw = (id: string, extra: Partial<RawMessage> = {}): RawMessage => ({
  id,
  channel_id: CHANNEL,
  type: 0,
  content: `mensaje ${id}`,
  timestamp: '2026-11-09T11:05:00.123000+00:00',
  author: { id: '1302000000000000050', username: 'mledesma', global_name: 'Marina Ledesma' },
  attachments: [],
  ...extra
})

test('traduce un mensaje crudo de Discord: autor por id, adjuntos, webhook y hora en UTC', async () => {
  const { fake, port } = setup()
  fake.addMessage(
    raw('1310000000000000100', {
      attachments: [
        {
          id: '1311000000000000100',
          filename: 'guia.pdf',
          content_type: 'application/pdf',
          size: 1200,
          url: `${CDN}/x/guia.pdf?ex=6730a1b2&is=672f5032&hm=abc`
        }
      ]
    })
  )
  fake.addMessage(
    raw('1310000000000000101', {
      author: { id: '1302000000000000099', username: 'Avisos de la cátedra', global_name: null, bot: true },
      webhook_id: '1302000000000000099'
    })
  )
  fake.addMessage(
    raw('1310000000000000102', {
      author: { id: '1302000000000000051', username: 'tomi.aguirre', global_name: null },
      attachments: [{ id: '1311000000000000101', filename: 'foto', size: 10, url: `${CDN}/x/foto` }]
    })
  )

  const page = await port.read(CHANNEL, null)
  assert.ok(page.ok)
  assert.deepEqual(page.value.messages[0], {
    id: '1310000000000000100',
    channelId: CHANNEL,
    author: { id: '1302000000000000050', name: 'Marina Ledesma', isBot: false },
    text: 'mensaje 1310000000000000100',
    attachments: [
      {
        id: '1311000000000000100',
        filename: 'guia.pdf',
        contentType: 'application/pdf',
        size: 1200,
        url: `${CDN}/x/guia.pdf?ex=6730a1b2&is=672f5032&hm=abc`
      }
    ],
    threadId: null,
    viaWebhook: false,
    createdAt: '2026-11-09T11:05:00.123Z'
  })
  assert.deepEqual(page.value.messages[1].author, {
    id: '1302000000000000099',
    name: 'Avisos de la cátedra',
    isBot: true
  })
  assert.equal(page.value.messages[1].viaWebhook, true)
  assert.equal(page.value.messages[2].author.name, 'tomi.aguirre')
  assert.equal(page.value.messages[2].attachments[0].contentType, 'application/octet-stream')
})

test('una respuesta queda en el hilo de su mensaje raíz y los mensajes de sistema no se devuelven', async () => {
  const { fake, port } = setup()
  fake.addMessage(raw('1310000000000000200'))
  fake.addMessage(
    raw('1310000000000000201', {
      type: 19,
      message_reference: { message_id: '1310000000000000200', channel_id: CHANNEL }
    })
  )
  fake.addMessage(
    raw('1310000000000000202', {
      type: 19,
      message_reference: { message_id: '1310000000000000201', channel_id: CHANNEL }
    })
  )
  fake.addMessage(raw('1310000000000000203', { type: 7, content: '' }))

  const page = await port.read(CHANNEL, null)
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.messages.map((m) => [m.id, m.threadId]),
    [
      ['1310000000000000200', null],
      ['1310000000000000201', '1310000000000000200'],
      ['1310000000000000202', '1310000000000000200']
    ]
  )
})

test('una respuesta a un mensaje de una lectura anterior queda en el hilo de la raíz de la cadena', async () => {
  const { fake, port } = setup()
  fake.addMessage(raw('1310000000000000210'))
  fake.addMessage(
    raw('1310000000000000211', {
      type: 19,
      message_reference: { message_id: '1310000000000000210', channel_id: CHANNEL }
    })
  )
  const first = await port.read(CHANNEL, null)
  assert.ok(first.ok)

  fake.addMessage(
    raw('1310000000000000212', {
      type: 19,
      message_reference: { message_id: '1310000000000000211', channel_id: CHANNEL }
    })
  )
  const second = await port.read(CHANNEL, first.value.cursor)
  assert.ok(second.ok)
  assert.deepEqual(
    second.value.messages.map((m) => [m.id, m.threadId]),
    [['1310000000000000212', '1310000000000000210']]
  )

  // Otra instancia del adaptador, sin nada visto: le pide a Discord los mensajes anteriores de la cadena.
  const fresh = createDiscordExternalChannel({ token: TOKEN, fetch: fake.fetch })
  const cold = await fresh.read(CHANNEL, first.value.cursor)
  assert.ok(cold.ok)
  assert.deepEqual(
    cold.value.messages.map((m) => [m.id, m.threadId]),
    [['1310000000000000212', '1310000000000000210']]
  )
})

test('un mensaje reenviado no queda como respuesta del original', async () => {
  const { fake, port } = setup()
  fake.addMessage(raw('1310000000000000220'))
  fake.addMessage(
    raw('1310000000000000221', { message_reference: { message_id: '1310000000000000220', channel_id: CHANNEL } })
  )

  const page = await port.read(CHANNEL, null)
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.messages.map((m) => m.threadId),
    [null, null]
  )
})

test('los mensajes de un hilo que se archivó entre dos lecturas no se pierden', async () => {
  const { fake, port } = setup()
  fake.addMessage(raw('1310000000000000230'))
  fake.startThread(CHANNEL, '1310000000000000230', 'Consulta')
  const first = await port.read(CHANNEL, null)
  assert.ok(first.ok)

  fake.addMessage(raw('1330000000000000231', { channel_id: '1310000000000000230' }))
  fake.archiveThread('1310000000000000230', new Date('2026-11-10T15:00:00Z'))

  const second = await port.read(CHANNEL, first.value.cursor)
  assert.ok(second.ok)
  assert.deepEqual(
    second.value.messages.map((m) => [m.id, m.threadId]),
    [['1330000000000000231', '1310000000000000230']]
  )
})

test('cada request a la API lleva el token del bot y el User-Agent; la CDN no recibe el token', async () => {
  const { fake, port } = setup()
  fake.addMessage(
    raw('1310000000000000300', { attachments: [{ id: '1', filename: 'a.txt', size: 1, url: `${CDN}/x/a.txt` }] })
  )
  fake.addFile(`${CDN}/x/a.txt`, 'a')

  const page = await port.read(CHANNEL, null)
  assert.ok(page.ok)
  assert.ok((await port.download(page.value.messages[0].attachments[0])).ok)

  const api = fake.requests.filter((r) => r.url.startsWith('https://discord.com/api/v10/'))
  assert.ok(api.length > 0)
  for (const request of api) {
    assert.equal(request.headers.Authorization, `Bot ${TOKEN}`)
    assert.match(request.headers['User-Agent'], /^DiscordBot \(https?:\/\/\S+, [\d.]+\)$/)
  }
  const cdn = fake.requests.filter((r) => r.url.startsWith(CDN))
  assert.equal(cdn.length, 1)
  assert.equal(cdn[0].headers.Authorization, undefined)
})

test('ante un 429 espera el retry_after que pide Discord y reintenta', async () => {
  const { fake, port, waits } = setup()
  fake.addMessage(raw('1310000000000000400'))
  fake.throttle(2, 1.5)

  const page = await port.read(CHANNEL, null)
  assert.ok(page.ok)
  assert.equal(page.value.messages.length, 1)
  assert.deepEqual(waits, [1500, 1500])
})

test('si Discord sigue limitando o pide esperar demasiado, vuelve falla-externa sin tirar', async () => {
  const limited = setup({ maxRetries: 2 })
  limited.fake.throttle(10, 0.1)
  assert.deepEqual(await limited.port.post(CHANNEL, 'hola'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(limited.waits, [100, 100])

  const tooLong = setup({ maxRetryAfterMs: 5000 })
  tooLong.fake.throttle(1, 60)
  assert.deepEqual(await tooLong.port.read(CHANNEL, null), { ok: false, error: 'falla-externa' })
  assert.deepEqual(tooLong.waits, [])
})

test('una caída de la red o del servidor vuelve como falla-externa, no como excepción', async () => {
  const { fake, port } = setup()
  fake.setDown(true)
  assert.deepEqual(await port.read(CHANNEL, null), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await port.post(CHANNEL, 'hola'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await port.reply(CHANNEL, '1310000000000000001', 'hola'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(
    await port.download({ id: '1', filename: 'a', contentType: 'text/plain', size: 1, url: `${CDN}/x/a` }),
    { ok: false, error: 'falla-externa' }
  )

  const serverError = createDiscordExternalChannel({
    token: TOKEN,
    fetch: async () => new Response('<html>Bad Gateway</html>', { status: 502 })
  })
  assert.deepEqual(await serverError.read(CHANNEL, null), { ok: false, error: 'falla-externa' })
})

test('no baja adjuntos de fuera de la CDN de Discord', async () => {
  const { fake, port } = setup()
  const result = await port.download({
    id: '1',
    filename: 'a',
    contentType: 'text/plain',
    size: 1,
    url: 'https://ejemplo.invalid/a'
  })
  assert.deepEqual(result, { ok: false, error: 'falla-externa' })
  assert.equal(fake.requests.length, 0)
})

test('pagina de a 100 y, si hay más de lo que lee de una vez, el cursor queda en lo último leído', async () => {
  const { fake, port } = setup()
  const ids = Array.from({ length: 1050 }, (_, i) => String(1310000000000001000n + BigInt(i)))
  for (const id of ids) fake.addMessage(raw(id))

  const first = await port.read(CHANNEL, null)
  assert.ok(first.ok)
  assert.equal(first.value.messages.length, 1000)
  assert.equal(first.value.cursor, ids[999])

  const second = await port.read(CHANNEL, first.value.cursor)
  assert.ok(second.ok)
  assert.deepEqual(
    second.value.messages.map((m) => m.id),
    ids.slice(1000)
  )
  assert.equal(second.value.cursor, ids.at(-1))
})

test('sin token no se arma', () => {
  assert.throws(() => createDiscordExternalChannel({ token: ' ' }), /DISCORD_BOT_TOKEN/)
})

// El servidor de la cátedra: categoría, rol de docentes y canales con permisos.

const GUILD_ID = '1300000000000000001'
const TEACHER = '1290000000000000001'
const STUDENT = '1290000000000000011'
/** Mensajes, hilos y respuestas en hilos: lo que se niega o se permite para escribir. */
const WRITE = String((1n << 11n) | (1n << 35n) | (1n << 38n))

test('un canal solo para docentes le niega escribir a @everyone y se lo da al rol de docentes y al bot', async () => {
  const { fake, port } = setup()
  fake.addMembers(TEACHER, STUDENT)

  const group = await port.prepareGroup(GUILD_ID, {
    name: 'Análisis Matemático I',
    teacherIds: [TEACHER, '1290000000000009999']
  })
  assert.ok(group.ok)
  // El rol queda con el docente; la cuenta que no es miembro del servidor se saltea.
  assert.deepEqual(fake.roles(), [
    { id: group.value.teachersRoleId, name: 'Docentes · Análisis Matemático I', members: [TEACHER] }
  ])

  const avisos = await port.createChannel(GUILD_ID, group.value, { name: 'avisos-a', writers: 'docentes' })
  const consultas = await port.createChannel(GUILD_ID, group.value, { name: 'consultas-a', writers: 'todos' })
  assert.ok(avisos.ok && consultas.ok)

  const created = (id: string) => fake.guildChannels().find((c) => c.id === id)!
  const bot = {
    id: '1302000000000000001',
    type: 1,
    allow: String((1n << 10n) | (1n << 16n) | BigInt(WRITE)),
    deny: '0'
  }
  assert.equal(created(avisos.value.id).parent_id, group.value.categoryId)
  assert.deepEqual(created(avisos.value.id).permission_overwrites, [
    { id: GUILD_ID, type: 0, allow: '0', deny: WRITE },
    { id: group.value.teachersRoleId, type: 0, allow: WRITE, deny: '0' },
    bot
  ])
  assert.deepEqual(created(consultas.value.id).permission_overwrites, [bot])
})

test('si al bot le faltan Gestionar canales o Gestionar roles, crear devuelve sin-permisos', async () => {
  const { fake, port } = setup()
  fake.denyManage(true)
  assert.deepEqual(await port.prepareGroup(GUILD_ID, { name: 'Materia', teacherIds: [] }), {
    ok: false,
    error: 'sin-permisos'
  })
})

test('con Discord caído, las operaciones del servidor devuelven falla-externa', async () => {
  const { fake, port } = setup()
  fake.setDown(true)
  assert.deepEqual(await port.serverChannels(GUILD_ID), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await port.isMember(GUILD_ID, TEACHER), { ok: false, error: 'falla-externa' })
})
