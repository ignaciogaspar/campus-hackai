import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom, type MemoryClassroomOptions } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu, type MemorySiuOptions } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import {
  createStudies,
  type MySubject,
  type OpenEnrollment,
  type PendingFinal,
  type UpcomingItem
} from '@/lib/core/studies'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'
import { fallible, movableClock } from '@/tests/core/helpers'

const NOW = syntheticData.now

type BuildOptions = {
  siu?: MemorySiuOptions
  /** Reemplaza operaciones del SIU en memoria, por ejemplo para que una falle. */
  siuOverrides?: Partial<SiuPort>
  /** Reemplaza operaciones del aula en memoria, por ejemplo para que una falle. */
  classroomOverrides?: Partial<ClassroomPort>
}

function build(
  data: SyntheticData = syntheticData,
  classroomOptions: MemoryClassroomOptions = {},
  options: BuildOptions = {}
) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state } = fallible({ ...createMemorySiu(data, clock, options.siu), ...options.siuOverrides })
  const { port: classroom, state: classroomState } = fallible({
    ...createMemoryClassroom(data, classroomOptions),
    ...options.classroomOverrides
  })
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom, clock })
  return { studies, siu, classroom, siuState: state, classroomState, advance }
}

/** Copia del set sintético con una inscripción a cursada de más. */
function withEnrollment(
  personSiuId: string,
  sectionId: string,
  status: 'aceptada' | 'baja' = 'aceptada'
): SyntheticData {
  const data = structuredClone(syntheticData)
  data.siu.courseEnrollments.push({
    id: 'ic-extra',
    transactionNumber: 'T-999999',
    personId: personSiuId,
    sectionId,
    date: data.siu.courseEnrollments[0].date,
    status
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
    termStart: '2026-08-10T03:00:00.000Z',
    termEnd: '2026-11-29T02:59:00.000Z',
    schedule: [
      { day: 'lunes', start: '08:00', end: '10:00' },
      { day: 'miercoles', start: '08:00', end: '10:00' }
    ],
    location: 'Campus Pilar, aula 12',
    modality: 'presencial',
    role: 'alumno',
    classrooms: [
      {
        courseId: 'c-am1-fi-a',
        name: 'Análisis Matemático I - Comisión A (FI) - Grado 2do Cuatrimestre 2026',
        url: `${syntheticData.moodle.baseUrl}/course/view.php?id=c-am1-fi-a`
      }
    ],
    assignments: [
      { id: 't-3', name: 'Guía 3 resuelta', dueDate: '2026-11-14T02:59:00.000Z', source: 'moodle', past: false }
    ]
  })
})

test('las materias no llevan faltas: la tarjeta no las muestra', async () => {
  const { studies } = build()

  const tomas = await studies.subjectsOf('p-taguirre')

  assert.ok(tomas.ok)
  assert.ok(tomas.value.data.current.every((s) => !('absences' in s)))
  assert.ok(!('absencesUnavailable' in tomas.value.data))
})

test('absencesOf da por materia actual las faltas, el máximo, cuántas quedan y el aviso', async () => {
  const { studies } = build()

  const tomas = await studies.absencesOf('p-taguirre')
  assert.ok(tomas.ok)
  const [am1, pr1] = tomas.value.data.subjects
  assert.deepEqual(
    [am1.subjectName, am1.count, am1.justified, am1.max, am1.left, am1.warning],
    ['Análisis Matemático I', 1, 0, 3, 2, null]
  )
  assert.deepEqual(
    am1.absences.map((a) => [a.justified, a.source]),
    [[false, 'siu']]
  )
  // En Programación I lleva 2 de 3: le queda una.
  assert.deepEqual([pr1.count, pr1.justified, pr1.max, pr1.left, pr1.warning], [2, 1, 3, 1, 'cerca'])
  assert.equal(pr1.absences.length, 2)
  // Solo las actuales: las archivadas no están.
  assert.equal(tomas.value.data.subjects.length, 2)

  // Joaquín llegó al máximo en Análisis I.
  const joaquin = await studies.absencesOf('p-jescobar')
  assert.ok(joaquin.ok)
  const [limit] = joaquin.value.data.subjects
  assert.deepEqual([limit.count, limit.justified, limit.max, limit.left, limit.warning], [3, 1, 3, 0, 'limite'])
})

test('un docente no tiene inasistencias', async () => {
  const { studies } = build()

  const docente = await studies.absencesOf('p-mledesma')

  assert.ok(docente.ok)
  assert.deepEqual(docente.value.data.subjects, [])
})

test('sin máximo en el SIU sale solo la cuenta, y pasarse del máximo no da faltas negativas', async () => {
  const data = structuredClone(syntheticData)
  data.siu.absenceLimits = data.siu.absenceLimits.filter((l) => l.sectionId !== 'sec-am1-fi-a')
  data.siu.absences.push(
    {
      id: 'in-extra',
      personId: '30101',
      sectionId: 'sec-pr1-fi-a',
      date: '2026-11-06T11:00:00.000Z',
      justified: false
    },
    {
      id: 'in-extra-2',
      personId: '30101',
      sectionId: 'sec-pr1-fi-a',
      date: '2026-11-04T11:00:00.000Z',
      justified: false
    }
  )
  const { studies } = build(data)

  const result = await studies.absencesOf('p-taguirre')

  assert.ok(result.ok)
  const [am1, pr1] = result.value.data.subjects
  assert.deepEqual([am1.count, am1.max, am1.left, am1.warning], [1, null, null, null])
  assert.deepEqual([pr1.count, pr1.justified, pr1.max, pr1.left, pr1.warning], [4, 1, 3, 0, 'limite'])
})

test('sin faltas no hay aviso, aunque el máximo sea 1', async () => {
  const data = structuredClone(syntheticData)
  data.siu.absences = data.siu.absences.filter((a) => !(a.personId === '30101' && a.sectionId === 'sec-am1-fi-a'))
  data.siu.absenceLimits = data.siu.absenceLimits.map((l) => (l.sectionId === 'sec-am1-fi-a' ? { ...l, max: 1 } : l))
  const { studies } = build(data)

  const result = await studies.absencesOf('p-taguirre')

  assert.ok(result.ok)
  const [am1] = result.value.data.subjects
  assert.deepEqual([am1.count, am1.max, am1.left, am1.warning, am1.absences], [0, 1, 1, null, []])
})

test('si el SIU no da las inasistencias, absencesOf devuelve lo último leído, desactualizado', async () => {
  let down = false
  const memory = createMemorySiu(syntheticData, movableClock(NOW).clock)
  const { studies } = build(
    syntheticData,
    {},
    {
      siuOverrides: { absences: async (personId) => (down ? fail('falla-externa') : memory.absences(personId)) }
    }
  )
  const first = await studies.absencesOf('p-taguirre')
  assert.ok(first.ok)

  down = true
  const stale = await studies.absencesOf('p-taguirre')

  assert.deepEqual(stale, { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
  // Y la lista de materias no se cae por eso.
  const subjects = await studies.subjectsOf('p-taguirre')
  assert.ok(subjects.ok)
  assert.equal(subjects.value.stale, false)
  assert.deepEqual(names(subjects.value.data.current), ['AM1 A', 'PR1 A'])
})

test('un alumno no ve materias de otra facultad, aunque el SIU lo tenga inscripto', async () => {
  // Tomás es de Ingeniería; Análisis Matemático I también se dicta en Ciencias Empresariales.
  const { studies } = build(withEnrollment('30101', 'sec-am1-fce-a'))

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.current.map((s) => s.sectionId),
    ['sec-am1-fi-a', 'sec-pr1-fi-a']
  )
})

test('las comisiones de la otra facultad son las de sus propios alumnos', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-nherrera')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.current.map((s) => s.sectionId),
    ['sec-am1-fce-a', 'sec-co1-fce-a']
  )
  assert.deepEqual(
    result.value.data.archived.map((s) => s.sectionId),
    ['sec-iec-fce-a']
  )
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
  assert.deepEqual(
    result.value.data.current.map((s) => s.termId),
    ['2c-2026', 'verano-2027']
  )
  assert.deepEqual(result.value.data.archived, [])
})

test('un docente ve las materias de las comisiones que dicta', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-mledesma')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.current.map((s) => [s.sectionId, s.role]),
    [['sec-am1-fi-a', 'profesor']]
  )
  assert.deepEqual(
    result.value.data.archived.map((s) => [s.sectionId, s.role]),
    [['sec-aga-fi-a', 'profesor']]
  )
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
  assert.deepEqual(
    result.value.data.map((s) => s.sectionId),
    ['sec-am1-fi-a', 'sec-pr1-fi-a', 'sec-aga-fi-a']
  )
  assert.deepEqual(result.value.data[0], {
    sectionId: 'sec-am1-fi-a',
    name: 'A',
    subjectId: 'am1',
    subjectCode: 'AM1',
    subjectName: 'Análisis Matemático I',
    schoolId: 'fi',
    termId: '2c-2026',
    termName: 'Grado 2do Cuatrimestre 2026',
    current: true,
    role: 'alumno',
    teachers: [{ personId: 'p-mledesma', name: 'Mariana Ledesma' }]
  })
})

test('sectionsOf de un docente devuelve las comisiones que dicta, y de un alumno nunca las de otra facultad', async () => {
  const { studies } = build(withEnrollment('30101', 'sec-am1-fce-a'))

  const docente = await studies.sectionsOf('p-gferreyra')
  assert.ok(docente.ok)
  assert.deepEqual(
    docente.value.data.map((s) => [s.sectionId, s.role]),
    [
      ['sec-am1-fi-b', 'profesor'],
      ['sec-fi1-fi-v', 'profesor'],
      ['sec-fi1-fi-vt', 'profesor']
    ]
  )

  const alumno = await studies.sectionsOf('p-taguirre')
  assert.ok(alumno.ok)
  assert.equal(
    alumno.value.data.some((s) => s.schoolId !== 'fi'),
    false
  )
})

test('sectionsOf con el SIU caído devuelve lo último que leyó, marcado como desactualizado', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.sectionsOf('p-lbenitez')
  assert.ok(first.ok)

  advance(5)
  siuState.down = true

  assert.deepEqual(await studies.sectionsOf('p-lbenitez'), {
    ok: true,
    value: { data: first.value.data, readAt: NOW, stale: true }
  })
})

// Aula virtual: el enlace a Moodle y las tareas con fecha de cada materia.

const classroomOf = (subject: MySubject) => subject.classrooms.map((c) => c.courseId)
const tasks = (subject: MySubject) => subject.assignments.map((a) => [a.name, a.past])

test('cada materia lleva el enlace al aula de su comisión, actual o archivada', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  const { current, archived } = result.value.data
  assert.deepEqual(
    [...current, ...archived].map((s) => [s.sectionId, s.classrooms.map((c) => c.url)]),
    [
      ['sec-am1-fi-a', [`${syntheticData.moodle.baseUrl}/course/view.php?id=c-am1-fi-a`]],
      ['sec-pr1-fi-a', [`${syntheticData.moodle.baseUrl}/course/view.php?id=c-pr1-fi-a`]],
      ['sec-aga-fi-a', [`${syntheticData.moodle.baseUrl}/course/view.php?id=c-aga-fi-a`]]
    ]
  )
  assert.deepEqual(
    archived.map((s) => s.classrooms[0].name),
    ['Álgebra y Geometría Analítica - Comisión A (FI) - Grado 1er Cuatrimestre 2026']
  )
})

test('las tareas con fecha van ordenadas por fecha, con las vencidas marcadas según el reloj', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  const [am1, pr1] = result.value.data.current
  assert.deepEqual(tasks(am1), [['Guía 3 resuelta', false]])
  assert.deepEqual(pr1.assignments, [
    { id: 't-1', name: 'Entrega del TP integrador', dueDate: '2026-10-17T02:59:00.000Z', source: 'moodle', past: true },
    { id: 't-2', name: 'Ejercicios de recursión', dueDate: '2026-11-22T02:59:00.000Z', source: 'moodle', past: false }
  ])
})

test('una tarea pasa a vencida cuando el reloj llega a su fecha', async () => {
  const { studies, advance } = build()
  const before = await studies.subjectsOf('p-taguirre')
  assert.ok(before.ok)
  assert.deepEqual(tasks(before.value.data.current[1]), [
    ['Entrega del TP integrador', true],
    ['Ejercicios de recursión', false]
  ])

  advance(12 * 24 * 60)
  const after = await studies.subjectsOf('p-taguirre')

  assert.ok(after.ok)
  assert.deepEqual(tasks(after.value.data.current[1]), [
    ['Entrega del TP integrador', true],
    ['Ejercicios de recursión', true]
  ])
  assert.deepEqual(tasks(after.value.data.current[0]), [['Guía 3 resuelta', true]])
})

test('las tareas de varios cursos de una misma comisión se juntan y se ordenan por fecha', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses.push({
    id: 'c-am1-fi-a-lab',
    shortName: 'AM1-LAB',
    fullName: 'Laboratorio de AM1',
    siuSectionIds: ['sec-am1-fi-a']
  })
  data.moodle.assignments.push(
    { id: 't-9', courseId: 'c-am1-fi-a-lab', name: 'Informe de laboratorio', dueDate: '2026-11-12T20:00:00.000Z' },
    { id: 't-10', courseId: 'c-am1-fi-a', name: 'Guía 4 resuelta', dueDate: '2026-12-01T20:00:00.000Z' }
  )
  const { studies } = build(data)

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  const am1 = result.value.data.current[0]
  assert.deepEqual(classroomOf(am1), ['c-am1-fi-a', 'c-am1-fi-a-lab'])
  assert.deepEqual(tasks(am1), [
    ['Informe de laboratorio', false],
    ['Guía 3 resuelta', false],
    ['Guía 4 resuelta', false]
  ])
})

test('las tareas sin fecha no aparecen', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-nherrera')

  assert.ok(result.ok)
  const co1 = result.value.data.current.find((s) => s.sectionId === 'sec-co1-fce-a')!
  assert.deepEqual(classroomOf(co1), ['c-co1-fce-a'])
  assert.deepEqual(co1.assignments, [])
})

test('las materias archivadas llevan el enlace al aula pero no las tareas', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.assignments.push({
    id: 't-8',
    courseId: 'c-aga-fi-a',
    name: 'Entrega final de Álgebra',
    dueDate: '2026-12-20T20:00:00.000Z'
  })
  const { studies } = build(data)

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.archived.map((s) => [s.sectionId, classroomOf(s), s.assignments]),
    [['sec-aga-fi-a', ['c-aga-fi-a'], []]]
  )
})

test('un docente ve el aula y las tareas de las comisiones que dicta', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-mledesma')

  assert.ok(result.ok)
  const [am1] = result.value.data.current
  assert.deepEqual(
    [am1.sectionId, classroomOf(am1), tasks(am1)],
    ['sec-am1-fi-a', ['c-am1-fi-a'], [['Guía 3 resuelta', false]]]
  )
})

test('una comisión sin curso de Moodle no lleva aula ni tareas', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses = data.moodle.courses.filter((c) => c.id !== 'c-pr1-fi-a')
  data.moodle.assignments = data.moodle.assignments.filter((a) => a.courseId !== 'c-pr1-fi-a')
  const { studies } = build(data)

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  const pr1 = result.value.data.current.find((s) => s.sectionId === 'sec-pr1-fi-a')!
  assert.deepEqual([pr1.classrooms, pr1.assignments], [[], []])
})

test('si el aula no tiene tareas con fecha, las materias salen con el enlace y sin tareas, sin error', async () => {
  const { studies } = build(syntheticData, { capabilities: { hasAssignments: false } })

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  const { current } = result.value.data
  assert.deepEqual(
    current.map((s) => [classroomOf(s), s.assignments]),
    [
      [['c-am1-fi-a'], []],
      [['c-pr1-fi-a'], []]
    ]
  )
})

test('con Moodle caído y el SIU arriba, las materias salen al día del SIU, sin enlaces al aula ni tareas, marcando que faltan', async () => {
  const { studies, classroomState } = build()
  classroomState.down = true

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.data.classroomUnavailable, true)
  assert.deepEqual(
    result.value.data.current.map((s) => [s.code, s.sectionName, s.classrooms, s.assignments]),
    [
      ['AM1', 'A', [], []],
      ['PR1', 'A', [], []]
    ]
  )
  assert.ok(result.value.data.archived.length > 0)
  // Las comisiones no dependen de Moodle.
  assert.equal((await studies.sectionsOf('p-taguirre')).ok, true)
})

test('con todo andando, las materias no marcan que falte el aula', async () => {
  const { studies } = build()

  const result = await studies.subjectsOf('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.data.classroomUnavailable, false)
})

test('una lectura sin el aula no pisa la completa: si después se cae el SIU, vuelven los enlaces al aula y las tareas', async () => {
  const { studies, siuState, classroomState, advance } = build()
  const complete = await studies.subjectsOf('p-taguirre')
  assert.ok(complete.ok)

  advance(10)
  classroomState.down = true
  const partial = await studies.subjectsOf('p-taguirre')
  assert.ok(partial.ok)
  assert.equal(partial.value.data.classroomUnavailable, true)

  advance(10)
  classroomState.down = false
  siuState.down = true
  const stale = await studies.subjectsOf('p-taguirre')

  assert.deepEqual(stale, { ok: true, value: { data: complete.value.data, readAt: NOW, stale: true } })
})

test('sin una lectura completa antes, la lectura sin el aula queda como lo último leído, marcando qué falta', async () => {
  const { studies, siuState, classroomState } = build()
  classroomState.down = true
  const partial = await studies.subjectsOf('p-taguirre')
  assert.ok(partial.ok)

  siuState.down = true
  const stale = await studies.subjectsOf('p-taguirre')

  assert.ok(stale.ok)
  assert.equal(stale.value.stale, true)
  assert.equal(stale.value.data.classroomUnavailable, true)
})

test('con Moodle y el SIU caídos devuelve lo último que leyó completo, marcado como desactualizado', async () => {
  const { studies, siuState, classroomState, advance } = build()
  const first = await studies.subjectsOf('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true
  classroomState.down = true
  const second = await studies.subjectsOf('p-taguirre')

  assert.deepEqual(second, { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
})

// Próximos: parciales y finales de todas sus materias, solo del SIU (las entregas de Moodle las suma Hoy).

const dated = (items: UpcomingItem[]) => items.map((i) => [i.date, i.subjectCode, i.name, i.kind, i.source, i.past])

test('los parciales y finales de todas sus materias salen juntos y ordenados por fecha, con los pasados marcados', async () => {
  const { studies } = build()

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.readAt, NOW)
  assert.deepEqual(dated(result.value.data), [
    ['2026-09-21T11:00:00.000Z', 'AM1', 'Primer parcial', 'parcial', 'siu', true],
    ['2026-10-16T12:00:00.000Z', 'PR1', 'TP integrador', 'tp', 'siu', true],
    ['2026-11-16T11:00:00.000Z', 'AM1', 'Segundo parcial', 'parcial', 'siu', false],
    ['2026-11-20T12:00:00.000Z', 'PR1', 'Parcial', 'parcial', 'siu', false],
    ['2026-11-25T11:00:00.000Z', 'AM1', 'Recuperatorio', 'recuperatorio', 'siu', false],
    ['2026-12-09T12:00:00.000Z', 'AGA', 'Final', 'final', 'siu', false]
  ])
  assert.deepEqual(result.value.data.at(-1), {
    id: 'mesa:mesa-aga-fi-dic',
    kind: 'final',
    source: 'siu',
    subjectId: 'aga',
    subjectCode: 'AGA',
    subjectName: 'Álgebra y Geometría Analítica',
    name: 'Final',
    date: '2026-12-09T12:00:00.000Z',
    past: false,
    examPeriod: 'Turno Diciembre 2026',
    location: 'Campus Pilar, aula 12',
    hasSection: true
  })
  // Los parciales no tienen turno, y el cronograma del SIU no dice dónde se rinden.
  assert.deepEqual(
    result.value.data.filter((i) => i.kind !== 'final').map((i) => [i.examPeriod, i.location]),
    Array(5).fill([null, null])
  )
})

test('un final sin lugar en el SIU sale con su turno y sin lugar', async () => {
  const data = structuredClone(syntheticData)
  data.siu.examBoards.find((b) => b.id === 'mesa-aga-fi-dic')!.location = '  '
  const { studies } = build(data)

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  const final = result.value.data.find((i) => i.id === 'mesa:mesa-aga-fi-dic')
  assert.deepEqual([final?.examPeriod, final?.location], ['Turno Diciembre 2026', null])
})

test('un final dice si la persona tiene comisión de la materia: la archivada cuenta, rendir libre no', async () => {
  const data = structuredClone(syntheticData)
  const aga = data.siu.examBoards.find((b) => b.id === 'mesa-aga-fi-dic')!
  data.siu.examBoards.push({ ...aga, id: 'mesa-fi1-fi-dic', subjectId: 'fi1', date: '2026-12-15T12:00:00.000Z' })
  const enrollment = data.siu.examEnrollments.find((e) => e.examBoardId === 'mesa-aga-fi-dic')!
  data.siu.examEnrollments.push({ ...enrollment, id: 'ie-fi1', examBoardId: 'mesa-fi1-fi-dic' })
  const { studies } = build(data)

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.map((i) => [i.subjectCode, i.name, i.hasSection]),
    [
      ['AM1', 'Primer parcial', true],
      ['PR1', 'TP integrador', true],
      ['AM1', 'Segundo parcial', true],
      ['PR1', 'Parcial', true],
      ['AM1', 'Recuperatorio', true],
      ['AGA', 'Final', true],
      ['FI1', 'Final', false]
    ]
  )
})

test('al docente le salen los parciales de sus comisiones actuales y las mesas que integra, no las de otros', async () => {
  const { studies } = build()

  const ledesma = await studies.upcoming('p-mledesma')
  const bustos = await studies.upcoming('p-cbustos')

  assert.ok(ledesma.ok)
  assert.deepEqual(
    ledesma.value.data.map((i) => [i.subjectCode, i.name, i.past, i.location]),
    [
      ['AM1', 'Primer parcial', true, null],
      ['AM1', 'Segundo parcial', false, null],
      ['AM1', 'Recuperatorio', false, null],
      ['AGA', 'Final', false, 'Campus Pilar, aula 12'],
      ['AM1', 'Final', false, 'Campus Pilar, aula 14']
    ]
  )
  assert.ok(bustos.ok)
  assert.deepEqual(
    bustos.value.data.filter((i) => i.kind === 'final').map((i) => i.id),
    ['mesa:mesa-iec-fce-dic']
  )
})

test('los finales son los de las mesas a las que está inscripto: ni una baja ni las mesas de otros', async () => {
  const data = structuredClone(syntheticData)
  data.siu.examEnrollments[0].status = 'baja'
  data.siu.examEnrollments.push({
    id: 'ie-extra',
    transactionNumber: 'T-299999',
    personId: '30101',
    examBoardId: 'mesa-am1-fi-dic',
    date: data.siu.examEnrollments[0].date,
    status: 'aceptada'
  })
  const { studies } = build(data)

  const tomas = await studies.upcoming('p-taguirre')
  const lucia = await studies.upcoming('p-lbenitez')

  assert.ok(tomas.ok)
  assert.deepEqual(
    tomas.value.data.filter((i) => i.kind === 'final').map((i) => [i.subjectCode, i.date]),
    [['AM1', '2026-12-11T12:00:00.000Z']]
  )
  assert.ok(lucia.ok)
  assert.deepEqual(
    lucia.value.data.filter((i) => i.kind === 'final'),
    []
  )
})

test('si el SIU no tiene cronograma, salen solo los finales, sin error', async () => {
  const { studies } = build(syntheticData, {}, { siu: { capabilities: { hasAssessmentSchedule: false } } })

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.deepEqual(
    result.value.data.map((i) => [i.subjectCode, i.name]),
    [['AGA', 'Final']]
  )
})

test('un parcial pasa a «ya pasó» cuando el reloj llega a su fecha', async () => {
  const { studies, advance } = build()

  advance(6 * 24 * 60)
  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  const segundo = result.value.data.find((i) => i.subjectCode === 'AM1' && i.name === 'Segundo parcial')
  assert.equal(segundo?.past, true)
  assert.equal(result.value.data.find((i) => i.name === 'Parcial')?.past, false)
})

test('los próximos con el SIU caído devuelven lo último que leyó, marcado como desactualizado', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.upcoming('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true
  assert.deepEqual(await studies.upcoming('p-taguirre'), {
    ok: true,
    value: { data: first.value.data, readAt: NOW, stale: true }
  })
})

test('los próximos no dependen de Moodle: con el aula caída y nada leído antes salen igual, al día', async () => {
  const { studies, classroomState } = build()
  classroomState.down = true

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.data.length, 6)
  assert.equal(
    result.value.data.every((i) => i.source === 'siu'),
    true
  )
})

test('los finales que ya se tomaron en su período actual salen marcados como pasados; los de antes, no', async () => {
  const data = structuredClone(syntheticData)
  const aga = data.siu.examBoards.find((b) => b.id === 'mesa-aga-fi-dic')!
  data.siu.examBoards.push(
    { ...aga, id: 'mesa-aga-fi-sep', date: '2026-09-21T12:00:00.000Z' },
    { ...aga, id: 'mesa-aga-fi-jul', date: '2026-07-20T12:00:00.000Z' }
  )
  const enrollment = data.siu.examEnrollments.find((e) => e.examBoardId === 'mesa-aga-fi-dic')!
  data.siu.examEnrollments.push(
    { ...enrollment, id: 'ie-sep', examBoardId: 'mesa-aga-fi-sep' },
    { ...enrollment, id: 'ie-jul', examBoardId: 'mesa-aga-fi-jul' }
  )
  const { studies } = build(data)

  const result = await studies.upcoming('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.filter((i) => i.kind === 'final').map((i) => [i.id, i.past]),
    [
      ['mesa:mesa-aga-fi-sep', true],
      ['mesa:mesa-aga-fi-dic', false]
    ]
  )
})

test('los próximos sin nada leído antes y con el SIU caído devuelven «falla externa»; de alguien que no existe, «persona desconocida»', async () => {
  const { studies, siuState } = build()

  assert.deepEqual(await studies.upcoming('p-nadie'), { ok: false, error: 'persona-desconocida' })
  siuState.down = true
  assert.deepEqual(await studies.upcoming('p-taguirre'), { ok: false, error: 'falla-externa' })
})

// Inscripciones abiertas que le sirven: hoy (10/11) está abierta la de verano y la de las mesas de diciembre.

const openings = (items: OpenEnrollment[]) => items.map((i) => [i.kind, i.subjectId, i.closesAt])

test('ve las mesas de lo que tiene regular o está cursando y las comisiones de verano de lo que le falta cursar, las que cierran antes primero', async () => {
  const { studies } = build()

  // Valentina tiene Álgebra regular, cursa Análisis I y no cursó Física I, Programación I
  // ni las materias que solo se dictan en verano. Las actividades de Ingeniería que dan
  // créditos salen como «actividad».
  const result = await studies.openEnrollments('p-vfunes')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.readAt, NOW)
  assert.deepEqual(openings(result.value.data), [
    ['actividad', 'tor', '2026-11-17T02:59:00.000Z'],
    ['examen', 'aga', '2026-12-05T02:59:00.000Z'],
    ['examen', 'am1', '2026-12-05T02:59:00.000Z'],
    ['cursada', 'cda', '2026-12-19T02:59:00.000Z'],
    ['cursada', 'fi1', '2026-12-19T02:59:00.000Z'],
    ['cursada', 'pye', '2026-12-19T02:59:00.000Z'],
    ['cursada', 'pr1', '2026-12-19T02:59:00.000Z'],
    ['actividad', 'lid', '2026-12-19T02:59:00.000Z'],
    ['actividad', 'vol', '2026-12-19T02:59:00.000Z']
  ])
  assert.deepEqual(result.value.data[6], {
    kind: 'cursada',
    subjectId: 'pr1',
    subjectName: 'Programación I',
    opensAt: '2026-11-02T03:00:00.000Z',
    closesAt: '2026-12-19T02:59:00.000Z',
    closesInDays: 38,
    spotsLeft: null,
    needsRegularity: false,
    credits: null
  })
  assert.equal(result.value.data[0].credits, 2)
  assert.equal(result.value.data[7].credits, 3)
  assert.equal(result.value.data[8].credits, 2)
})

test('cada inscripción abierta dice en cuántos días cierra y cuántos lugares quedan', async () => {
  const { studies } = build()

  // Al 10/11: las mesas cierran el 4/12 y el verano el 18/12. En la mesa de
  // Álgebra queda 1 de 2, la de Análisis I está vacía, en Física I de verano
  // la mañana está llena y la tarde tiene 25, y Programación I de verano no tiene tope.
  // De Probabilidad y Estadística cuentan las dos comisiones de Industrial (30 y 25), no la de Informática.
  const result = await studies.openEnrollments('p-vfunes')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.map((i) => [i.kind, i.subjectId, i.closesInDays, i.spotsLeft]),
    [
      ['actividad', 'tor', 6, 30],
      ['examen', 'aga', 24, 1],
      ['examen', 'am1', 24, 40],
      ['cursada', 'cda', 38, 20],
      ['cursada', 'fi1', 38, 25],
      ['cursada', 'pye', 38, 55],
      ['cursada', 'pr1', 38, null],
      ['actividad', 'lid', 38, 40],
      ['actividad', 'vol', 38, 15]
    ]
  )
})

test('los lugares de una materia con varias comisiones abiertas son los de todas, y sin tope si alguna no lo tiene', async () => {
  const data = structuredClone(syntheticData)
  const fi1 = data.siu.sections.find((s) => s.id === 'sec-fi1-fi-v')!
  const pr1 = data.siu.sections.find((s) => s.id === 'sec-pr1-fi-v')!
  data.siu.sections.push(
    { ...fi1, id: 'sec-fi1-fi-v2', name: 'Verano 2', capacity: 10 },
    { ...pr1, id: 'sec-pr1-fi-v2', name: 'Verano 2', capacity: 30 }
  )
  const { studies } = build(data)

  // Física I: la mañana llena, 25 en la tarde y 10 en la nueva.
  const result = await studies.openEnrollments('p-vfunes')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.filter((i) => i.kind !== 'examen').map((i) => [i.subjectId, i.spotsLeft]),
    [
      ['tor', 30],
      ['cda', 20],
      ['fi1', 35],
      ['pye', 55],
      ['pr1', null],
      ['lid', 40],
      ['vol', 15]
    ]
  )
})

test('los días para el cierre se cuentan con el reloj de cada lectura, aunque sea lo último que se leyó', async () => {
  const { studies, siuState, advance } = build()
  const days = (items: OpenEnrollment[]) => items.map((i) => [i.kind, i.subjectId, i.closesInDays])
  assert.ok((await studies.openEnrollments('p-vfunes')).ok)

  advance(24 * 24 * 60) // 4/12 al mediodía: las mesas cierran hoy.
  siuState.down = true
  const stale = await studies.openEnrollments('p-vfunes')

  assert.ok(stale.ok)
  assert.equal(stale.value.stale, true)
  assert.deepEqual(days(stale.value.data), [
    ['actividad', 'tor', -18],
    ['examen', 'aga', 0],
    ['examen', 'am1', 0],
    ['cursada', 'cda', 14],
    ['cursada', 'fi1', 14],
    ['cursada', 'pye', 14],
    ['cursada', 'pr1', 14],
    ['actividad', 'lid', 14],
    ['actividad', 'vol', 14]
  ])
})

test('la mesa de una materia que está cursando avisa que le falta la regularidad; la de una regular, no', async () => {
  const { studies } = build()

  // Valentina tiene Álgebra regular y cursa Análisis I.
  const result = await studies.openEnrollments('p-vfunes')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.filter((i) => i.kind === 'examen').map((i) => [i.subjectId, i.needsRegularity]),
    [
      ['aga', false],
      ['am1', true]
    ]
  )
})

test('no ve la mesa a la que ya se inscribió ni el verano de lo que está cursando', async () => {
  const { studies } = build()

  // Tomás ya está en la mesa de Álgebra, tiene regular Sistemas de Representación y cursa Análisis I y Programación I.
  const result = await studies.openEnrollments('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(openings(result.value.data), [
    ['actividad', 'tor', '2026-11-17T02:59:00.000Z'],
    ['examen', 'am1', '2026-12-05T02:59:00.000Z'],
    ['examen', 'sre', '2026-12-05T02:59:00.000Z'],
    ['cursada', 'cda', '2026-12-19T02:59:00.000Z'],
    ['cursada', 'fi1', '2026-12-19T02:59:00.000Z'],
    ['cursada', 'pye', '2026-12-19T02:59:00.000Z'],
    ['actividad', 'lid', '2026-12-19T02:59:00.000Z'],
    ['actividad', 'vol', '2026-12-19T02:59:00.000Z']
  ])
})

test('una materia sin lugar en sus comisiones igual aparece: cuántos lugares quedan lo dice la oferta', async () => {
  // Sin la comisión de la tarde, la única de Física I de verano está llena.
  const data = structuredClone(syntheticData)
  data.siu.sections = data.siu.sections.filter((s) => s.id !== 'sec-fi1-fi-vt')
  const { studies } = build(data)

  const result = await studies.openEnrollments('p-vfunes')
  const offer = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'fi1' })

  assert.ok(result.ok && offer.ok)
  assert.equal(
    result.value.data.some((i) => i.kind === 'cursada' && i.subjectId === 'fi1'),
    true
  )
  assert.deepEqual(
    offer.value.data.map((o) => o.spotsLeft),
    [0]
  )
})

test('no ve la mesa de lo que ya aprobó ni la oferta de otra facultad', async () => {
  const { studies } = build()

  // Nicolás (Ciencias Empresariales) promocionó Introducción a la Economía y cursa Análisis I y Contabilidad I.
  const nicolas = await studies.openEnrollments('p-nherrera')
  // Federico cursa solo Contabilidad I: le sirve Análisis I de verano.
  const federico = await studies.openEnrollments('p-fjuarez')

  assert.ok(nicolas.ok && federico.ok)
  assert.deepEqual(openings(nicolas.value.data), [['examen', 'co1', '2026-12-05T02:59:00.000Z']])
  assert.deepEqual(
    federico.value.data.map((i) => [i.kind, i.subjectId]),
    [
      ['examen', 'co1'],
      ['cursada', 'am1']
    ]
  )
})

test('cuando cierra la inscripción a las mesas dejan de aparecer, y sin nada abierto la lista sale vacía', async () => {
  const { studies, advance } = build()

  advance(25 * 24 * 60) // 5/12: cerraron las mesas, sigue abierto el verano.
  const december = await studies.openEnrollments('p-vfunes')
  advance(14 * 24 * 60) // 19/12: cerró todo.
  const later = await studies.openEnrollments('p-vfunes')

  assert.ok(december.ok && later.ok)
  assert.deepEqual(
    december.value.data.map((i) => [i.kind, i.subjectId]),
    [
      ['cursada', 'cda'],
      ['cursada', 'fi1'],
      ['cursada', 'pye'],
      ['cursada', 'pr1'],
      ['actividad', 'lid'],
      ['actividad', 'vol']
    ]
  )
  assert.deepEqual(later.value.data, [])
})

test('un docente no tiene inscripciones abiertas', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.openEnrollments('p-mledesma'), {
    ok: true,
    value: { data: [], readAt: NOW, stale: false }
  })
})

test('las inscripciones abiertas con el SIU caído devuelven lo último que leyó, y de alguien que no existe, «persona desconocida»', async () => {
  const { studies, siuState, advance } = build()
  assert.deepEqual(await studies.openEnrollments('p-nadie'), { ok: false, error: 'persona-desconocida' })
  const first = await studies.openEnrollments('p-vfunes')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true

  assert.deepEqual(await studies.openEnrollments('p-vfunes'), {
    ok: true,
    value: { data: first.value.data, readAt: NOW, stale: true }
  })
  assert.deepEqual(await studies.openEnrollments('p-taguirre'), { ok: false, error: 'falla-externa' })
})

// Finales pendientes

const pending = (items: PendingFinal[]) =>
  items.map((p) => [p.subjectId, p.next?.examBoardId ?? null, p.next?.status ?? null])

test('los finales pendientes son lo regular sin aprobar, con la próxima mesa por fecha; un final desaprobado sigue pendiente', async () => {
  const { studies } = build()

  // Tomás tiene regular Álgebra (ya inscripto a la mesa) y Sistemas de Representación (desaprobó el final en febrero).
  const result = await studies.pendingFinals('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(pending(result.value.data), [
    ['sre', 'mesa-sre-fi-dic', 'abierta'],
    ['aga', 'mesa-aga-fi-dic', 'inscripto']
  ])
  assert.equal(result.value.data[0].regularSince, '2025-11-27T03:00:00.000Z')
  assert.equal(result.value.data[0].next?.examPeriod, 'Turno Diciembre 2026')
})

test('una materia aprobada por promoción, final o equivalencia no es un final pendiente', async () => {
  const data = structuredClone(syntheticData)
  const regular = (personId: string, subjectId: string) => ({
    ...data.siu.history.find((h) => h.type === 'cursada' && h.result === 'regular')!,
    id: `h-${personId}-${subjectId}`,
    personId,
    subjectId,
    date: '2024-12-01T03:00:00.000Z'
  })
  // Regulares antes de aprobarlas: Química (promoción), Antropología (final) e Introducción a la Administración (equivalencia).
  data.siu.history.push(regular('30101', 'qui'), regular('30101', 'an1'), regular('30108', 'iad'))
  const { studies } = build(data)

  const tomas = await studies.pendingFinals('p-taguirre')
  const nicolas = await studies.pendingFinals('p-nherrera')

  assert.ok(tomas.ok && nicolas.ok)
  assert.deepEqual(
    tomas.value.data.map((p) => p.subjectId),
    ['sre', 'aga']
  )
  assert.deepEqual(nicolas.value.data, [])
})

test('la próxima mesa de un final pendiente dice si está sin cupo o si todavía no abrió', async () => {
  const full = structuredClone(syntheticData)
  full.siu.examEnrollments.push({ ...full.siu.examEnrollments[0], id: 'ie-extra', personId: '30105' })
  const later = structuredClone(syntheticData)
  later.siu.examBoards = later.siu.examBoards.map((b) =>
    b.id === 'mesa-aga-fi-dic' ? { ...b, enrollmentStart: '2026-11-20T03:00:00.000Z' } : b
  )

  // Valentina tiene regular Álgebra y no se anotó a la mesa.
  const sinCupo = await build(full).studies.pendingFinals('p-vfunes')
  const noAbrio = await build(later).studies.pendingFinals('p-vfunes')

  assert.ok(sinCupo.ok && noAbrio.ok)
  assert.deepEqual(pending(sinCupo.value.data), [['aga', 'mesa-aga-fi-dic', 'sin-cupo']])
  assert.deepEqual(pending(noAbrio.value.data), [['aga', 'mesa-aga-fi-dic', 'no-abrio']])
})

test('cuando cierra la inscripción a la mesa, el pendiente queda sin mesa; si ya estaba inscripto, la conserva', async () => {
  const { studies, advance } = build()

  advance(25 * 24 * 60) // 5/12: cerraron las mesas de diciembre, que todavía no se tomaron.
  const valentina = await studies.pendingFinals('p-vfunes')
  const tomas = await studies.pendingFinals('p-taguirre')

  assert.ok(valentina.ok && tomas.ok)
  assert.deepEqual(pending(valentina.value.data), [['aga', null, null]])
  assert.deepEqual(pending(tomas.value.data), [
    ['aga', 'mesa-aga-fi-dic', 'inscripto'],
    ['sre', null, null]
  ])
})

test('un docente no tiene finales pendientes; con el SIU caído vuelve lo último leído, y de alguien que no existe, «persona desconocida»', async () => {
  const { studies, siuState, advance } = build()
  assert.deepEqual(await studies.pendingFinals('p-mledesma'), {
    ok: true,
    value: { data: [], readAt: NOW, stale: false }
  })
  assert.deepEqual(await studies.pendingFinals('p-nadie'), { ok: false, error: 'persona-desconocida' })
  const first = await studies.pendingFinals('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true

  assert.deepEqual(await studies.pendingFinals('p-taguirre'), {
    ok: true,
    value: { data: first.value.data, readAt: NOW, stale: true }
  })
  assert.deepEqual(await studies.pendingFinals('p-vfunes'), { ok: false, error: 'falla-externa' })
})

// Notas, historia y constancias

test('las notas de parciales salen juntas, vengan de la historia o de actuación provisoria, la más reciente primero, con cuándo se cargó cada una si el SIU lo dice', async () => {
  const { studies } = build()

  const result = await studies.record('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.deepEqual(result.value.data.grades, [
    {
      subjectId: 'pr1',
      subjectName: 'Programación I',
      assessmentName: 'TP integrador',
      grade: 9,
      date: '2026-10-16T12:00:00.000Z',
      loadedAt: '2026-11-09T21:00:00.000Z',
      source: 'historia'
    },
    {
      subjectId: 'am1',
      subjectName: 'Análisis Matemático I',
      assessmentName: 'Primer parcial',
      grade: 7,
      date: '2026-09-21T11:00:00.000Z',
      loadedAt: '2026-11-10T12:00:00.000Z',
      source: 'actuacion-provisoria'
    },
    {
      subjectId: 'aga',
      subjectName: 'Álgebra y Geometría Analítica',
      assessmentName: 'Segundo parcial',
      grade: 7,
      date: '2026-06-23T11:00:00.000Z',
      loadedAt: null,
      source: 'historia'
    },
    {
      subjectId: 'aga',
      subjectName: 'Álgebra y Geometría Analítica',
      assessmentName: 'Primer parcial',
      grade: 6,
      date: '2026-04-21T11:00:00.000Z',
      loadedAt: null,
      source: 'historia'
    }
  ])
})

// Notas nuevas

/** Las notas nuevas como [materia, evaluación, nota]. */
const named = (grades: { subjectName: string; assessmentName: string; grade: number | null }[]) =>
  grades.map((g) => [g.subjectName, g.assessmentName, g.grade])

test('las notas nuevas son las cargadas en los últimos 7 días, la más nueva primero, vengan de la historia o de actuación provisoria', async () => {
  const { studies } = build()

  const result = await studies.newGrades('p-taguirre', null)

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.deepEqual(
    result.value.data.map((g) => [g.subjectName, g.assessmentName, g.grade, g.source, g.loadedAt]),
    [
      ['Análisis Matemático I', 'Primer parcial', 7, 'actuacion-provisoria', '2026-11-10T12:00:00.000Z'],
      ['Programación I', 'TP integrador', 9, 'historia', '2026-11-09T21:00:00.000Z']
    ]
  )
})

test('una nota deja de ser nueva 7 días después de cargada, contados con el reloj', async () => {
  const { studies, advance } = build()

  advance((6 * 24 + 8) * 60) // lunes 16/11 a las 20:00: el TP se cargó hace 7 días y 2 horas
  const monday = await studies.newGrades('p-taguirre', null)
  advance(14 * 60) // martes 17/11 a las 10:00: el parcial se cargó hace 7 días y 1 hora
  const tuesday = await studies.newGrades('p-taguirre', null)

  assert.ok(monday.ok && tuesday.ok)
  assert.deepEqual(named(monday.value.data), [['Análisis Matemático I', 'Primer parcial', 7]])
  assert.deepEqual(tuesday.value.data, [])
})

test('las notas que ya vio no son nuevas: solo cuentan las cargadas después', async () => {
  const { studies } = build()

  // Vio sus notas el martes 10/11 a la medianoche: después se cargó solo el parcial de Análisis I.
  const result = await studies.newGrades('p-taguirre', '2026-11-10T03:00:00.000Z')

  assert.ok(result.ok)
  assert.deepEqual(named(result.value.data), [['Análisis Matemático I', 'Primer parcial', 7]])
})

test('sin fecha de carga, una nota cuenta como nueva desde la fecha de la evaluación; una cargada después de ahora no sale', async () => {
  const data = structuredClone(syntheticData)
  const tomas = data.people.find((p) => p.id === 'p-taguirre')!.siuId
  for (const r of data.siu.provisionalResults.filter((r) => r.personId === tomas)) {
    r.loadedAt = null
    r.date = '2026-11-06T13:00:00.000Z' // viernes 6/11, hace 4 días
  }
  for (const h of data.siu.history.filter((h) => h.personId === tomas && h.type === 'evaluacion')) {
    h.loadedAt = '2026-11-10T18:00:00.000Z' // hoy a las 15, después del mediodía de los tests
  }
  const { studies } = build(data)

  const result = await studies.newGrades('p-taguirre', null)

  assert.ok(result.ok)
  assert.deepEqual(named(result.value.data), [['Análisis Matemático I', 'Primer parcial', 7]])
})

test('un ausente no es una nota nueva, aunque su evaluación se haya cargado en la semana', async () => {
  const { studies } = build()

  // Sofía estuvo ausente en el TP integrador de Programación I, que se cargó el 9/11.
  const result = await studies.newGrades('p-sdominguez', null)

  assert.ok(result.ok)
  assert.deepEqual(result.value.data, [])
})

test('con el SIU caído, las notas nuevas salen de lo último leído, marcadas como desactualizadas; sin nada leído, «falla externa»', async () => {
  const { studies, siuState } = build()
  siuState.down = true
  assert.deepEqual(await studies.newGrades('p-taguirre', null), { ok: false, error: 'falla-externa' })

  siuState.down = false
  await studies.record('p-taguirre')
  siuState.down = true
  const result = await studies.newGrades('p-taguirre', null)

  assert.ok(result.ok)
  assert.equal(result.value.stale, true)
  assert.equal(result.value.readAt, NOW)
  assert.equal(result.value.data.length, 2)
})

test('la historia académica muestra las materias aprobadas con fecha, nota y forma de aprobación, y el promedio', async () => {
  const { studies } = build()

  const tomas = await studies.record('p-taguirre')

  assert.ok(tomas.ok)
  // Álgebra quedó regular (le falta el final) y sus parciales son notas, no materias aprobadas.
  assert.deepEqual(tomas.value.data.history, [
    { subjectId: 'an1', subjectName: 'Antropología I', date: '2025-12-15T03:00:00.000Z', grade: 9, approval: 'examen' },
    {
      subjectId: 'qui',
      subjectName: 'Química General',
      date: '2025-12-05T03:00:00.000Z',
      grade: 7,
      approval: 'promocion'
    },
    {
      subjectId: 'iin',
      subjectName: 'Introducción a la Ingeniería',
      date: '2025-07-04T03:00:00.000Z',
      grade: 8,
      approval: 'promocion'
    }
  ])
  assert.equal(tomas.value.data.average, 8)

  const nicolas = await studies.record('p-nherrera')

  assert.ok(nicolas.ok)
  assert.deepEqual(
    nicolas.value.data.history.map((h) => [h.subjectName, h.approval, h.grade]),
    [
      ['Introducción a la Economía', 'promocion', 9],
      ['Introducción a la Administración', 'equivalencia', 8]
    ]
  )
  assert.equal(nicolas.value.data.average, 8.5)
})

test('sin materias aprobadas, la historia sale vacía y sin promedio', async () => {
  const { studies } = build()

  const result = await studies.record('p-lbenitez')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.history, [])
  assert.equal(result.value.data.average, null)
})

test('con el SIU caído, las notas y la historia vuelven como se leyeron la última vez, marcadas como desactualizadas', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.record('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true
  const second = await studies.record('p-taguirre')

  assert.deepEqual(second, { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
})

test('con el SIU caído y sin nada leído antes, las notas devuelven «falla externa»', async () => {
  const { studies, siuState } = build()
  siuState.down = true

  assert.deepEqual(await studies.record('p-taguirre'), { ok: false, error: 'falla-externa' })
})

test('las notas de una persona que no existe devuelven «persona desconocida»', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.record('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

test('con un SIU sin cronograma (como la API real), las notas salen igual, con un nombre genérico', async () => {
  const { studies } = build(syntheticData, {}, { siu: { capabilities: { hasAssessmentSchedule: false } } })

  const result = await studies.record('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.grades.map((g) => [g.subjectName, g.assessmentName, g.grade, g.source]),
    [
      ['Programación I', 'Evaluación', 9, 'historia'],
      ['Análisis Matemático I', 'Evaluación', 7, 'actuacion-provisoria'],
      ['Álgebra y Geometría Analítica', 'Evaluación', 7, 'historia'],
      ['Álgebra y Geometría Analítica', 'Evaluación', 6, 'historia']
    ]
  )
})

test('si cumple las condiciones de la constancia de alumno regular, trae el enlace directo a pedirla en la Autogestión', async () => {
  const { studies } = build()

  assert.deepEqual(await studies.certificate('p-taguirre', 'alumno-regular'), {
    ok: true,
    value: {
      data: {
        type: 'alumno-regular',
        meetsConditions: true,
        reasons: [],
        url: '/simulado/siu/constancias/solicitar?tipo=alumno-regular'
      },
      readAt: NOW,
      stale: false
    }
  })
})

test('la constancia con el SIU caído devuelve lo último que leyó, con su hora y marcada como desactualizada', async () => {
  const { studies, siuState, advance } = build()
  const first = await studies.certificate('p-taguirre', 'alumno-regular')
  assert.ok(first.ok)

  advance(20)
  siuState.down = true

  assert.deepEqual(await studies.certificate('p-taguirre', 'alumno-regular'), {
    ok: true,
    value: { data: first.value.data, readAt: NOW, stale: true }
  })
  // Lo último leído es de cada constancia: la de examen final nunca se leyó.
  assert.deepEqual(await studies.certificate('p-taguirre', 'examen-final'), { ok: false, error: 'falla-externa' })
})

/** Copia del set sintético donde el SIU dice que la persona no cumple las condiciones de la constancia. */
function withoutConditions(personId: string, type: 'alumno-regular' | 'examen-final'): SyntheticData {
  const data = structuredClone(syntheticData)
  const siuId = data.people.find((p) => p.id === personId)!.siuId
  data.siu.certificates.find((c) => c.personId === siuId && c.type === type)!.meetsConditions = false
  return data
}

test('si no cumple la de alumno regular porque su propuesta está pasiva, lo dice', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-fjuarez', 'alumno-regular')

  assert.ok(result.ok)
  assert.equal(result.value.data.meetsConditions, false)
  assert.deepEqual(result.value.data.reasons, ['sin-propuesta-activa'])
  assert.equal(result.value.data.url, '/simulado/siu/constancias/solicitar?tipo=alumno-regular')
})

test('si no cumple la de alumno regular porque no tiene inscripciones a cursada vigentes, lo dice', async () => {
  const data = withoutConditions('p-lbenitez', 'alumno-regular')
  const lucia = data.people.find((p) => p.id === 'p-lbenitez')!.siuId
  for (const e of data.siu.courseEnrollments) if (e.personId === lucia) e.status = 'baja'
  const { studies } = build(data)

  const result = await studies.certificate('p-lbenitez', 'alumno-regular')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.reasons, ['sin-inscripcion-vigente'])
})

test('si el SIU dice que no cumple y Cursada no encuentra el motivo, no inventa uno', async () => {
  const { studies } = build(withoutConditions('p-taguirre', 'alumno-regular'))

  const result = await studies.certificate('p-taguirre', 'alumno-regular')

  assert.ok(result.ok)
  assert.equal(result.value.data.meetsConditions, false)
  assert.deepEqual(result.value.data.reasons, [])
})

test('si no cumple la de examen final porque no rindió ningún final, lo dice', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-lbenitez', 'examen-final')

  assert.ok(result.ok)
  assert.equal(result.value.data.meetsConditions, false)
  assert.deepEqual(result.value.data.reasons, ['sin-examenes-rendidos'])
  assert.equal(result.value.data.url, '/simulado/siu/constancias/solicitar?tipo=examen-final')
})

test('la constancia de examen final la cumple quien ya rindió un final', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-taguirre', 'examen-final')

  assert.ok(result.ok)
  assert.equal(result.value.data.meetsConditions, true)
  assert.deepEqual(result.value.data.reasons, [])
})

test('la constancia de una persona que no existe devuelve «persona desconocida», y con el SIU caído, «falla externa»', async () => {
  const { studies, siuState } = build()

  assert.deepEqual(await studies.certificate('p-nadie', 'alumno-regular'), { ok: false, error: 'persona-desconocida' })
  siuState.down = true
  assert.deepEqual(await studies.certificate('p-taguirre', 'alumno-regular'), { ok: false, error: 'falla-externa' })
})

test('a un docente no le inventa motivos de alumno para la constancia de alumno regular', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-mledesma', 'alumno-regular')

  assert.ok(result.ok)
  assert.equal(result.value.data.meetsConditions, false)
  assert.deepEqual(result.value.data.reasons, [])
})

test('una inscripción pendiente cuenta como vigente para el motivo de la constancia', async () => {
  const data = withoutConditions('p-lbenitez', 'alumno-regular')
  const lucia = data.people.find((p) => p.id === 'p-lbenitez')!.siuId
  for (const e of data.siu.courseEnrollments) if (e.personId === lucia) e.status = 'pendiente'
  const { studies } = build(data)

  const result = await studies.certificate('p-lbenitez', 'alumno-regular')

  assert.ok(result.ok)
  assert.deepEqual(result.value.data.reasons, [])
})

test('una materia con dos renglones aprobados sale una vez, con el más reciente, y cuenta una vez en el promedio', async () => {
  const data = structuredClone(syntheticData)
  const tomas = data.people.find((p) => p.id === 'p-taguirre')!.siuId
  const final = data.siu.history.find((h) => h.personId === tomas && h.subjectId === 'an1')!
  data.siu.history.push({ ...final, id: 'ha-rectificada', date: '2026-02-20T03:00:00.000Z', grade: 10 })
  const { studies } = build(data)

  const result = await studies.record('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.history.map((h) => [h.subjectId, h.grade]),
    [
      ['an1', 10],
      ['qui', 7],
      ['iin', 8]
    ]
  )
  assert.equal(result.value.data.average, 8.33)
})

// Inscripción en un paso: oferta, inscripción y baja.

test('la oferta de una materia muestra las comisiones de su facultad que no terminaron, con cupo, horario y docentes', async () => {
  const { studies } = build()

  const result = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'pr1' })

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.map((o) => [o.target, o.alreadyEnrolled, o.enrollmentWindow]),
    [
      [{ kind: 'comision', sectionId: 'sec-pr1-fi-a' }, true, 'cerrada'],
      [{ kind: 'comision', sectionId: 'sec-pr1-fi-v' }, false, 'abierta']
    ]
  )
  assert.deepEqual(result.value.data[1], {
    target: { kind: 'comision', sectionId: 'sec-pr1-fi-v' },
    subjectId: 'pr1',
    subjectName: 'Programación I',
    name: 'Verano',
    period: 'Curso de Verano 2027',
    schedule: [{ day: 'martes', start: '09:00', end: '13:00' }],
    date: null,
    location: 'Virtual',
    modality: 'virtual',
    instance: 'regularidad',
    start: '2027-01-11T03:00:00.000Z',
    end: '2027-02-27T02:59:00.000Z',
    notes: 'Las clases son por Zoom y quedan grabadas en el aula del Campus Virtual.',
    otherProgram: false,
    teachers: [{ personId: 'p-darrieta', name: 'Diego Arrieta' }],
    capacity: null,
    enrolled: 0,
    spotsLeft: null,
    enrollmentStart: '2026-11-02T03:00:00.000Z',
    enrollmentEnd: '2026-12-19T02:59:00.000Z',
    enrollmentWindow: 'abierta',
    alreadyEnrolled: false,
    enrolledElsewhere: 'A',
    needsRegularity: false
  })
})

test('la oferta distingue una inscripción que todavía no abrió de una que ya cerró, según el reloj', async () => {
  // La inscripción al verano abre el 20/11 en vez del 2/11.
  const data = structuredClone(syntheticData)
  data.siu.terms.find((t) => t.id === 'verano-2027')!.enrollmentStart = '2026-11-20T03:00:00.000Z'
  const { studies, advance } = build(data)
  const windows = async () => {
    const offer = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'pr1' })
    assert.ok(offer.ok)
    return offer.value.data.map((o) => [o.name, o.enrollmentWindow])
  }

  assert.deepEqual(await windows(), [
    ['A', 'cerrada'],
    ['Verano', 'no-abrio']
  ])
  advance(10 * 24 * 60) // 20/11 al mediodía.
  assert.deepEqual(await windows(), [
    ['A', 'cerrada'],
    ['Verano', 'abierta']
  ])
})

test('la oferta nunca trae comisiones de otra facultad ni de períodos que ya terminaron', async () => {
  const { studies } = build()

  // Lucía es de Informática: de Análisis I de Ingeniería trae las dos, con la B marcada como de otra carrera.
  const fi = await studies.offer('p-lbenitez', { kind: 'cursada', subjectId: 'am1' })
  const fce = await studies.offer('p-nherrera', { kind: 'cursada', subjectId: 'am1' })
  const aga = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'aga' })

  assert.ok(fi.ok && fce.ok && aga.ok)
  assert.deepEqual(
    fi.value.data.map((o) => [o.target, o.otherProgram]),
    [
      [{ kind: 'comision', sectionId: 'sec-am1-fi-a' }, false],
      [{ kind: 'comision', sectionId: 'sec-am1-fi-b' }, true]
    ]
  )
  assert.deepEqual(
    fce.value.data.map((o) => o.target),
    [
      { kind: 'comision', sectionId: 'sec-am1-fce-a' },
      { kind: 'comision', sectionId: 'sec-am1-fce-v' }
    ]
  )
  assert.deepEqual(aga.value.data, [])
})

test('la oferta con el SIU caído devuelve lo último que leyó, con la ventana de inscripción mirada con el reloj de ahora', async () => {
  // La inscripción al verano abre el 20/11 en vez del 2/11.
  const data = structuredClone(syntheticData)
  data.siu.terms.find((t) => t.id === 'verano-2027')!.enrollmentStart = '2026-11-20T03:00:00.000Z'
  const { studies, siuState, advance } = build(data)
  const query = { kind: 'cursada', subjectId: 'pr1' } as const
  const first = await studies.offer('p-vfunes', query)
  assert.ok(first.ok)

  advance(10 * 24 * 60) // 20/11 al mediodía.
  siuState.down = true
  const second = await studies.offer('p-vfunes', query)

  assert.ok(second.ok)
  assert.deepEqual([second.value.readAt, second.value.stale], [NOW, true])
  assert.deepEqual(
    second.value.data.map((o) => [o.name, o.spotsLeft, o.enrollmentWindow]),
    first.value.data.map((o) => [o.name, o.spotsLeft, o.name === 'Verano' ? 'abierta' : o.enrollmentWindow])
  )
  // Lo último leído es de cada materia y tipo de oferta: las mesas nunca se leyeron.
  assert.deepEqual(await studies.offer('p-vfunes', { kind: 'examen', subjectId: 'pr1' }), {
    ok: false,
    error: 'falla-externa'
  })
})

const PR1_VERANO = { kind: 'comision', sectionId: 'sec-pr1-fi-v' } as const
const FI1_VERANO = { kind: 'comision', sectionId: 'sec-fi1-fi-v' } as const
/** Valentina Funes cursa Análisis Matemático I B y nunca se inscribió a Programación I. */
const VALENTINA = { siu: '30106', moodle: '406' }
/** Las aulas de Valentina antes de inscribirse a nada. */
const VALENTINA_COURSES = ['c-aga-fi-a', 'c-am1-fi-b']

/** Cursos de Moodle en los que está matriculada una persona como alumna. */
async function studentCourses(classroom: ClassroomPort, moodleId: string) {
  const courses = await classroom.coursesOf(moodleId)
  assert.ok(courses.ok)
  return courses.value
    .filter((c) => c.role === 'student')
    .map((c) => c.id)
    .sort()
}

/** Comisiones en las que el SIU tiene inscripta a una persona. */
async function siuSections(siu: SiuPort, siuId: string) {
  const enrollments = await siu.courseEnrollments(siuId)
  assert.ok(enrollments.ok)
  return enrollments.value.map((e) => e.sectionId).sort()
}

test('inscribirse inscribe en el SIU, matricula en el aula de Moodle y devuelve el comprobante', async () => {
  const { studies, siu, classroom } = build()

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'inscripto',
      receipt: { transactionNumber: 'T-M000001', date: NOW, target: PR1_VERANO },
      classroomCourseIds: ['c-pr1-fi-v']
    }
  })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b', 'sec-pr1-fi-v'])
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), [...VALENTINA_COURSES, 'c-pr1-fi-v'])
})

test('después de inscribirse, la materia aparece en sus materias y en sus comisiones, que dan acceso a su espacio', async () => {
  const { studies } = build()

  assert.equal((await studies.enroll('p-vfunes', PR1_VERANO)).ok, true)

  const subjects = await studies.subjectsOf('p-vfunes')
  const sections = await studies.sectionsOf('p-vfunes')
  const offer = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'pr1' })
  assert.ok(subjects.ok && sections.ok && offer.ok)
  assert.deepEqual(names(subjects.value.data.current), ['AM1 B', 'PR1 Verano'])
  assert.equal(subjects.value.data.current[1].classrooms[0].courseId, 'c-pr1-fi-v')
  assert.equal(
    sections.value.data.some((s) => s.sectionId === 'sec-pr1-fi-v'),
    true
  )
  assert.deepEqual(
    offer.value.data.map((o) => o.alreadyEnrolled),
    [false, true]
  )
})

test('si Moodle falla al matricular, se deshace la inscripción del SIU y vuelve «falla externa»', async () => {
  const { studies, siu, classroom } = build(
    syntheticData,
    {},
    {
      classroomOverrides: { enrol: async () => fail('falla-externa') }
    }
  )

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.deepEqual(result, { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
  // Deshecha, se puede volver a intentar sin que el SIU diga «ya inscripto».
  const offer = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'pr1' })
  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => o.alreadyEnrolled),
    [false, false]
  )
})

test('si la comisión tiene dos aulas y falla la segunda, se desmatricula de la primera y se deshace la del SIU', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses.push({
    id: 'c-pr1-fi-v-lab',
    shortName: 'PR1-LAB',
    fullName: 'Laboratorio de PR1',
    siuSectionIds: ['sec-pr1-fi-v']
  })
  const memory = createMemoryClassroom(data)
  const { studies, siu } = build(
    data,
    {},
    {
      classroomOverrides: {
        ...memory,
        enrol: async (userId, courseId, role) =>
          courseId === 'c-pr1-fi-v-lab' ? fail('falla-externa') : memory.enrol(userId, courseId, role)
      }
    }
  )

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.deepEqual(result, { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studentCourses(memory, VALENTINA.moodle), VALENTINA_COURSES)
})

test('con el SIU caído no se inscribe en nada y vuelve «falla externa», sin dejar nada a medias', async () => {
  const { studies, siuState, siu, classroom } = build()
  siuState.down = true

  assert.deepEqual(await studies.enroll('p-vfunes', PR1_VERANO), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
  siuState.down = false
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
})

test('sin cupo, fuera de período y ya inscripto vuelven como errores sin tocar Moodle', async () => {
  const { studies, classroom } = build()

  assert.deepEqual(await studies.enroll('p-vfunes', FI1_VERANO), { ok: false, error: 'sin-cupo' })
  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'comision', sectionId: 'sec-pr1-fi-a' }), {
    ok: false,
    error: 'fuera-de-periodo'
  })
  assert.deepEqual(await studies.enroll('p-mcabrera', FI1_VERANO), { ok: false, error: 'ya-inscripto' })
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
})

test('con una comisión vigente de la materia no se puede inscribir en otra, aunque sea de otro período', async () => {
  const { studies, siu, classroom } = build()
  const TOMAS = { siu: '30101', moodle: '401' }

  // Tomás cursa Programación I en la comisión A del segundo cuatrimestre.
  assert.deepEqual(await studies.enroll('p-taguirre', PR1_VERANO), { ok: false, error: 'ya-inscripto' })
  assert.deepEqual(await siuSections(siu, TOMAS.siu), ['sec-am1-fi-a', 'sec-pr1-fi-a'])
  assert.deepEqual(await studentCourses(classroom, TOMAS.moodle), ['c-aga-fi-a', 'c-am1-fi-a', 'c-pr1-fi-a'])

  const offer = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'pr1' })
  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => [o.name, o.alreadyEnrolled, o.enrolledElsewhere]),
    [
      ['A', true, null],
      ['Verano', false, 'A']
    ]
  )
})

test('una comisión que no existe o es de otra facultad vuelve «objetivo desconocido»', async () => {
  const { studies, siu } = build()

  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'comision', sectionId: 'sec-nada' }), {
    ok: false,
    error: 'objetivo-desconocido'
  })
  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'comision', sectionId: 'sec-am1-fce-v' }), {
    ok: false,
    error: 'objetivo-desconocido'
  })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studies.enroll('p-nadie', PR1_VERANO), { ok: false, error: 'persona-desconocida' })
})

test('un docente no se puede inscribir ni dar de baja: vuelve «solo alumnos» sin tocar el SIU ni el aula', async () => {
  const MARIANA = { siu: '20101', moodle: '301' }
  const { studies, siu, classroom } = build()
  const coursesBefore = await classroom.coursesOf(MARIANA.moodle)

  assert.deepEqual(await studies.enroll('p-mledesma', PR1_VERANO), { ok: false, error: 'solo-alumnos' })
  assert.deepEqual(await studies.enroll('p-mledesma', { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' }), {
    ok: false,
    error: 'solo-alumnos'
  })
  assert.deepEqual(await studies.drop('p-mledesma', PR1_VERANO), { ok: false, error: 'solo-alumnos' })
  assert.deepEqual(await siuSections(siu, MARIANA.siu), [])
  assert.deepEqual(await siuBoards(siu, MARIANA.siu), [])
  assert.deepEqual(await classroom.coursesOf(MARIANA.moodle), coursesBefore)
})

test('si el SIU no deja inscribir por API, devuelve «requiere autogestión» con el enlace a la comisión, sin tocar nada', async () => {
  const { studies, siu, classroom } = build(syntheticData, {}, { siu: { capabilities: { canEnroll: false } } })

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'requiere-autogestion',
      url: `${syntheticData.siu.selfServiceBaseUrl}/cursada/inscripcion?comision=sec-pr1-fi-v`
    }
  })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
})

test('si el SIU ya matricula en Moodle, Cursada no matricula por su cuenta', async () => {
  let enrols = 0
  const { studies } = build(
    syntheticData,
    {},
    {
      siu: { capabilities: { enrolsInClassroom: true } },
      classroomOverrides: {
        enrol: async () => {
          enrols++
          return fail('falla-externa')
        }
      }
    }
  )

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.ok(result.ok && result.value.kind === 'inscripto')
  assert.deepEqual(result.value.classroomCourseIds, ['c-pr1-fi-v'])
  assert.equal(enrols, 0)
})

test('inscribirse a una mesa de examen no matricula en ningún aula', async () => {
  let enrols = 0
  const { studies } = build(
    syntheticData,
    {},
    {
      classroomOverrides: {
        enrol: async () => {
          enrols++
          return fail('falla-externa')
        }
      }
    }
  )

  const result = await studies.enroll('p-taguirre', { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' })

  assert.ok(result.ok && result.value.kind === 'inscripto')
  assert.deepEqual(result.value.classroomCourseIds, [])
  assert.equal(enrols, 0)
})

/** Martín Cabrera está inscripto en Física I del Curso de Verano, con la inscripción abierta. */
const MARTIN = { siu: '30103', moodle: '403' }

test('darse de baja da de baja en el SIU, desmatricula del aula y devuelve el comprobante', async () => {
  const { studies, siu, classroom } = build()

  const result = await studies.drop('p-mcabrera', FI1_VERANO)

  assert.deepEqual(result, {
    ok: true,
    value: { kind: 'baja', receipt: { transactionNumber: 'T-M000001', date: NOW, target: FI1_VERANO } }
  })
  assert.deepEqual(await siuSections(siu, MARTIN.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studentCourses(classroom, MARTIN.moodle), ['c-am1-fi-b'])
  const subjects = await studies.subjectsOf('p-mcabrera')
  assert.ok(subjects.ok)
  assert.deepEqual(names(subjects.value.data.current), ['AM1 B'])
})

test('inscribirse y darse de baja deja todo como estaba', async () => {
  const { studies, siu, classroom } = build()

  assert.equal((await studies.enroll('p-vfunes', PR1_VERANO)).ok, true)
  const result = await studies.drop('p-vfunes', PR1_VERANO)

  assert.ok(result.ok && result.value.kind === 'baja')
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
})

test('sin inscripción o fuera de período, la baja vuelve como error sin tocar Moodle', async () => {
  const { studies, classroom } = build()

  assert.deepEqual(await studies.drop('p-vfunes', PR1_VERANO), { ok: false, error: 'no-inscripto' })
  assert.deepEqual(await studies.drop('p-vfunes', { kind: 'comision', sectionId: 'sec-am1-fi-b' }), {
    ok: false,
    error: 'fuera-de-periodo'
  })
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
})

test('si Moodle falla al desmatricular, la inscripción del SIU queda como estaba y vuelve «falla externa»', async () => {
  const { studies, siu, classroom } = build(
    syntheticData,
    {},
    {
      classroomOverrides: { unenrol: async () => fail('falla-externa') }
    }
  )

  assert.deepEqual(await studies.drop('p-mcabrera', FI1_VERANO), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siuSections(siu, MARTIN.siu), ['sec-am1-fi-b', 'sec-fi1-fi-v'])
  assert.deepEqual(await studentCourses(classroom, MARTIN.moodle), ['c-am1-fi-b', 'c-fi1-fi-v'])
})

test('si el SIU falla al dar de baja, se vuelve a matricular en el aula y vuelve «falla externa»', async () => {
  const { studies, siu, classroom } = build(
    syntheticData,
    {},
    {
      siuOverrides: { drop: async () => fail('falla-externa') }
    }
  )

  assert.deepEqual(await studies.drop('p-mcabrera', FI1_VERANO), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await siuSections(siu, MARTIN.siu), ['sec-am1-fi-b', 'sec-fi1-fi-v'])
  assert.deepEqual(await studentCourses(classroom, MARTIN.moodle), ['c-am1-fi-b', 'c-fi1-fi-v'])
})

test('si el SIU no deja dar de baja por API, devuelve «requiere autogestión» sin tocar nada', async () => {
  const { studies, classroom } = build(syntheticData, {}, { siu: { capabilities: { canEnroll: false } } })

  const result = await studies.drop('p-mcabrera', FI1_VERANO)

  assert.deepEqual(result, {
    ok: true,
    value: {
      kind: 'requiere-autogestion',
      url: `${syntheticData.siu.selfServiceBaseUrl}/cursada/inscripcion?comision=sec-fi1-fi-v`
    }
  })
  assert.deepEqual(await studentCourses(classroom, MARTIN.moodle), ['c-am1-fi-b', 'c-fi1-fi-v'])
})

test('si el SIU ya matricula en Moodle, la baja no desmatricula por su cuenta', async () => {
  let unenrols = 0
  const { studies } = build(
    syntheticData,
    {},
    {
      siu: { capabilities: { enrolsInClassroom: true } },
      classroomOverrides: {
        unenrol: async () => {
          unenrols++
          return fail('falla-externa')
        }
      }
    }
  )

  const result = await studies.drop('p-mcabrera', FI1_VERANO)

  assert.ok(result.ok && result.value.kind === 'baja')
  assert.equal(unenrols, 0)
})

test('las inscripciones abiertas a cursada son las materias de su facultad con un período en inscripción, sin las que ya cursa', async () => {
  const { studies } = build()
  const courses = (items: OpenEnrollment[]) => items.filter((o) => o.kind === 'cursada')

  const tomas = await studies.openEnrollments('p-taguirre')
  const martin = await studies.openEnrollments('p-mcabrera')
  const federico = await studies.openEnrollments('p-fjuarez')

  assert.ok(tomas.ok && martin.ok && federico.ok)
  assert.equal(tomas.value.stale, false)
  assert.deepEqual(
    courses(tomas.value.data).map((o) => o.subjectId),
    ['cda', 'fi1', 'pye']
  )
  assert.deepEqual(courses(tomas.value.data)[1], {
    kind: 'cursada',
    subjectId: 'fi1',
    subjectName: 'Física I',
    opensAt: '2026-11-02T03:00:00.000Z',
    closesAt: '2026-12-19T02:59:00.000Z',
    closesInDays: 38,
    spotsLeft: 25,
    needsRegularity: false,
    credits: null
  })
  assert.deepEqual(
    courses(martin.value.data).map((o) => o.subjectId),
    ['cda', 'pye', 'pr1']
  )
  // Federico, de Ciencias Empresariales, no cursa Análisis Matemático I.
  assert.deepEqual(
    courses(federico.value.data).map((o) => o.subjectId),
    ['am1']
  )
})

test('las inscripciones abiertas con el SIU caído devuelven lo último que se leyó, marcado como desactualizado', async () => {
  const { studies, siuState } = build()
  const first = await studies.openEnrollments('p-taguirre')
  assert.ok(first.ok)

  siuState.down = true

  assert.deepEqual(await studies.openEnrollments('p-taguirre'), { ok: true, value: { ...first.value, stale: true } })
})

test('si Moodle falla y el SIU tampoco deja deshacer la inscripción, vuelve «a medias» y no «falla externa»', async () => {
  const { studies, siu } = build(
    syntheticData,
    {},
    {
      classroomOverrides: { enrol: async () => fail('falla-externa') },
      siuOverrides: { drop: async () => fail('falla-externa') }
    }
  )

  assert.deepEqual(await studies.enroll('p-vfunes', PR1_VERANO), { ok: false, error: 'a-medias' })
  // Quedó inscripta en el SIU y sin aula: eso es lo que tiene que saber.
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b', 'sec-pr1-fi-v'])
})

test('si el SIU rechaza la baja y Moodle no deja volver a matricular, vuelve «a medias»', async () => {
  const { studies, siu } = build(
    syntheticData,
    {},
    {
      classroomOverrides: { enrol: async () => fail('falla-externa') },
      siuOverrides: { drop: async () => fail('falla-externa') }
    }
  )

  assert.deepEqual(await studies.drop('p-mcabrera', FI1_VERANO), { ok: false, error: 'a-medias' })
  assert.deepEqual(await siuSections(siu, MARTIN.siu), ['sec-am1-fi-b', 'sec-fi1-fi-v'])
})

test('sin cuenta del Campus Virtual no se inscribe en nada y vuelve «sin cuenta del aula», no «falla externa»', async () => {
  const data = structuredClone(syntheticData)
  data.people.find((p) => p.id === 'p-vfunes')!.moodleId = ''
  const { studies, siu } = build(data)

  assert.deepEqual(await studies.enroll('p-vfunes', PR1_VERANO), { ok: false, error: 'sin-cuenta-del-aula' })
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b'])
})

test('la oferta dice cuántos lugares quedan: ninguno si se llenó, y sin tope si el cupo no está definido', async () => {
  const { studies } = build()

  const fi1 = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'fi1' })
  const am1 = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'am1' })
  const pr1 = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'pr1' })

  assert.ok(fi1.ok && am1.ok && pr1.ok)
  assert.deepEqual(
    fi1.value.data.map((o) => [o.name, o.capacity, o.spotsLeft]),
    [
      ['Verano', 2, 0],
      ['Verano tarde', 25, 25]
    ]
  )
  assert.deepEqual(
    am1.value.data.map((o) => [o.name, o.capacity, o.enrolled, o.spotsLeft]),
    [
      ['A', 40, 3, 37],
      ['B', 40, 3, 37]
    ]
  )
  assert.deepEqual(
    pr1.value.data.map((o) => o.spotsLeft),
    [27, null]
  )
})

test('si el SIU no deja dar de baja por API pero no está inscripto, vuelve «no inscripto» y no el enlace', async () => {
  const { studies } = build(syntheticData, {}, { siu: { capabilities: { canEnroll: false } } })

  assert.deepEqual(await studies.drop('p-vfunes', PR1_VERANO), { ok: false, error: 'no-inscripto' })
})

test('la oferta marca la comisión vigente de la materia aunque sea de otra facultad, igual que la inscripción', async () => {
  // Valentina cursa Análisis Matemático I en la comisión A de Ciencias Empresariales, no en la B de Ingeniería.
  const data = structuredClone(syntheticData)
  const valentinaAm1 = data.siu.courseEnrollments.find(
    (e) => e.personId === VALENTINA.siu && e.sectionId === 'sec-am1-fi-b'
  )!
  valentinaAm1.sectionId = 'sec-am1-fce-a'
  const { studies } = build(data)

  const offer = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'am1' })

  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => [o.name, o.alreadyEnrolled, o.enrolledElsewhere]),
    [
      ['A', false, 'A'],
      ['B', false, 'A']
    ]
  )
  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'comision', sectionId: 'sec-am1-fi-b' }), {
    ok: false,
    error: 'ya-inscripto'
  })
})

test('la oferta de mesas trae las de su facultad que no se tomaron, por fecha, con cupo y si ya está inscripto', async () => {
  const data = structuredClone(syntheticData)
  const december = data.siu.examBoards.find((b) => b.id === 'mesa-aga-fi-dic')!
  data.siu.examBoards.push(
    { ...december, id: 'mesa-aga-fi-feb', date: '2027-02-15T12:00:00.000Z', examPeriod: 'Turno Febrero 2027' },
    { ...december, id: 'mesa-aga-fi-jul', date: '2026-07-20T12:00:00.000Z', examPeriod: 'Turno Julio 2026' }
  )
  const { studies } = build(data)

  const result = await studies.offer('p-taguirre', { kind: 'examen', subjectId: 'aga' })

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.data.map((o) => [o.target, o.period, o.date, o.spotsLeft, o.alreadyEnrolled, o.enrolledElsewhere]),
    [
      [{ kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' }, 'Turno Diciembre 2026', december.date, 1, true, null],
      [
        { kind: 'mesa', examBoardId: 'mesa-aga-fi-feb' },
        'Turno Febrero 2027',
        '2027-02-15T12:00:00.000Z',
        2,
        false,
        null
      ]
    ]
  )
  assert.deepEqual(
    result.value.data[0].teachers.map((t) => t.name),
    ['Mariana Ledesma', 'Gustavo Ferreyra']
  )
})

test('la oferta de mesas avisa si para rendir le falta regularizar la cursada; las comisiones, nunca', async () => {
  const { studies } = build()

  // Valentina tiene Álgebra regular y cursa Análisis I, todavía sin regularizar.
  const aga = await studies.offer('p-vfunes', { kind: 'examen', subjectId: 'aga' })
  const am1 = await studies.offer('p-vfunes', { kind: 'examen', subjectId: 'am1' })
  const sections = await studies.offer('p-vfunes', { kind: 'cursada', subjectId: 'pr1' })

  assert.ok(aga.ok && am1.ok && sections.ok)
  assert.deepEqual(
    aga.value.data.map((o) => o.needsRegularity),
    [false]
  )
  assert.deepEqual(
    am1.value.data.map((o) => o.needsRegularity),
    [true]
  )
  assert.deepEqual(
    sections.value.data.map((o) => o.needsRegularity),
    [false, false]
  )
})

test('si la historia no se puede leer, la oferta de mesas sale igual, sin el aviso de regularidad', async () => {
  const { studies } = build(syntheticData, {}, { siuOverrides: { history: async () => fail('falla-externa') } })

  const am1 = await studies.offer('p-vfunes', { kind: 'examen', subjectId: 'am1' })

  assert.ok(am1.ok)
  assert.ok(am1.value.data.length > 0)
  assert.deepEqual(
    am1.value.data.map((o) => o.needsRegularity),
    am1.value.data.map(() => false)
  )
})

test('darse de baja de una mesa da de baja en el SIU sin tocar el aula', async () => {
  let unenrols = 0
  const { studies, siu } = build(
    syntheticData,
    {},
    {
      classroomOverrides: {
        unenrol: async () => {
          unenrols++
          return fail('falla-externa')
        }
      }
    }
  )

  const result = await studies.drop('p-taguirre', { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' })

  assert.ok(result.ok && result.value.kind === 'baja')
  const exams = await siu.examEnrollments('30101')
  assert.ok(exams.ok)
  assert.deepEqual(exams.value, [])
  assert.equal(unenrols, 0)
})

test('si el aula no deja matricular por API, inscribe en el SIU y no dice que quedó en el aula', async () => {
  const { studies, classroom } = build(syntheticData, { capabilities: { canEnrol: false } })

  const result = await studies.enroll('p-vfunes', PR1_VERANO)

  assert.ok(result.ok && result.value.kind === 'inscripto')
  assert.deepEqual(result.value.classroomCourseIds, [])
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
})

test('fuera de período la baja vuelve como error antes de tocar el aula', async () => {
  let unenrols = 0
  const { studies } = build(
    syntheticData,
    {},
    {
      classroomOverrides: {
        unenrol: async () => {
          unenrols++
          return fail('falla-externa')
        }
      }
    }
  )

  assert.deepEqual(await studies.drop('p-vfunes', { kind: 'comision', sectionId: 'sec-am1-fi-b' }), {
    ok: false,
    error: 'fuera-de-periodo'
  })
  assert.equal(unenrols, 0)
})

test('si falla la segunda aula y deshacer la primera también falla, vuelve «a medias» y la inscripción del SIU queda', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses.push({
    id: 'c-pr1-fi-v-lab',
    shortName: 'PR1-LAB',
    fullName: 'Laboratorio de PR1',
    siuSectionIds: ['sec-pr1-fi-v']
  })
  const memory = createMemoryClassroom(data)
  const { studies, siu } = build(
    data,
    {},
    {
      classroomOverrides: {
        ...memory,
        enrol: async (userId, courseId, role) =>
          courseId === 'c-pr1-fi-v-lab' ? fail('falla-externa') : memory.enrol(userId, courseId, role),
        unenrol: async () => fail('falla-externa')
      }
    }
  )

  assert.deepEqual(await studies.enroll('p-vfunes', PR1_VERANO), { ok: false, error: 'a-medias' })
  // Quedó en la primera aula: no se le puede decir que no se inscribió en nada.
  assert.deepEqual(await siuSections(siu, VALENTINA.siu), ['sec-am1-fi-b', 'sec-pr1-fi-v'])
  assert.deepEqual(await studentCourses(memory, VALENTINA.moodle), [...VALENTINA_COURSES, 'c-pr1-fi-v'])
})

test('si falla desmatricular la segunda aula y volver a matricular la primera también falla, la baja vuelve «a medias»', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.courses.push({
    id: 'c-fi1-fi-v-lab',
    shortName: 'FI1-LAB',
    fullName: 'Laboratorio de FI1',
    siuSectionIds: ['sec-fi1-fi-v']
  })
  data.moodle.enrolments.push({ userId: MARTIN.moodle, courseId: 'c-fi1-fi-v-lab', role: 'student' })
  const memory = createMemoryClassroom(data)
  const { studies, siu } = build(
    data,
    {},
    {
      classroomOverrides: {
        ...memory,
        unenrol: async (userId, courseId) =>
          courseId === 'c-fi1-fi-v-lab' ? fail('falla-externa') : memory.unenrol(userId, courseId),
        enrol: async () => fail('falla-externa')
      }
    }
  )

  assert.deepEqual(await studies.drop('p-mcabrera', FI1_VERANO), { ok: false, error: 'a-medias' })
  assert.deepEqual(await siuSections(siu, MARTIN.siu), ['sec-am1-fi-b', 'sec-fi1-fi-v'])
})

test('las comisiones de otra carrera salen marcadas en la oferta y no dejan inscribirse', async () => {
  const { studies } = build()

  // Sofía es de Industrial: de Probabilidad y Estadística de verano la C es de Informática.
  const offer = await studies.offer('p-sdominguez', { kind: 'cursada', subjectId: 'pye' })

  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => [o.name, o.otherProgram]),
    [
      ['Verano A', false],
      ['Verano B', false],
      ['Verano C', true]
    ]
  )
  assert.deepEqual(await studies.enroll('p-sdominguez', { kind: 'comision', sectionId: 'sec-pye-fi-vc' }), {
    ok: false,
    error: 'objetivo-desconocido'
  })
  const enrolled = await studies.enroll('p-sdominguez', { kind: 'comision', sectionId: 'sec-pye-fi-va' })
  assert.equal(enrolled.ok && enrolled.value.kind, 'inscripto')
})

test('la carrera trae cada materia del plan con su estado, sus notas y el avance', async () => {
  const { studies } = build()

  const result = await studies.career('p-sdominguez')

  assert.ok(result.ok)
  const career = result.value.data
  assert.deepEqual(career.program, { id: 'iind', name: 'Ingeniería Industrial', plan: 'Plan 2019', years: 5 })
  const status = (id: string) => career.subjects.find((s) => s.subjectId === id)
  assert.deepEqual(
    ['iin', 'an1', 'aga', 'am1', 'pye', 'tor'].map((id) => [id, status(id)?.status]),
    [
      ['iin', 'promocionada'],
      ['an1', 'aprobada'],
      ['aga', 'regular'],
      ['am1', 'en-curso'],
      ['pye', 'pendiente'],
      ['tor', 'promocionada']
    ]
  )
  const aga = status('aga')!
  assert.deepEqual(
    [aga.year, aga.kind, aga.courseGrade, aga.finalGrade, aga.academicYear],
    [1, 'obligatoria', 7, null, 2026]
  )
  assert.deepEqual(
    aga.assessments.map((a) => [a.name, a.grade, a.graded]),
    [
      ['Primer parcial', 7, true],
      ['Segundo parcial', 6, true]
    ]
  )
  // Análisis I: el primer parcial tiene nota en actuación provisoria y el segundo todavía no se tomó.
  assert.deepEqual(
    status('am1')!.assessments.map((a) => [a.name, a.grade, a.past, a.source]),
    [
      ['Primer parcial', 9, true, 'actuacion-provisoria'],
      ['Segundo parcial', null, false, null]
    ]
  )
  assert.equal(status('tor')!.year, null)
  // Promedio de las aprobadas con nota: 8, 7 y 6. La de vida universitaria no tiene nota.
  assert.equal(career.average, 7)
  assert.deepEqual(career.required, { approved: 3, total: 18 })
  assert.deepEqual(career.electives, { approved: 0, total: 2 })
  assert.deepEqual(career.universityLife, { approved: 1, total: 3 })
  // Lo que pide la carrera en otras unidades (fijo para la demo): el Taller de Oratoria da 2 de los 10
  // créditos, y las dos optativas del plan son 128 horas, ninguna aprobada.
  assert.deepEqual(career.universityLifeCredits, { approved: 2, total: 10 })
  assert.deepEqual(career.electiveHours, { approved: 0, total: 128 })
  assert.equal(career.percent, 17)
})

test('la carrera marca el final al que está inscripto y usa la propuesta activa, no la de aspirante', async () => {
  const { studies } = build()

  // Tomás tiene Informática activa y Aspirantes pasiva, y está inscripto a la mesa de Álgebra.
  const result = await studies.career('p-taguirre')

  assert.ok(result.ok)
  assert.equal(result.value.data.program?.id, 'iinf')
  assert.equal(result.value.data.subjects.find((s) => s.subjectId === 'aga')?.examDate, '2026-12-09T12:00:00.000Z')
})

test('un docente no tiene carrera, y con el SIU caído vuelve lo último leído', async () => {
  const { studies, siuState } = build()

  const teacher = await studies.career('p-mledesma')
  assert.ok(teacher.ok)
  assert.deepEqual(teacher.value.data.subjects, [])

  await studies.career('p-sdominguez')
  siuState.down = true
  const stale = await studies.career('p-sdominguez')
  assert.ok(stale.ok)
  assert.equal(stale.value.stale, true)
  assert.equal(stale.value.data.program?.id, 'iind')
})

// Inscripción a finales (#20): el mismo flujo y los mismos errores que la cursada.

/** La mesa de Álgebra de diciembre: cupo de 2, con Tomás ya inscripto. */
const MESA_AGA = { kind: 'mesa', examBoardId: 'mesa-aga-fi-dic' } as const

/** Mesas en las que el SIU tiene inscripta a una persona. */
async function siuBoards(siu: SiuPort, siuId: string) {
  const enrollments = await siu.examEnrollments(siuId)
  assert.ok(enrollments.ok)
  return enrollments.value.map((e) => e.examBoardId).sort()
}

test('inscribirse a una mesa la deja inscripta en el SIU, con el comprobante, y la oferta la marca con un lugar menos', async () => {
  const { studies, siu } = build()

  const result = await studies.enroll('p-vfunes', MESA_AGA)

  assert.ok(result.ok && result.value.kind === 'inscripto')
  assert.deepEqual(result.value.receipt.target, MESA_AGA)
  assert.match(result.value.receipt.transactionNumber, /\S/)
  assert.deepEqual(await siuBoards(siu, VALENTINA.siu), ['mesa-aga-fi-dic'])
  const offer = await studies.offer('p-vfunes', { kind: 'examen', subjectId: 'aga' })
  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => [o.target, o.alreadyEnrolled, o.enrolled, o.spotsLeft]),
    [[MESA_AGA, true, 2, 0]]
  )
})

test('con la mesa llena, el siguiente vuelve «sin cupo», no queda inscripto y la oferta lo muestra sin lugares', async () => {
  const { studies, siu } = build()
  const LUCIA = { siu: '30102' }
  assert.equal((await studies.enroll('p-vfunes', MESA_AGA)).ok, true)

  assert.deepEqual(await studies.enroll('p-lbenitez', MESA_AGA), { ok: false, error: 'sin-cupo' })

  assert.deepEqual(await siuBoards(siu, LUCIA.siu), [])
  const offer = await studies.offer('p-lbenitez', { kind: 'examen', subjectId: 'aga' })
  assert.ok(offer.ok)
  assert.deepEqual(
    offer.value.data.map((o) => [o.target, o.alreadyEnrolled, o.capacity, o.spotsLeft]),
    [[MESA_AGA, false, 2, 0]]
  )
})

test('darse de baja de una mesa devuelve el comprobante y libera el lugar para otro', async () => {
  const { studies, siu } = build()
  assert.equal((await studies.enroll('p-vfunes', MESA_AGA)).ok, true)

  const result = await studies.drop('p-vfunes', MESA_AGA)

  assert.ok(result.ok && result.value.kind === 'baja')
  assert.deepEqual(result.value.receipt.target, MESA_AGA)
  assert.deepEqual(await siuBoards(siu, VALENTINA.siu), [])
  const lucia = await studies.enroll('p-lbenitez', MESA_AGA)
  assert.ok(lucia.ok && lucia.value.kind === 'inscripto')
})

test('con una mesa, ya inscripto, no inscripto y una mesa de otra facultad vuelven los mismos errores que con una comisión', async () => {
  const { studies, siu } = build()

  assert.deepEqual(await studies.enroll('p-taguirre', MESA_AGA), { ok: false, error: 'ya-inscripto' })
  assert.deepEqual(await studies.drop('p-vfunes', MESA_AGA), { ok: false, error: 'no-inscripto' })
  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'mesa', examBoardId: 'mesa-iec-fce-dic' }), {
    ok: false,
    error: 'objetivo-desconocido'
  })
  assert.deepEqual(await studies.enroll('p-vfunes', { kind: 'mesa', examBoardId: 'mesa-nada' }), {
    ok: false,
    error: 'objetivo-desconocido'
  })
  assert.deepEqual(await siuBoards(siu, VALENTINA.siu), [])
})

test('cuando cierra la inscripción a la mesa, inscribirse y darse de baja vuelven «fuera de período» sin tocar el SIU', async () => {
  const { studies, siu, advance } = build()
  assert.equal((await studies.enroll('p-vfunes', MESA_AGA)).ok, true)
  // La inscripción al turno de diciembre cierra el 4/12 a las 23:59; la mesa es el 9/12.
  advance(25 * 24 * 60)

  assert.deepEqual(await studies.drop('p-vfunes', MESA_AGA), { ok: false, error: 'fuera-de-periodo' })
  assert.deepEqual(await studies.enroll('p-mcabrera', { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' }), {
    ok: false,
    error: 'fuera-de-periodo'
  })
  assert.deepEqual(await siuBoards(siu, VALENTINA.siu), ['mesa-aga-fi-dic'])
  assert.deepEqual(await siuBoards(siu, MARTIN.siu), [])
})

test('si el SIU no deja inscribir por API, la mesa devuelve «requiere autogestión» con el enlace a la mesa, al inscribirse y al darse de baja', async () => {
  const { studies, siu } = build(syntheticData, {}, { siu: { capabilities: { canEnroll: false } } })
  const TOMAS = { siu: '30101' }
  const selfService = {
    ok: true,
    value: {
      kind: 'requiere-autogestion',
      url: `${syntheticData.siu.selfServiceBaseUrl}/examenes/inscripcion?mesa=mesa-aga-fi-dic`
    }
  }

  assert.deepEqual(await studies.enroll('p-vfunes', MESA_AGA), selfService)
  assert.deepEqual(await studies.drop('p-taguirre', MESA_AGA), selfService)
  assert.deepEqual(await siuBoards(siu, VALENTINA.siu), [])
  assert.deepEqual(await siuBoards(siu, TOMAS.siu), ['mesa-aga-fi-dic'])
})
