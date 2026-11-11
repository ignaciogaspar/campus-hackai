import assert from 'node:assert/strict'
import { test } from 'node:test'
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

  const alumno = syntheticData.people.find((p) => p.id === 'p-taguirre')!
  assert.equal((await system.today.today(alumno.id)).ok, true)
  assert.equal((await system.people.get(alumno.id)).ok, true)
  assert.equal((await system.studies.subjectsOf(alumno.id)).ok, true)
  assert.deepEqual(await system.studies.record(alumno.id), { ok: false, error: 'no-implementado' })
  assert.deepEqual(await system.spaces.syncAll(), { ok: false, error: 'no-implementado' })
})

test('cada módulo expone su interfaz completa y lo que falta devuelve «no implementado»', async () => {
  const { studies, spaces } = compose({})
  const p = 'persona'
  const calls = [
    studies.offer(p, { kind: 'cursada', subjectId: 's' }),
    studies.enroll(p, { kind: 'comision', sectionId: 's' }),
    studies.drop(p, { kind: 'mesa', examBoardId: 'm' }),
    studies.record(p),
    studies.certificate(p, 'alumno-regular'),
    spaces.open(p, 's'),
    spaces.channel(p, 'c'),
    spaces.post(p, 'c', { text: 'hola' }),
    spaces.resolve(p, 'm'),
    spaces.createChannel(p, 'e', { name: 'tp1', scope: { kind: 'materia' } }),
    spaces.openDirect(p, 'otra'),
    spaces.link(p, 'c', { system: 'discord', channelId: 'd' }),
    spaces.syncAll(),
    spaces.unreadFor(p)
  ]
  for (const result of await Promise.all(calls)) {
    assert.deepEqual(result, { ok: false, error: 'no-implementado' })
  }
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
    enrolsInClassroom: false
  })
})

test('HACKAI_SIU=simulado sin las variables de Supabase corta el arranque', () => {
  assert.throws(() => compose({ HACKAI_SIU: 'simulado' }), /NEXT_PUBLIC_SUPABASE_URL/)
})

test('HACKAI_STORE=supabase guarda los vínculos de Personas en Supabase y sin sus variables no arranca', async () => {
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
  assert.deepEqual(system.ports.externalChannel.capabilities, { delivery: 'cursor', threads: true })

  assert.throws(() => compose({ HACKAI_EXTERNAL_CHANNEL: 'discord' }), /DISCORD_BOT_TOKEN/)
  assert.throws(() => compose({ HACKAI_EXTERNAL_CHANNEL: 'discord', DISCORD_BOT_TOKEN: '  ' }), /DISCORD_BOT_TOKEN/)
})

test('los adaptadores en memoria declaran sus capacidades', () => {
  const { ports } = compose({})
  assert.deepEqual(ports.identity.capabilities, { demoList: true })
  assert.deepEqual(ports.siu.capabilities, { canEnroll: true, hasAssessmentSchedule: true, enrolsInClassroom: false })
  assert.deepEqual(ports.classroom.capabilities, { canEnrol: true, hasAssignments: true })
  assert.deepEqual(ports.externalChannel.capabilities, { delivery: 'cursor', threads: true })
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
