/* La clase de ahora en Hoy y el enlace de Zoom (A4 de Docentes, #109), por la
   interfaz de Cursada y de Hoy, con adaptadores en memoria, datos sintéticos y
   reloj fijo. Reloj: martes 10/11 a las 12 en Buenos Aires. El docente es Diego
   Arrieta: Programación I A (viernes de 9 a 12, híbrida, hasta el 29/11) y
   Taller de oratoria (jueves de 18 a 20, presencial); las de verano empiezan
   en 2027. Su alumno es Tomás Aguirre (PR1 A). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classesIn, classSlotsOf } from '@/components/today/calendar-layout'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createSpaces } from '@/lib/core/spaces'
import { createStudies, currentClass, hasClassOn } from '@/lib/core/studies'
import { createToday } from '@/lib/core/today'
import { fallible, movableClock } from '@/tests/core/helpers'

const TEACHER = 'p-darrieta'
const OTHER_TEACHER = 'p-mledesma'
const STUDENT = 'p-taguirre'
const HYBRID = 'sec-pr1-fi-a'
const IN_PERSON = 'sec-tor-fi-a'
const ZOOM = 'https://zoom.us/j/123456789'

const MINUTES_TO_FRIDAY_10 = (3 * 24 - 2) * 60

function build() {
  const data = syntheticData
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(data, clock))
  const { port: classroom, state: classroomState } = fallible(createMemoryClassroom(data))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom, clock, store: createMemoryStudiesStore() })
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
  const coursework = createCoursework({
    studies,
    files: createMemoryFiles(),
    clock,
    store: createMemoryCourseworkStore()
  })
  const today = createToday({ studies, spaces, coursework, clock })
  return { studies, today, advance, siuState, classroomState }
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const zoomOf = async (studies: ReturnType<typeof build>['studies'], personId: string, sectionId: string) =>
  value(await studies.subjectsOf(personId)).data.current.find((s) => s.sectionId === sectionId)?.zoomUrl

test('el docente de la comisión carga el enlace de Zoom y el alumno lo ve en su materia', async () => {
  const { studies } = build()
  assert.equal(await zoomOf(studies, STUDENT, HYBRID), null)

  assert.deepEqual(await studies.setZoomLink(TEACHER, HYBRID, `  ${ZOOM}  `), { ok: true, value: ZOOM })

  assert.equal(await zoomOf(studies, STUDENT, HYBRID), ZOOM)
  assert.equal(await zoomOf(studies, TEACHER, HYBRID), ZOOM)
})

test('el docente cambia el enlace y lo borra con un texto vacío', async () => {
  const { studies } = build()
  await studies.setZoomLink(TEACHER, HYBRID, ZOOM)

  await studies.setZoomLink(TEACHER, HYBRID, 'https://zoom.us/j/999')
  assert.equal(await zoomOf(studies, STUDENT, HYBRID), 'https://zoom.us/j/999')

  assert.deepEqual(await studies.setZoomLink(TEACHER, HYBRID, ''), { ok: true, value: null })
  assert.equal(await zoomOf(studies, STUDENT, HYBRID), null)
})

test('solo un docente de la comisión carga o cambia el enlace', async () => {
  const { studies } = build()
  await studies.setZoomLink(TEACHER, HYBRID, ZOOM)

  assert.deepEqual(await studies.setZoomLink(OTHER_TEACHER, HYBRID, 'https://zoom.us/j/1'), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await studies.setZoomLink(STUDENT, HYBRID, 'https://zoom.us/j/1'), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await studies.setZoomLink(TEACHER, 'sec-am1-fi-a', 'https://zoom.us/j/1'), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await studies.setZoomLink('p-nadie', HYBRID, 'https://zoom.us/j/1'), {
    ok: false,
    error: 'persona-desconocida'
  })
  assert.equal(await zoomOf(studies, STUDENT, HYBRID), ZOOM)
})

test('el enlace tiene que ser https', async () => {
  const { studies } = build()
  for (const bad of ['http://zoom.us/j/1', 'zoom.us/j/1', 'javascript:alert(1)', 'https://', 'no es un enlace']) {
    assert.deepEqual(await studies.setZoomLink(TEACHER, HYBRID, bad), { ok: false, error: 'enlace-invalido' })
  }
  assert.equal(await zoomOf(studies, TEACHER, HYBRID), null)
})

test('una clase presencial no lleva Zoom aunque haya un enlace guardado', async () => {
  const { studies } = build()
  await studies.setZoomLink(TEACHER, IN_PERSON, ZOOM)

  assert.equal(await zoomOf(studies, TEACHER, IN_PERSON), null)
})

test('sin clase en este momento, la clase de Hoy es la próxima: el viernes a las 9, híbrida y sin enlace', async () => {
  const { today } = build()

  const view = value(await today.teaching(TEACHER))

  assert.deepEqual(view.nowClass, {
    state: 'proxima',
    sectionId: HYBRID,
    sectionName: 'A',
    subjectId: 'pr1',
    subjectCode: 'PR1',
    subjectName: 'Programación I',
    classAt: '2026-11-13T12:00:00.000Z',
    endAt: '2026-11-13T15:00:00.000Z',
    location: 'Campus Pilar, laboratorio 2',
    modality: 'hibrida',
    zoomUrl: null
  })
  assert.deepEqual(view.unavailable, [])
})

test('durante el horario de la comisión, la clase es la de ahora y lleva el enlace de Zoom', async () => {
  const { today, studies, advance } = build()
  await studies.setZoomLink(TEACHER, HYBRID, ZOOM)

  advance(MINUTES_TO_FRIDAY_10)
  const view = value(await today.teaching(TEACHER))

  assert.equal(view.now, '2026-11-13T13:00:00.000Z')
  assert.equal(view.nowClass?.state, 'ahora')
  assert.equal(view.nowClass?.sectionId, HYBRID)
  assert.equal(view.nowClass?.classAt, '2026-11-13T12:00:00.000Z')
  assert.equal(view.nowClass?.zoomUrl, ZOOM)
})

test('la clase empieza y termina justo en el horario', async () => {
  const { today, advance } = build()

  advance(MINUTES_TO_FRIDAY_10 - 60) // 9:00 en punto
  assert.equal(value(await today.teaching(TEACHER)).nowClass?.state, 'ahora')

  advance(179) // 11:59
  assert.equal(value(await today.teaching(TEACHER)).nowClass?.state, 'ahora')

  advance(1) // 12:00: terminó, sigue la próxima
  const next = value(await today.teaching(TEACHER)).nowClass
  assert.equal(next?.state, 'proxima')
  assert.equal(next?.classAt, '2026-11-19T21:00:00.000Z') // el jueves 19 a las 18, del Taller de oratoria
  assert.equal(next?.sectionId, IN_PERSON)
  assert.equal(next?.zoomUrl, null)
})

test('una clase presencial no muestra el enlace de Zoom en Hoy', async () => {
  const { today, studies, advance } = build()
  await studies.setZoomLink(TEACHER, IN_PERSON, ZOOM)

  advance(MINUTES_TO_FRIDAY_10 + 180) // viernes 13:00, ya terminó PR1
  const next = value(await today.teaching(TEACHER)).nowClass

  assert.equal(next?.sectionId, IN_PERSON)
  assert.equal(next?.modality, 'presencial')
  assert.equal(next?.zoomUrl, null)
})

test('una clase de hoy que todavía no empezó es la próxima, con su hora', async () => {
  const { today } = build()

  // Gustavo Ferreyra dicta AM1 B los martes y jueves de 14 a 16, y son las 12.
  const view = value(await today.teaching('p-gferreyra'))

  assert.equal(view.nowClass?.state, 'proxima')
  assert.equal(view.nowClass?.sectionId, 'sec-am1-fi-b')
  assert.equal(view.nowClass?.classAt, '2026-11-10T17:00:00.000Z')
  assert.equal(view.nowClass?.modality, 'presencial')
})

test('sin clases por delante, Hoy no tiene clase de ahora', async () => {
  const { today, advance } = build()

  advance(36 * 24 * 60) // mediados de diciembre: el cuatrimestre terminó y el verano empieza en enero
  const view = value(await today.teaching('p-gferreyra'))

  assert.equal(view.nowClass, null)
  assert.deepEqual(view.unavailable, [])
})

test('un alumno no tiene clase de ahora: es el Hoy del docente', async () => {
  const { today } = build()

  const view = value(await today.teaching(STUDENT))

  assert.equal(view.nowClass, null)
})

test('con Moodle caído la clase de ahora sale igual, con su enlace', async () => {
  const { today, studies, classroomState } = build()
  await studies.setZoomLink(TEACHER, HYBRID, ZOOM)

  classroomState.down = true
  const view = value(await today.teaching(TEACHER))

  assert.equal(view.nowClass?.zoomUrl, ZOOM)
  assert.deepEqual(view.unavailable, [])
})

test('con el SIU caído y nada leído, la clase de ahora no está disponible y el resto se ve igual', async () => {
  const { today, siuState } = build()

  siuState.down = true
  const view = value(await today.teaching(TEACHER))

  assert.equal(view.nowClass, null)
  assert.ok(view.unavailable.includes('class'))
})

test('currentClass: con dos clases a la vez gana la que empezó antes, y fuera del período no hay clase', () => {
  const term = { termStart: '2026-08-10T03:00:00.000Z', termEnd: '2026-11-29T02:59:00.000Z' }
  const sections = [
    { ...term, schedule: [{ day: 'viernes' as const, start: '10:00', end: '12:00' }] },
    { ...term, schedule: [{ day: 'viernes' as const, start: '09:00', end: '11:00' }] }
  ]

  assert.equal(currentClass(sections, '2026-11-13T13:30:00.000Z')?.index, 1)
  assert.equal(currentClass(sections, '2026-11-13T13:30:00.000Z')?.state, 'ahora')
  assert.equal(currentClass(sections, '2026-12-04T13:30:00.000Z'), null)
  assert.equal(currentClass([], '2026-11-13T13:30:00.000Z'), null)
})

test('el alumno ve el enlace en la clase del Calendario y en la tarjeta solo el día de una clase', async () => {
  const { studies } = build()
  await studies.setZoomLink(TEACHER, HYBRID, ZOOM)
  const subjects = value(await studies.subjectsOf(STUDENT)).data.current
  const pr1 = subjects.find((s) => s.sectionId === HYBRID)
  assert.ok(pr1)

  const week = classesIn(['2026-11-13', '2026-11-14'], classSlotsOf(subjects), '2026-11-10')

  assert.deepEqual(
    week.filter((e) => e.code === 'PR1').map((e) => [e.day, e.zoomUrl]),
    [['2026-11-13', ZOOM]]
  )
  assert.equal(hasClassOn(pr1, '2026-11-13'), true)
  assert.equal(hasClassOn(pr1, '2026-11-12'), false)
  assert.equal(hasClassOn(pr1, '2026-12-04'), false)
})
