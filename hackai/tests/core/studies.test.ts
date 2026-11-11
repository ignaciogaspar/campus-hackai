import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom, type MemoryClassroomOptions } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu, type MemorySiuOptions } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies, type MySubject } from '@/lib/core/studies'
import type { ClockPort } from '@/lib/ports/clock'
import { fail } from '@/lib/result'

const NOW = syntheticData.now

/** Reloj que se puede adelantar, para ver la hora de cada lectura. */
function movableClock(start: string) {
  let current = new Date(start)
  const clock: ClockPort = { capabilities: { fixed: true }, now: () => new Date(current) }
  return {
    clock,
    advance: (minutes: number) => {
      current = new Date(current.getTime() + minutes * 60_000)
    }
  }
}

/** Puerto en memoria que se puede «caer»: con `down`, toda llamada que devuelve una promesa devuelve `falla-externa`. */
function fallible<P extends object>(port: P) {
  const state = { down: false }
  const wrapped = new Proxy(port, {
    get(target, key) {
      const value = target[key as keyof P]
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        if (key === 'courseUrl') return (value as (...a: unknown[]) => unknown).apply(target, args)
        return state.down
          ? Promise.resolve(fail('falla-externa'))
          : (value as (...a: unknown[]) => unknown).apply(target, args)
      }
    }
  })
  return { port: wrapped, state }
}

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
    assignments: [{ name: 'Guía 3 resuelta', dueDate: '2026-11-14T02:59:00.000Z', source: 'moodle', past: false }]
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
    { name: 'Entrega del TP integrador', dueDate: '2026-10-17T02:59:00.000Z', source: 'moodle', past: true },
    { name: 'Ejercicios de recursión', dueDate: '2026-11-22T02:59:00.000Z', source: 'moodle', past: false }
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

// Notas, historia y constancias

test('las notas de parciales salen juntas, vengan de la historia o de actuación provisoria, la más reciente primero', async () => {
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
      source: 'historia'
    },
    {
      subjectId: 'am1',
      subjectName: 'Análisis Matemático I',
      assessmentName: 'Primer parcial',
      grade: 7,
      date: '2026-09-21T11:00:00.000Z',
      source: 'actuacion-provisoria'
    },
    {
      subjectId: 'aga',
      subjectName: 'Álgebra y Geometría Analítica',
      assessmentName: 'Segundo parcial',
      grade: 7,
      date: '2026-06-23T11:00:00.000Z',
      source: 'historia'
    },
    {
      subjectId: 'aga',
      subjectName: 'Álgebra y Geometría Analítica',
      assessmentName: 'Primer parcial',
      grade: 6,
      date: '2026-04-21T11:00:00.000Z',
      source: 'historia'
    }
  ])
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
  const { studies } = build(syntheticData, {}, { capabilities: { hasAssessmentSchedule: false } })

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
      type: 'alumno-regular',
      meetsConditions: true,
      reasons: [],
      url: 'https://autogestion.example.edu.ar/constancias/solicitar?tipo=alumno-regular'
    }
  })
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
  assert.equal(result.value.meetsConditions, false)
  assert.deepEqual(result.value.reasons, ['sin-propuesta-activa'])
  assert.equal(result.value.url, 'https://autogestion.example.edu.ar/constancias/solicitar?tipo=alumno-regular')
})

test('si no cumple la de alumno regular porque no tiene inscripciones a cursada vigentes, lo dice', async () => {
  const data = withoutConditions('p-lbenitez', 'alumno-regular')
  const lucia = data.people.find((p) => p.id === 'p-lbenitez')!.siuId
  for (const e of data.siu.courseEnrollments) if (e.personId === lucia) e.status = 'baja'
  const { studies } = build(data)

  const result = await studies.certificate('p-lbenitez', 'alumno-regular')

  assert.ok(result.ok)
  assert.deepEqual(result.value.reasons, ['sin-inscripcion-vigente'])
})

test('si el SIU dice que no cumple y Cursada no encuentra el motivo, no inventa uno', async () => {
  const { studies } = build(withoutConditions('p-taguirre', 'alumno-regular'))

  const result = await studies.certificate('p-taguirre', 'alumno-regular')

  assert.ok(result.ok)
  assert.equal(result.value.meetsConditions, false)
  assert.deepEqual(result.value.reasons, [])
})

test('si no cumple la de examen final porque no rindió ningún final, lo dice', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-lbenitez', 'examen-final')

  assert.ok(result.ok)
  assert.equal(result.value.meetsConditions, false)
  assert.deepEqual(result.value.reasons, ['sin-examenes-rendidos'])
  assert.equal(result.value.url, 'https://autogestion.example.edu.ar/constancias/solicitar?tipo=examen-final')
})

test('la constancia de examen final la cumple quien ya rindió un final', async () => {
  const { studies } = build()

  const result = await studies.certificate('p-taguirre', 'examen-final')

  assert.ok(result.ok)
  assert.equal(result.value.meetsConditions, true)
  assert.deepEqual(result.value.reasons, [])
})

test('la constancia de una persona que no existe devuelve «persona desconocida», y con el SIU caído, «falla externa»', async () => {
  const { studies, siuState } = build()

  assert.deepEqual(await studies.certificate('p-nadie', 'alumno-regular'), { ok: false, error: 'persona-desconocida' })
  siuState.down = true
  assert.deepEqual(await studies.certificate('p-taguirre', 'alumno-regular'), { ok: false, error: 'falla-externa' })
})
