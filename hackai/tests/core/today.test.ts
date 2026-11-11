import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createSpaces } from '@/lib/core/spaces'
import { createStudies } from '@/lib/core/studies'
import { createToday } from '@/lib/core/today'
import { fallible, movableClock } from '@/tests/core/helpers'

const NOW = syntheticData.now

/** Hoy con Personas, Cursada y Espacios reales sobre los puertos en memoria. El SIU y Moodle se pueden «caer». */
function build(data: SyntheticData = syntheticData) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(data, clock))
  const { port: classroom, state: classroomState } = fallible(createMemoryClassroom(data))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom, clock })
  const spaces = createSpaces({
    people,
    studies,
    externalChannel: createMemoryExternalChannel(data, clock),
    classroom,
    files: createMemoryFiles(),
    clock
  })
  const today = createToday({ studies, spaces, clock })
  return { today, studies, siuState, classroomState, advance }
}

test('arma la pantalla del alumno en una sola llamada: materias, próximos por fecha e inscripciones abiertas', async () => {
  const { today } = build()

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  const view = result.value
  assert.deepEqual(
    view.subjects.current.map((s) => s.code),
    ['AM1', 'PR1']
  )
  assert.deepEqual(
    view.subjects.archived.map((s) => s.code),
    ['AGA']
  )
  assert.deepEqual(
    view.upcoming.map((i) => [i.subjectCode, i.name, i.source, i.past]),
    [
      ['AM1', 'Primer parcial', 'siu', true],
      ['PR1', 'TP integrador', 'siu', true],
      ['PR1', 'Entrega del TP integrador', 'moodle', true],
      ['AM1', 'Guía 3 resuelta', 'moodle', false],
      ['AM1', 'Segundo parcial', 'siu', false],
      ['PR1', 'Parcial', 'siu', false],
      ['PR1', 'Ejercicios de recursión', 'moodle', false],
      ['AM1', 'Recuperatorio', 'siu', false],
      ['AGA', 'Final', 'siu', false]
    ]
  )
  assert.deepEqual(
    view.openEnrollments.map((i) => [i.kind, i.subjectId]),
    [['examen', 'am1']]
  )
  assert.equal(view.now, NOW)
  assert.equal(view.staleSince, null)
  assert.deepEqual(view.unavailable, [])
})

test('el próximo parcial o final es el primero que no pasó, con los días que faltan', async () => {
  const { today } = build()

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.next, {
    kind: 'parcial',
    source: 'siu',
    subjectId: 'am1',
    subjectCode: 'AM1',
    subjectName: 'Análisis Matemático I',
    name: 'Segundo parcial',
    date: '2026-11-16T11:00:00.000Z',
    past: false,
    daysLeft: 6
  })
})

test('los días que faltan se cuentan por fecha en Buenos Aires, no por horas', async () => {
  const { today, advance } = build()

  advance((5 * 24 + 10) * 60) // domingo 15 a las 22:00, en UTC ya es lunes
  const night = await today.today('p-taguirre')
  advance(9 * 60) // lunes 16 a las 07:00, una hora antes del parcial
  const morning = await today.today('p-taguirre')

  assert.ok(night.ok && morning.ok)
  assert.equal(night.value.next?.daysLeft, 1)
  assert.equal(morning.value.next?.name, 'Segundo parcial')
  assert.equal(morning.value.next?.daysLeft, 0)
})

test('ni las entregas ni los recuperatorios son el próximo parcial: después del último parcial es el final', async () => {
  const { today, advance } = build()

  advance((11 * 24 + 1) * 60) // sábado 21 a las 13:00: quedan la entrega del 21, el recuperatorio del 25 y el final
  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    [result.value.next?.subjectCode, result.value.next?.name, result.value.next?.daysLeft],
    ['AGA', 'Final', 18]
  )
})

test('mientras Espacios no tenga las novedades, Hoy sale sin ellas y no lo cuenta como una caída', async () => {
  const { today } = build()

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.unread, [])
  assert.equal(result.value.unavailable.includes('unread'), false)
})

test('con el SIU caído después de una lectura buena se ve igual, con la hora de lo último que leyó', async () => {
  const { today, siuState, advance } = build()
  const first = await today.today('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true
  const second = await today.today('p-taguirre')

  assert.ok(second.ok)
  assert.deepEqual(
    { ...second.value, now: first.value.now, staleSince: null },
    first.value,
    'las mismas materias, próximos e inscripciones'
  )
  assert.equal(second.value.staleSince, NOW)
  assert.deepEqual(second.value.unavailable, [])
})

test('si varias lecturas están desactualizadas, la hora es la de la más vieja', async () => {
  const { today, studies, siuState, advance } = build()
  await studies.subjectsOf('p-taguirre')
  advance(10)
  await studies.upcoming('p-taguirre')
  advance(10)
  siuState.down = true

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.staleSince, NOW)
  assert.equal(result.value.subjects.current.length, 2)
  assert.equal(result.value.upcoming.length, 9)
  assert.deepEqual(result.value.unavailable, ['openEnrollments'])
})

test('con Moodle caído y nada leído antes, las inscripciones abiertas se ven igual', async () => {
  const { today, classroomState } = build()
  classroomState.down = true

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.unavailable, ['subjects', 'upcoming'])
  assert.deepEqual(result.value.subjects, { current: [], archived: [] })
  assert.deepEqual(result.value.upcoming, [])
  assert.deepEqual(
    result.value.openEnrollments.map((i) => [i.kind, i.subjectId]),
    [['examen', 'am1']]
  )
  assert.equal(result.value.staleSince, null)
})

test('con el SIU caído y nada leído antes, Hoy responde igual, con todo marcado como no disponible', async () => {
  const { today, siuState } = build()
  siuState.down = true

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.unavailable, ['subjects', 'upcoming', 'openEnrollments'])
  assert.deepEqual(result.value.unread, [])
})

test('Hoy de una persona que no existe devuelve «persona desconocida»', async () => {
  const { today } = build()

  assert.deepEqual(await today.today('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

test('un docente tiene Hoy con sus comisiones y sin inscripciones abiertas', async () => {
  const { today } = build()

  const result = await today.today('p-mledesma')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.subjects.current.map((s) => [s.code, s.role]),
    [['AM1', 'profesor']]
  )
  assert.deepEqual(result.value.openEnrollments, [])
  assert.deepEqual(result.value.unavailable, [])
})
