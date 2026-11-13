/* Historial de clases de la comisión (#110), por la interfaz de Cursada, con
   adaptadores en memoria, datos sintéticos y reloj fijo (martes 10/11). Docente:
   Gabriela Ferreyra, comisión B de Análisis Matemático I (martes y jueves). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import { movableClock } from '@/tests/core/helpers'

const SECTION = 'sec-am1-fi-b'
const TODAY_CLASS = '2026-11-10T17:00:00.000Z'
const TEACHER = 'p-gferreyra'
const OTHER_TEACHER = 'p-mledesma'
const STUDENT = 'p-mcabrera'
const LEGAJO = { mcabrera: '30103', sdominguez: '30104' }

function build() {
  const { clock } = movableClock(syntheticData.now)
  const siu = createMemorySiu(syntheticData, clock)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
  return createStudies({
    people,
    siu,
    classroom: createMemoryClassroom(syntheticData),
    clock,
    store: createMemoryStudiesStore()
  })
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

test('sin listas tomadas el historial está vacío', async () => {
  const studies = build()

  assert.deepEqual(value(await studies.classHistory(TEACHER, SECTION)), [])
})

test('el historial muestra la clase tomada con sus ausentes, la modalidad y el estado del pase', async () => {
  const studies = build()
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.sdominguez, LEGAJO.mcabrera]))

  const history = value(await studies.classHistory(TEACHER, SECTION))

  assert.equal(history.length, 1)
  const [entry] = history
  assert.equal(entry.classAt, TODAY_CLASS)
  assert.equal(entry.today, true)
  assert.equal(entry.modality, 'presencial')
  assert.equal(entry.pass, 'pasado')
  assert.equal(entry.total, 3)
  assert.deepEqual(entry.absent.map((a) => a.legajo).sort(), [LEGAJO.mcabrera, LEGAJO.sdominguez])
  assert.ok(entry.absent.every((a) => typeof a.name === 'string' && a.name.length > 0))
  const names = entry.absent.map((a) => a.name as string)
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, 'es'))
  )
})

test('una clase sin ausentes figura con la lista vacía, y el estado del pase pendiente se ve', async () => {
  const { clock } = movableClock(syntheticData.now)
  const memory = createMemorySiu(syntheticData, clock)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu: memory,
    store: createMemoryPeopleStore(syntheticData)
  })
  const studies = createStudies({
    people,
    siu: { ...memory, recordAttendance: async () => ({ ok: false, error: 'falla-externa' }) },
    classroom: createMemoryClassroom(syntheticData),
    clock,
    store: createMemoryStudiesStore()
  })
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, []))

  const [entry] = value(await studies.classHistory(TEACHER, SECTION))

  assert.deepEqual(entry.absent, [])
  assert.equal(entry.pass, 'pendiente')
})

test('un docente de otra comisión y un alumno no ven el historial', async () => {
  const studies = build()
  value(await studies.takeAttendance(TEACHER, SECTION, TODAY_CLASS, [LEGAJO.mcabrera]))

  assert.deepEqual(await studies.classHistory(OTHER_TEACHER, SECTION), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await studies.classHistory(STUDENT, SECTION), { ok: false, error: 'sin-acceso' })
})
