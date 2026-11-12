/* Las caídas de la demo: con el sistema caído, cada consulta del SIU o del
   aula devuelve `falla-externa` sin llegar al adaptador que envuelven; lo que
   no consulta nada sigue respondiendo. Que con el sistema levantado se portan
   igual lo prueban las baterías de contrato (tests/contracts/). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createOutageSwitch,
  isOutageSystem,
  OUTAGE_SYSTEMS,
  withClassroomOutage,
  withSiuOutage
} from '@/lib/adapters/caida'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const TOMAS_SIU = syntheticData.people.find((p) => p.id === 'p-taguirre')!.siuId
const VERANO = { kind: 'comision', sectionId: 'sec-pr1-fi-v' } as const

function build() {
  const outages = createOutageSwitch()
  const memorySiu = createMemorySiu(syntheticData, createFixedClock(syntheticData.now))
  const memoryClassroom = createMemoryClassroom(syntheticData)
  return {
    outages,
    memorySiu,
    siu: withSiuOutage(memorySiu, outages),
    classroom: withClassroomOutage(memoryClassroom, outages)
  }
}

test('arranca con todo levantado, y cada sistema se cae y se levanta por su cuenta', () => {
  const { outages } = build()
  assert.deepEqual(outages.state(), { siu: false, moodle: false })

  outages.set('siu', true)
  assert.deepEqual(outages.state(), { siu: true, moodle: false })
  outages.set('moodle', true)
  outages.set('siu', false)
  assert.deepEqual(outages.state(), { siu: false, moodle: true })
})

test('lo que devuelve state es una copia: cambiarla no cae nada', () => {
  const { outages } = build()
  const state = outages.state()
  state.siu = true
  assert.equal(outages.state().siu, false)
})

test('con el SIU caído toda consulta devuelve «falla externa» y no llega al SIU que envuelve', async () => {
  const { outages, siu, memorySiu } = build()
  outages.set('siu', true)

  assert.deepEqual(await siu.person(TOMAS_SIU), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.terms(), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.sections({ subjectId: 'pr1' }), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siu.meetsCertificateConditions(TOMAS_SIU, 'alumno-regular'), {
    ok: false,
    error: 'falla-externa'
  })
  assert.deepEqual(await siu.enroll(TOMAS_SIU, VERANO), { ok: false, error: 'falla-externa' })

  // La inscripción no llegó al SIU de adentro.
  const enrolled = await memorySiu.courseEnrollments(TOMAS_SIU)
  assert.ok(enrolled.ok)
  assert.equal(
    enrolled.value.some((e) => e.sectionId === VERANO.sectionId),
    false
  )
})

test('con el SIU caído siguen las capacidades y el enlace a la Autogestión, que no consultan nada', () => {
  const { outages, siu, memorySiu } = build()
  outages.set('siu', true)

  assert.deepEqual(siu.capabilities, memorySiu.capabilities)
  assert.equal(siu.selfServiceUrl(VERANO), memorySiu.selfServiceUrl(VERANO))
})

test('al levantar el SIU vuelve a responder', async () => {
  const { outages, siu } = build()
  outages.set('siu', true)
  outages.set('siu', false)

  assert.equal((await siu.person(TOMAS_SIU)).ok, true)
})

test('con Moodle caído el aula devuelve «falla externa», pero el SIU sigue respondiendo', async () => {
  const { outages, siu, classroom } = build()
  outages.set('moodle', true)

  assert.deepEqual(await classroom.coursesForSection('sec-am1-fi-a'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await classroom.assignments('c-am1-fi-a'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await classroom.enrol('401', 'c-am1-fi-a', 'student'), { ok: false, error: 'falla-externa' })
  assert.equal(classroom.courseUrl('c-am1-fi-a'), `${syntheticData.moodle.baseUrl}/course/view.php?id=c-am1-fi-a`)
  assert.equal((await siu.person(TOMAS_SIU)).ok, true)
})

test('solo el SIU y Moodle se pueden caer, y lo que llega de un formulario se chequea contra esa lista', () => {
  assert.deepEqual([...OUTAGE_SYSTEMS], ['siu', 'moodle'])
  assert.equal(isOutageSystem('siu'), true)
  assert.equal(isOutageSystem('moodle'), true)
  assert.equal(isOutageSystem('discord'), false)
  assert.equal(isOutageSystem(undefined), false)
})
