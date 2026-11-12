import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
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
    clock,
    store: createMemorySpacesStore(),
    timer: () => 0
  })
  const today = createToday({ studies, spaces, clock })
  return { today, studies, spaces, siuState, classroomState, advance }
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
    [
      ['examen', 'am1'],
      ['examen', 'sre'],
      ['cursada', 'cda'],
      ['cursada', 'fi1'],
      ['cursada', 'pye'],
      ['cursada', 'vol']
    ]
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
    id: 'evaluacion:ev-5',
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

test('Hoy trae las novedades sin leer de los espacios del alumno', async () => {
  const { today, spaces } = build()

  const before = await today.today('p-taguirre')
  assert.ok(before.ok)
  assert.deepEqual(before.value.unread, [])

  const space = await spaces.open('p-mledesma', 'am1')
  assert.ok(space.ok)
  const avisos = space.value.channels.find((c) => c.kind === 'avisos')
  assert.ok(avisos)
  assert.equal((await spaces.post('p-mledesma', avisos.id, { text: 'El parcial es en el aula 20.' })).ok, true)

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  // Al abrir el espacio, Ledesma trajo de Moodle su aviso y los recursos de las dos comisiones de la materia.
  assert.deepEqual(
    result.value.unread.map((u) => [u.subjectId, u.kind, u.count, u.latest.text, u.latest.origin]),
    [
      ['am1', 'avisos', 2, 'El parcial es en el aula 20.', 'hackai'],
      ['am1', 'material', 3, 'Guía de ejercicios 2', 'moodle']
    ]
  )
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
  // Las novedades necesitan las comisiones, que el SIU no dio antes de caerse.
  assert.deepEqual(result.value.unavailable, ['openEnrollments', 'unread'])
})

test('con Moodle caído y nada leído antes faltan las materias y sus entregas, pero los parciales, finales e inscripciones se ven igual', async () => {
  const { today, classroomState } = build()
  classroomState.down = true

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.unavailable, ['subjects'])
  assert.deepEqual(result.value.subjects, { current: [], archived: [] })
  assert.deepEqual(
    result.value.upcoming.map((i) => [i.subjectCode, i.name, i.source]),
    [
      ['AM1', 'Primer parcial', 'siu'],
      ['PR1', 'TP integrador', 'siu'],
      ['AM1', 'Segundo parcial', 'siu'],
      ['PR1', 'Parcial', 'siu'],
      ['AM1', 'Recuperatorio', 'siu'],
      ['AGA', 'Final', 'siu']
    ]
  )
  assert.equal(result.value.next?.name, 'Segundo parcial')
  assert.deepEqual(
    result.value.openEnrollments.map((i) => [i.kind, i.subjectId]),
    [
      ['examen', 'am1'],
      ['examen', 'sre'],
      ['cursada', 'cda'],
      ['cursada', 'fi1'],
      ['cursada', 'pye'],
      ['cursada', 'vol']
    ]
  )
  assert.equal(result.value.staleSince, null)
})

test('lo desactualizado se mira contra el reloj: lo que ya pasó sale pasado y lo que cerró no sale', async () => {
  const { today, siuState, advance } = build()
  const first = await today.today('p-taguirre')
  assert.ok(first.ok)
  siuState.down = true

  advance((6 * 24 + 1) * 60) // lunes 16 a las 13:00: el segundo parcial ya se tomó
  const monday = await today.today('p-taguirre')
  advance(20 * 24 * 60) // domingo 6/12: cerró la inscripción a las mesas de diciembre
  const december = await today.today('p-taguirre')

  assert.ok(monday.ok && december.ok)
  assert.equal(monday.value.staleSince, NOW)
  assert.equal(monday.value.upcoming.find((i) => i.id === 'evaluacion:ev-5')?.past, true)
  assert.deepEqual([monday.value.next?.subjectCode, monday.value.next?.name], ['PR1', 'Parcial'])
  assert.deepEqual(
    monday.value.openEnrollments.map((i) => [i.kind, i.subjectId]),
    [
      ['examen', 'am1'],
      ['examen', 'sre'],
      ['cursada', 'cda'],
      ['cursada', 'fi1'],
      ['cursada', 'pye'],
      ['cursada', 'vol']
    ]
  )
  assert.deepEqual(
    december.value.openEnrollments.map((i) => [i.kind, i.subjectId]),
    [
      ['cursada', 'cda'],
      ['cursada', 'fi1'],
      ['cursada', 'pye'],
      ['cursada', 'vol']
    ],
    'la mesa cerró el 4/12; el verano sigue abierto'
  )
})

test('con el SIU caído y nada leído antes, Hoy responde igual, con todo marcado como no disponible', async () => {
  const { today, siuState } = build()
  siuState.down = true

  const result = await today.today('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.unavailable, ['subjects', 'upcoming', 'openEnrollments', 'unread'])
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

test('el final al que se acaba de inscribir sale entre los próximos de Hoy y su mesa deja de estar entre las inscripciones abiertas', async () => {
  const { today, studies } = build()
  const before = await today.today('p-vfunes')
  assert.ok(before.ok)
  assert.equal(
    before.value.upcoming.some((i) => i.kind === 'final'),
    false
  )
  assert.ok(before.value.openEnrollments.some((i) => i.kind === 'examen' && i.subjectId === 'aga'))

  assert.equal((await studies.enroll('p-vfunes', { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' })).ok, true)
  const after = await today.today('p-vfunes')

  assert.ok(after.ok)
  assert.deepEqual(
    after.value.upcoming.filter((i) => i.kind === 'final').map((i) => [i.id, i.subjectCode, i.name, i.date, i.past]),
    [['mesa:mesa-aga-fi-dic', 'AGA', 'Final', '2026-12-09T12:00:00.000Z', false]]
  )
  assert.equal(
    after.value.openEnrollments.some((i) => i.kind === 'examen' && i.subjectId === 'aga'),
    false
  )
  assert.equal(after.value.staleSince, null)
})
