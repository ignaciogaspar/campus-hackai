import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom, type MemoryClassroomOptions } from '@/lib/adapters/memoria/classroom'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu, type MemorySiuOptions } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createStudies, type MySubject } from '@/lib/core/studies'
import type { ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort } from '@/lib/ports/siu'
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
        if (key === 'courseUrl' || key === 'selfServiceUrl')
          return (value as (...a: unknown[]) => unknown).apply(target, args)
        return state.down
          ? Promise.resolve(fail('falla-externa'))
          : (value as (...a: unknown[]) => unknown).apply(target, args)
      }
    }
  })
  return { port: wrapped, state }
}

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

// Inscripción en un paso: oferta, inscripción y baja.

test('la oferta de una materia muestra las comisiones de su facultad que no terminaron, con cupo, horario y docentes', async () => {
  const { studies } = build()

  const result = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'pr1' })

  assert.ok(result.ok)
  assert.deepEqual(
    result.value.map((o) => [o.target, o.alreadyEnrolled, o.enrollmentOpen]),
    [
      [{ kind: 'comision', sectionId: 'sec-pr1-fi-a' }, true, false],
      [{ kind: 'comision', sectionId: 'sec-pr1-fi-v' }, false, true]
    ]
  )
  assert.deepEqual(result.value[1], {
    target: { kind: 'comision', sectionId: 'sec-pr1-fi-v' },
    subjectId: 'pr1',
    subjectName: 'Programación I',
    name: 'Verano',
    period: 'Curso de Verano 2027',
    schedule: [{ day: 'martes', start: '09:00', end: '13:00' }],
    date: null,
    location: 'Virtual',
    modality: 'virtual',
    teachers: [{ personId: 'p-darrieta', name: 'Diego Arrieta' }],
    capacity: null,
    enrolled: 0,
    spotsLeft: null,
    enrollmentStart: '2026-11-02T03:00:00.000Z',
    enrollmentEnd: '2026-12-19T02:59:00.000Z',
    enrollmentOpen: true,
    alreadyEnrolled: false,
    enrolledElsewhere: 'A'
  })
})

test('la oferta nunca trae comisiones de otra facultad ni de períodos que ya terminaron', async () => {
  const { studies } = build()

  const fi = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'am1' })
  const fce = await studies.offer('p-nherrera', { kind: 'cursada', subjectId: 'am1' })
  const aga = await studies.offer('p-taguirre', { kind: 'cursada', subjectId: 'aga' })

  assert.ok(fi.ok && fce.ok && aga.ok)
  assert.deepEqual(
    fi.value.map((o) => o.target),
    [
      { kind: 'comision', sectionId: 'sec-am1-fi-a' },
      { kind: 'comision', sectionId: 'sec-am1-fi-b' }
    ]
  )
  assert.deepEqual(
    fce.value.map((o) => o.target),
    [
      { kind: 'comision', sectionId: 'sec-am1-fce-a' },
      { kind: 'comision', sectionId: 'sec-am1-fce-v' }
    ]
  )
  assert.deepEqual(aga.value, [])
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
    offer.value.map((o) => o.alreadyEnrolled),
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
    offer.value.map((o) => o.alreadyEnrolled),
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

test('con el SIU caído no se inscribe en nada y vuelve «falla externa»', async () => {
  const { studies, siuState, classroom } = build()
  siuState.down = true

  assert.deepEqual(await studies.enroll('p-vfunes', PR1_VERANO), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await studentCourses(classroom, VALENTINA.moodle), VALENTINA_COURSES)
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
    offer.value.map((o) => [o.name, o.alreadyEnrolled, o.enrolledElsewhere]),
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

test('las inscripciones abiertas son las materias de su facultad con un período en inscripción, sin las que ya cursa', async () => {
  const { studies } = build()

  const tomas = await studies.openEnrollments('p-taguirre')
  const martin = await studies.openEnrollments('p-mcabrera')
  const federico = await studies.openEnrollments('p-fjuarez')

  assert.ok(tomas.ok && martin.ok && federico.ok)
  assert.equal(tomas.value.stale, false)
  assert.deepEqual(tomas.value.data, [
    {
      kind: 'cursada',
      subjectId: 'fi1',
      subjectName: 'Física I',
      opensAt: '2026-11-02T03:00:00.000Z',
      closesAt: '2026-12-19T02:59:00.000Z'
    }
  ])
  assert.deepEqual(
    martin.value.data.map((o) => o.subjectId),
    ['pr1']
  )
  // Federico, de Ciencias Empresariales, no cursa Análisis Matemático I.
  assert.deepEqual(
    federico.value.data.map((o) => o.subjectId),
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
    fi1.value.map((o) => o.spotsLeft),
    [0]
  )
  assert.deepEqual(
    am1.value.map((o) => [o.name, o.capacity, o.enrolled, o.spotsLeft]),
    [
      ['A', 40, 3, 37],
      ['B', 40, 3, 37]
    ]
  )
  assert.deepEqual(
    pr1.value.map((o) => o.spotsLeft),
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
    offer.value.map((o) => [o.name, o.alreadyEnrolled, o.enrolledElsewhere]),
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
    result.value.map((o) => [o.target, o.period, o.date, o.spotsLeft, o.alreadyEnrolled, o.enrolledElsewhere]),
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
    result.value[0].teachers.map((t) => t.name),
    ['Mariana Ledesma', 'Gustavo Ferreyra']
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
