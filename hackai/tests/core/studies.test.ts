import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData, type SyntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies, type MySubject } from '@/lib/core/studies'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'

const NOW = syntheticData.now

/** Reloj que se puede adelantar, para ver la hora de cada lectura. */
function movableClock(start: string) {
  let current = new Date(start)
  const clock: ClockPort = { capabilities: { fixed: true }, now: () => new Date(current) }
  return { clock, advance: (minutes: number) => { current = new Date(current.getTime() + minutes * 60_000) } }
}

/** SIU en memoria que se puede «caer»: con `down`, toda lectura devuelve `falla-externa`. */
function fallibleSiu(siu: SiuPort) {
  const state = { down: false }
  const wrapped = new Proxy(siu, {
    get(target, key: keyof SiuPort) {
      const value = target[key]
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => state.down ? Promise.resolve(fail('falla-externa')) : (value as (...a: unknown[]) => unknown).apply(target, args)
    },
  })
  return { siu: wrapped, state }
}

function build(data: SyntheticData = syntheticData) {
  const { clock, advance } = movableClock(data.now)
  const { siu, state } = fallibleSiu(createMemorySiu(data, clock))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom: createMemoryClassroom(data), clock })
  return { studies, siuState: state, advance }
}

/** Copia del set sintético con una inscripción a cursada de más. */
function withEnrollment(personSiuId: string, sectionId: string, status: 'aceptada' | 'baja' = 'aceptada'): SyntheticData {
  const data = structuredClone(syntheticData)
  data.siu.courseEnrollments.push({
    id: 'ic-extra', transactionNumber: 'T-999999', personId: personSiuId, sectionId, date: data.siu.courseEnrollments[0].date, status,
  })
  return data
}

const names = (subjects: MySubject[]) => subjects.map((s) => `${s.code} ${s.sectionName}`)

test('un alumno ve sus materias del período lectivo actual arriba y las anteriores archivadas', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.readAt, NOW)
  assert.deepEqual(names(result.value.data.current), ['AM1 A', 'PR1 A'])
  assert.deepEqual(names(result.value.data.archived), ['AGA A'])
  assert.deepEqual(result.value.data.current[0], {
    subjectId: 'am1',
    code: 'AM1',
    name: 'Análisis Matemático I',
    schoolId: 'fi',
    termId: '2c-2026',
    termName: 'Grado 2do Cuatrimestre 2026',
    sectionId: 'sec-am1-fi-a',
    sectionName: 'A',
    role: 'alumno',
    classroomCourseIds: ['c-am1-fi-a'],
  })
})

test('un alumno no ve materias de otra facultad, aunque el SIU lo tenga inscripto', async () => {
  // Tomás es de Ingeniería; Análisis Matemático I también se dicta en Ciencias Empresariales.
  const { studies } = build(withEnrollment('30101', 'sec-am1-fce-a'))

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.current.map((s) => s.sectionId), ['sec-am1-fi-a', 'sec-pr1-fi-a'])
})

test('las comisiones de la otra facultad son las de sus propios alumnos', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-nherrera')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.current.map((s) => s.sectionId), ['sec-am1-fce-a', 'sec-co1-fce-a'])
  assert.deepEqual(result.value.data.archived.map((s) => s.sectionId), ['sec-iec-fce-a'])
})

test('una inscripción dada de baja no aparece entre sus materias', async () => {
  const data = structuredClone(syntheticData)
  data.siu.courseEnrollments.find((e) => e.personId === '30102' && e.sectionId === 'sec-pr1-fi-a')!.status = 'baja'
  const { studies } = build(data)

  const result = await studies.subjectsOf('p-lbenitez')

  assert.ok(result.ok)
  assert.deepEqual(names(result.value.data.current), ['AM1 A'])
})

test('una materia de un período lectivo que todavía no empezó va con las actuales, después de las del período en curso', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-mcabrera')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.current.map((s) => s.termId), ['2c-2026', 'verano-2027'])
  assert.deepEqual(result.value.data.archived, [])
})

test('un docente ve las materias de las comisiones que dicta', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-mledesma')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.current.map((s) => [s.sectionId, s.role]), [['sec-am1-fi-a', 'profesor']])
  assert.deepEqual(result.value.data.archived.map((s) => [s.sectionId, s.role]), [['sec-aga-fi-a', 'profesor']])
})

test('con el SIU caído devuelve lo último que leyó, con su hora y marcado como desactualizado', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.subjectsOf('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true
  const second = await studies.subjectsOf('p-taguirre')

  assert.deepEqual(second, { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
})

test('con el SIU caído y sin nada leído antes devuelve «falla externa»', async () => {
  const { studies, siuState } = build()
  siuState.down = true

  assert.deepEqual(await studies.subjectsOf('p-taguirre'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await studies.sectionsOf('p-taguirre'), { ok: false, error: 'falla-externa' })
})

test('las materias de una persona que no existe devuelven «persona desconocida»', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.subjectsOf('p-nadie'), { ok: false, error: 'persona-desconocida' })
  assert.deepEqual(await studies.sectionsOf('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

test('sectionsOf devuelve las comisiones del alumno con sus docentes como personas de HackAI', async () => {
  const { studies } = build()

  const result = await studies.sectionsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.deepEqual(result.value.data.map((s) => s.sectionId), ['sec-am1-fi-a', 'sec-pr1-fi-a', 'sec-aga-fi-a'])
  assert.deepEqual(result.value.data[0], {
    sectionId: 'sec-am1-fi-a',
    name: 'A',
    subjectId: 'am1',
    schoolId: 'fi',
    termId: '2c-2026',
    role: 'alumno',
    teachers: [{ personId: 'p-mledesma', name: 'Mariana Ledesma' }],
  })
})

test('sectionsOf de un docente devuelve las comisiones que dicta, y de un alumno nunca las de otra facultad', async () => {
  const { studies } = build(withEnrollment('30101', 'sec-am1-fce-a'))

  const docente = await studies.sectionsOf('p-gferreyra')
  assert.ok(docente.ok)
  assert.deepEqual(docente.value.data.map((s) => [s.sectionId, s.role]), [['sec-am1-fi-b', 'profesor'], ['sec-fi1-fi-v', 'profesor']])

  const alumno = await studies.sectionsOf('p-taguirre')
  assert.ok(alumno.ok)
  assert.equal(alumno.value.data.some((s) => s.schoolId !== 'fi'), false)
})

test('sectionsOf con el SIU caído devuelve lo último que leyó, marcado como desactualizado', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.sectionsOf('p-lbenitez')
  assert.ok(first.ok)

  advance(5)
  siuState.down = true

  assert.deepEqual(await studies.sectionsOf('p-lbenitez'), { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
})
