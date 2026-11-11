import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose } from '@/lib/composition'
import { syntheticData } from '@/lib/adapters/synthetic-data'

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
  })
  assert.equal(system.ports.clock.now().toISOString(), NOW.toISOString())

  const alumno = syntheticData.people[0]
  assert.deepEqual(await system.today.today(alumno.id), { ok: false, error: 'no-implementado' })
  assert.deepEqual(await system.people.get(alumno.id), { ok: false, error: 'no-implementado' })
  assert.deepEqual(await system.studies.record(alumno.id), { ok: false, error: 'no-implementado' })
  assert.deepEqual(await system.spaces.syncAll(), { ok: false, error: 'no-implementado' })
})

test('cada módulo expone su interfaz completa y lo que falta devuelve «no implementado»', async () => {
  const { people, studies, spaces, today } = compose({})
  const p = 'persona'
  const calls = [
    people.signIn({ kind: 'demo', subject: 'demo' }),
    people.demoPeople(),
    people.get(p),
    people.accountIn(p, 'siu'),
    people.byExternalAccount('discord', 'x'),
    studies.subjectsOf(p),
    studies.sectionsOf(p),
    studies.offer(p, { kind: 'cursada', subjectId: 's' }),
    studies.enroll(p, { kind: 'comision', sectionId: 's' }),
    studies.drop(p, { kind: 'mesa', examBoardId: 'm' }),
    studies.upcoming(p),
    studies.openEnrollments(p),
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
    spaces.unreadFor(p),
    today.today(p),
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
    (p) => p.role === 'alumno' && p.school.id === section.schoolId
      && !syntheticData.siu.courseEnrollments.some((e) => e.personId === p.id && e.sectionId === section.id),
  )!

  const enrolled = await a.ports.siu.enroll(student.id, { kind: 'comision', sectionId: section.id })
  assert.equal(enrolled.ok, true)
  const inB = await b.ports.siu.courseEnrollments(student.id)
  assert.equal(inB.ok && inB.value.some((e) => e.sectionId === section.id), false)
})
