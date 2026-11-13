import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { compose } from '@/lib/composition'

const NOW = new Date(syntheticData.now)

test('sin variables de entorno arma todos los módulos con los adaptadores en memoria', async () => {
  const system = compose({})

  assert.deepEqual(system.adapters, {
    identity: 'memoria',
    siu: 'memoria',
    classroom: 'memoria',
    externalChannel: 'memoria',
    files: 'memoria',
    clock: 'memoria',
    store: 'memoria'
  })
  assert.equal(system.ports.clock.now().toISOString(), NOW.toISOString())
  // La hora de las pantallas es la del mismo reloj.
  assert.equal(system.now(), NOW.toISOString())

  const alumno = syntheticData.people.find((p) => p.id === 'p-taguirre')!
  assert.equal((await system.today.today(alumno.id)).ok, true)
  assert.equal((await system.people.get(alumno.id)).ok, true)
  assert.equal((await system.studies.subjectsOf(alumno.id)).ok, true)
  assert.equal((await system.studies.record(alumno.id)).ok, true)
  assert.equal((await system.spaces.open(alumno.id, 'am1')).ok, true)
  // En memoria arranca sin canales vinculados.
  assert.deepEqual(await system.spaces.syncAll(), {
    ok: true,
    value: { channels: 0, imported: 0, sent: 0, pending: 0 }
  })
})

test('con el reloj del sistema, el de la demo, Hoy se arma con la fecha y la hora reales y no con las del set', async () => {
  const { today } = compose({ HACKAI_CLOCK: 'sistema' })

  const before = Date.now()
  const result = await today.today('p-taguirre')
  const after = Date.now()

  assert.ok(result.ok)
  const now = Date.parse(result.value.now)
  assert.ok(before <= now && now <= after, `Hoy dice ${result.value.now}`)
})

test('cada puerto se elige por su variable de entorno y un valor desconocido se rechaza al armar', () => {
  const system = compose({ HACKAI_SIU: 'memoria', HACKAI_CLOCK: 'sistema' })
  assert.equal(system.adapters.siu, 'memoria')
  assert.equal(system.adapters.clock, 'sistema')
  assert.equal(system.ports.clock.capabilities.fixed, false)

  assert.throws(() => compose({ HACKAI_SIU: 'otro' }), /HACKAI_SIU/)
  assert.throws(() => compose({ HACKAI_EXTERNAL_CHANNEL: 'slack' }), /HACKAI_EXTERNAL_CHANNEL/)
})

test('HACKAI_SIU=simulado usa el SIU simulado sobre Supabase, que declara sus capacidades', () => {
  const system = compose({
    HACKAI_SIU: 'simulado',
    NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba'
  })

  assert.equal(system.adapters.siu, 'simulado')
  assert.deepEqual(system.ports.siu.capabilities, {
    canEnroll: true,
    hasAssessmentSchedule: true,
    enrolsInClassroom: false,
    canWriteGrades: true
  })
})

test('HACKAI_SIU=simulado sin las variables de Supabase corta el arranque', () => {
  assert.throws(() => compose({ HACKAI_SIU: 'simulado' }), /NEXT_PUBLIC_SUPABASE_URL/)
})

test('HACKAI_FILES=supabase guarda los archivos en Supabase Storage y sin sus variables no arranca', () => {
  const system = compose({
    HACKAI_FILES: 'supabase',
    NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba'
  })
  assert.equal(system.adapters.files, 'supabase')
  assert.deepEqual(system.ports.files.capabilities, { maxBytes: 10 * 1024 * 1024 })

  assert.throws(() => compose({ HACKAI_FILES: 'supabase' }), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => compose({ HACKAI_FILES: 's3' }), /HACKAI_FILES/)
})

test('HACKAI_STORE=supabase guarda lo de Personas y Espacios en Supabase y sin sus variables no arranca', async () => {
  const system = compose({
    HACKAI_STORE: 'supabase',
    NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba'
  })
  assert.equal(system.adapters.store, 'supabase')
  assert.equal(system.adapters.siu, 'memoria')

  assert.throws(() => compose({ HACKAI_STORE: 'supabase' }), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => compose({ HACKAI_STORE: 'postgres' }), /HACKAI_STORE/)
})

test('con todo en memoria se entra eligiendo una persona de la lista de demo', async () => {
  const { people } = compose({})

  const listed = await people.demoPeople()
  assert.ok(listed.ok)
  assert.equal(listed.value.length, syntheticData.people.length)

  const entered = await people.signIn({ kind: 'demo', subject: 'demo:p-mledesma' })
  assert.ok(entered.ok)
  assert.equal(entered.value.role, 'profesor')
})

test('HACKAI_CLASSROOM=simulado usa el Moodle simulado sobre Supabase, que declara sus capacidades y arma el enlace al aula', () => {
  const system = compose({
    HACKAI_CLASSROOM: 'simulado',
    NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'clave-de-prueba'
  })

  assert.equal(system.adapters.classroom, 'simulado')
  assert.equal(system.adapters.siu, 'memoria')
  assert.deepEqual(system.ports.classroom.capabilities, { canEnrol: true, hasAssignments: true })
  assert.equal(
    system.ports.classroom.courseUrl('c-am1-fi-a'),
    `${syntheticData.moodle.baseUrl}/course/view.php?id=c-am1-fi-a`
  )
})

test('HACKAI_CLASSROOM=simulado sin las variables de Supabase corta el arranque', () => {
  assert.throws(() => compose({ HACKAI_CLASSROOM: 'simulado' }), /NEXT_PUBLIC_SUPABASE_URL/)
  assert.throws(() => compose({ HACKAI_CLASSROOM: 'otro' }), /HACKAI_CLASSROOM/)
})

test('el canal externo de Discord se arma con el token del entorno y sin token no arranca', () => {
  const system = compose({ HACKAI_EXTERNAL_CHANNEL: 'discord', DISCORD_BOT_TOKEN: 'token-de-prueba' })
  assert.equal(system.adapters.externalChannel, 'discord')
  assert.deepEqual(system.ports.externalChannel.capabilities, { delivery: 'cursor', threads: true, servers: true })

  assert.throws(() => compose({ HACKAI_EXTERNAL_CHANNEL: 'discord' }), /DISCORD_BOT_TOKEN/)
  assert.throws(() => compose({ HACKAI_EXTERNAL_CHANNEL: 'discord', DISCORD_BOT_TOKEN: '  ' }), /DISCORD_BOT_TOKEN/)
})

test('los adaptadores en memoria declaran sus capacidades', () => {
  const { ports } = compose({})
  assert.deepEqual(ports.identity.capabilities, { demoList: true })
  assert.deepEqual(ports.siu.capabilities, {
    canEnroll: true,
    hasAssessmentSchedule: true,
    enrolsInClassroom: false,
    canWriteGrades: true
  })
  assert.deepEqual(ports.classroom.capabilities, { canEnrol: true, hasAssignments: true })
  assert.deepEqual(ports.externalChannel.capabilities, { delivery: 'cursor', threads: true, servers: true })
  assert.equal(ports.files.capabilities.maxBytes > 0, true)
  assert.deepEqual(ports.clock.capabilities, { fixed: true })
})

test('cada armado tiene su propia copia de los datos sintéticos', async () => {
  const a = compose({})
  const b = compose({})
  const section = syntheticData.siu.sections.find((s) => s.termId === 'verano-2027' && s.capacity === null)!
  const student = syntheticData.siu.persons.find(
    (p) =>
      p.role === 'alumno' &&
      p.school.id === section.schoolId &&
      !syntheticData.siu.courseEnrollments.some((e) => e.personId === p.id && e.sectionId === section.id)
  )!

  const enrolled = await a.ports.siu.enroll(student.id, { kind: 'comision', sectionId: section.id })
  assert.equal(enrolled.ok, true)
  const inB = await b.ports.siu.courseEnrollments(student.id)
  assert.equal(inB.ok && inB.value.some((e) => e.sectionId === section.id), false)
})

test('con el reloj fijo de la demo, lo nuevo del canal externo entra al volver a abrir el espacio pasados unos segundos', async (t) => {
  // El reloj de la demo no avanza: el espaciado de las sincronizaciones tiene que medirse con el tiempo real.
  let elapsed = 0
  t.mock.method(performance, 'now', () => elapsed)
  const system = compose({})
  const discord = system.ports.externalChannel as MemoryExternalChannel
  const [, consultas] = syntheticData.discord.channels

  const opened = await system.spaces.open('p-mledesma', 'am1')
  assert.ok(opened.ok)
  const channel = opened.value.channels.find((c) => c.kind === 'consultas')!
  assert.ok((await system.spaces.link('p-mledesma', channel.id, { system: 'discord', channelId: consultas.id })).ok)
  await system.spaces.open('p-mledesma', 'am1')

  discord.receive(consultas.id, { author: { id: '1290000000000000777', name: 'alguien' }, text: '¿Hay clase?' })
  elapsed += 10_000
  await system.spaces.open('p-mledesma', 'am1')

  const seen = await system.spaces.channel('p-mledesma', channel.id)
  assert.ok(seen.ok)
  assert.equal(seen.value.threads.at(-1)?.message.text, '¿Hay clase?')
})

test('HACKAI_CACHE_SEGUNDOS tiene que ser una cantidad de segundos', () => {
  assert.doesNotThrow(() => compose({ HACKAI_CACHE_SEGUNDOS: '0' }))
  assert.doesNotThrow(() => compose({ HACKAI_CACHE_SEGUNDOS: '300' }))
  assert.throws(() => compose({ HACKAI_CACHE_SEGUNDOS: 'mucho' }), /HACKAI_CACHE_SEGUNDOS/)
})

test('sin HACKAI_CAIDAS no hay interruptor de caídas, como en producción, y un valor desconocido corta el arranque', () => {
  assert.equal(compose({}).outages, null)
  assert.equal(compose({ HACKAI_CAIDAS: 'no' }).outages, null)
  assert.throws(() => compose({ HACKAI_CAIDAS: 'siempre' }), /HACKAI_CAIDAS/)
})

test('con HACKAI_CAIDAS=si, tirar el SIU deja las pantallas con lo último leído y levantarlo las pone al día', async () => {
  const system = compose({ HACKAI_CAIDAS: 'si' })
  assert.ok(system.outages)
  assert.deepEqual(system.outages.state(), { siu: false, moodle: false })
  const first = await system.studies.subjectsOf('p-taguirre')
  assert.ok(first.ok)
  const person = await system.people.get('p-taguirre')

  system.outages.set('siu', true)
  // El saludo y la tarjeta de Hoy siguen: la persona sale de lo último leído.
  assert.deepEqual(await system.people.get('p-taguirre'), person)
  const stale = await system.studies.subjectsOf('p-taguirre')
  assert.ok(stale.ok)
  assert.equal(stale.value.stale, true)
  const today = await system.today.today('p-taguirre')
  assert.ok(today.ok)
  assert.equal(today.value.staleSince, first.value.readAt)

  system.outages.set('siu', false)
  const back = await system.studies.subjectsOf('p-taguirre')
  assert.ok(back.ok)
  assert.equal(back.value.stale, false)
})

test('con HACKAI_CAIDAS=si, tirar Moodle deja las materias sin el aula y el SIU sigue al día', async () => {
  const system = compose({ HACKAI_CAIDAS: 'si' })
  system.outages?.set('moodle', true)

  const result = await system.studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.data.classroomUnavailable, true)
})

test('Conectar con Discord se arma solo con el canal externo de Discord y la aplicación configurada', () => {
  const bot = { HACKAI_EXTERNAL_CHANNEL: 'discord', DISCORD_BOT_TOKEN: 'token-de-prueba' }
  const app = { DISCORD_CLIENT_ID: '1569889274470334484', DISCORD_CLIENT_SECRET: 'secreto-de-prueba' }
  assert.notEqual(compose({ ...bot, ...app }).discordOAuth, null)
  assert.equal(compose(bot).discordOAuth, null)
  assert.equal(compose(app).discordOAuth, null, 'con el canal externo en memoria no hay a qué conectar')
  assert.equal(compose({ ...bot, ...app }).discordRedirectUri, null)
  assert.equal(
    compose({ ...bot, ...app, DISCORD_REDIRECT_URI: 'https://hackai.test/discord/vuelta' }).discordRedirectUri,
    'https://hackai.test/discord/vuelta'
  )
})

test('comparte novedades durante el render y las actualiza después de leer o publicar', async () => {
  let scope = new Map<string, Promise<unknown>>()
  const { spaces } = compose({}, syntheticData, () => scope)
  const student = 'p-taguirre'
  const teacher = 'p-mledesma'
  const opened = await spaces.open(student, 'am1')
  assert.ok(opened.ok)
  const avisos = opened.value.channels.find((channel) => channel.kind === 'avisos')!
  const consultas = opened.value.channels.find((channel) => channel.kind === 'consultas')!

  const first = spaces.unreadFor(student)
  assert.equal(spaces.unreadFor(student), first)
  assert.ok((await first).ok)
  scope = new Map()
  assert.notEqual(spaces.unreadFor(student), first)

  const posted = await spaces.post(teacher, avisos.id, { text: 'Aviso de prueba' })
  assert.ok(posted.ok)
  const beforeRead = await spaces.unreadFor(student)
  assert.ok(beforeRead.ok && beforeRead.value.some((item) => item.channelId === avisos.id))
  assert.ok((await spaces.channel(student, avisos.id)).ok)
  const afterRead = await spaces.unreadFor(student)
  assert.ok(afterRead.ok && !afterRead.value.some((item) => item.channelId === avisos.id))

  const beforePost = await spaces.unreadFor(teacher)
  assert.ok(beforePost.ok && !beforePost.value.some((item) => item.channelId === consultas.id))
  assert.ok((await spaces.post(student, consultas.id, { text: '¿Entra el primer tema?' })).ok)
  const afterPost = await spaces.unreadFor(teacher)
  assert.ok(afterPost.ok && afterPost.value.some((item) => item.channelId === consultas.id))
})

test('actualiza las materias y las inscripciones abiertas del render tras un alta y una baja', async () => {
  const scope = new Map<string, Promise<unknown>>()
  const { studies } = compose({}, syntheticData, () => scope)
  const person = 'p-taguirre'
  const target = { kind: 'comision', sectionId: 'sec-fi1-fi-vt' } as const

  async function read() {
    const [subjects, openings] = await Promise.all([studies.subjectsOf(person), studies.openEnrollments(person)])
    assert.ok(subjects.ok && openings.ok)
    return {
      enrolled: subjects.value.data.current.some((subject) => subject.sectionId === target.sectionId),
      open: openings.value.data.some((opening) => opening.subjectId === 'fi1')
    }
  }

  assert.deepEqual(await read(), { enrolled: false, open: true })
  assert.ok((await studies.enroll(person, target)).ok)
  assert.deepEqual(await read(), { enrolled: true, open: false })
  assert.ok((await studies.drop(person, target)).ok)
  assert.deepEqual(await read(), { enrolled: false, open: true })
})
