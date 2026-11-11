import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom, type MemoryClassroomOptions } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu, type MemorySiuOptions } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies, type MySubject, type OpenEnrollment, type UpcomingItem } from '@/lib/core/studies'
import { fallible, movableClock } from '@/tests/core/helpers'

const NOW = syntheticData.now

function build(
  data: SyntheticData = syntheticData,
  classroomOptions: MemoryClassroomOptions = {},
  siuOptions: MemorySiuOptions = {}
) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state } = fallible(createMemorySiu(data, clock, siuOptions))
  const { port: classroom, state: classroomState } = fallible(createMemoryClassroom(data, classroomOptions))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom, clock })
  return { studies, siuState: state, classroomState, advance }
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
    schoolId: 'fi',
    termId: '2c-2026',
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
      ['sec-fi1-fi-v', 'profesor']
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

test('con Moodle caído devuelve lo último que leyó, marcado como desactualizado', async () => {
  const { studies, classroomState, advance } = build()
  const first = await studies.subjectsOf('p-taguirre')
  assert.ok(first.ok)

  advance(20)
  classroomState.down = true
  const second = await studies.subjectsOf('p-taguirre')

  assert.deepEqual(second, { ok: true, value: { data: first.value.data, readAt: NOW, stale: true } })
})

test('con Moodle caído y sin nada leído antes devuelve «falla externa»', async () => {
  const { studies, classroomState } = build()
  classroomState.down = true

  assert.deepEqual(await studies.subjectsOf('p-taguirre'), { ok: false, error: 'falla-externa' })
  // Las comisiones no dependen de Moodle.
  assert.equal((await studies.sectionsOf('p-taguirre')).ok, true)
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
    past: false
  })
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
  const { studies } = build(syntheticData, {}, { capabilities: { hasAssessmentSchedule: false } })

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

test('ve las mesas de lo que tiene regular o está cursando y las comisiones de verano con cupo de lo que le falta cursar, las que cierran antes primero', async () => {
  const { studies } = build()

  // Valentina tiene Álgebra regular, cursa Análisis I y no cursó Programación I.
  const result = await studies.openEnrollments('p-vfunes')

  assert.ok(result.ok)
  assert.equal(result.value.stale, false)
  assert.equal(result.value.readAt, NOW)
  assert.deepEqual(openings(result.value.data), [
    ['examen', 'aga', '2026-12-05T02:59:00.000Z'],
    ['examen', 'am1', '2026-12-05T02:59:00.000Z'],
    ['cursada', 'pr1', '2026-12-19T02:59:00.000Z']
  ])
  assert.deepEqual(result.value.data[2], {
    kind: 'cursada',
    subjectId: 'pr1',
    subjectName: 'Programación I',
    opensAt: '2026-11-02T03:00:00.000Z',
    closesAt: '2026-12-19T02:59:00.000Z',
    needsRegularity: false
  })
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

  // Tomás ya está en la mesa de Álgebra y cursa Análisis I y Programación I.
  const result = await studies.openEnrollments('p-taguirre')

  assert.ok(result.ok)
  assert.deepEqual(openings(result.value.data), [['examen', 'am1', '2026-12-05T02:59:00.000Z']])
})

test('una comisión sin cupo no le sirve; con lugar, sí', async () => {
  const data = structuredClone(syntheticData)
  data.siu.sections.find((s) => s.id === 'sec-fi1-fi-v')!.capacity = 10
  const { studies: withRoom } = build(data)
  const { studies: full } = build()

  const open = await withRoom.openEnrollments('p-vfunes')
  const closed = await full.openEnrollments('p-vfunes')

  assert.ok(open.ok && closed.ok)
  assert.equal(
    open.value.data.some((i) => i.kind === 'cursada' && i.subjectId === 'fi1'),
    true
  )
  assert.equal(
    closed.value.data.some((i) => i.subjectId === 'fi1'),
    false
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
    [['cursada', 'pr1']]
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
