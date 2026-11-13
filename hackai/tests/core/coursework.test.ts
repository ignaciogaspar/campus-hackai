import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework, type NewTask } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createStudies } from '@/lib/core/studies'
import type { FilesPort } from '@/lib/ports/files'
import { fail } from '@/lib/result'
import { fallible, movableClock } from '@/tests/core/helpers'

const A = 'sec-am1-fi-a'
const B = 'sec-am1-fi-b'
/** Viernes 13/11/2026, 23:59 en Buenos Aires: tres días después del «hoy» del set. */
const DUE = '2026-11-13T23:59:00-03:00'

/** Una materia con dos comisiones del mismo docente, con alumnos: Análisis I con Gustavo Ferreyra también en la A. */
function withTwoSectionsForOneTeacher(): SyntheticData {
  const data = structuredClone(syntheticData)
  const section = data.siu.sections.find((s) => s.id === A)
  const gustavo = data.people.find((p) => p.id === 'p-gferreyra')
  assert.ok(section && gustavo)
  section.teacherIds.push(gustavo.siuId)
  return data
}

/** Seguimiento con Personas y Cursada reales sobre los puertos en memoria, y el reloj fijo que se adelanta a mano. */
function build(data: SyntheticData = syntheticData) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(data, clock))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom: createMemoryClassroom(data), clock })
  const files = createMemoryFiles()
  const store = createMemoryCourseworkStore()
  const coursework = createCoursework({ studies, files, clock, store })
  return { coursework, files, store, siuState, advance }
}

const taskOf = (fields: Partial<NewTask> = {}): NewTask => ({
  subjectId: 'am1',
  sectionIds: [A],
  name: 'Práctica 3: integrales',
  instructions: 'Resolvé los ejercicios 1 a 10.',
  dueAt: DUE,
  graded: true,
  ...fields
})

function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

test('una docente crea una tarea de su comisión y la ve con su fecha límite, su consigna y que lleva nota', async () => {
  const { coursework } = build()

  const created = value(await coursework.createTask('p-mledesma', taskOf()))

  assert.equal(created.name, 'Práctica 3: integrales')
  assert.equal(created.instructions, 'Resolvé los ejercicios 1 a 10.')
  assert.equal(created.dueAt, new Date(DUE).toISOString())
  assert.equal(created.graded, true)
  assert.equal(created.past, false)
  assert.equal(created.canManage, true)
  assert.deepEqual(created.sections, [{ sectionId: A, name: 'A' }])
  assert.equal(created.subject.subjectName, 'Análisis Matemático I')
  const list = value(await coursework.tasksOf('p-mledesma', 'am1'))
  assert.equal(list.role, 'profesor')
  assert.deepEqual(
    list.tasks.map((t) => t.id),
    [created.id]
  )
})

test('un alumno de la comisión A ve la tarea de A y no la que es solo de la B', async () => {
  const { coursework } = build()
  const ofA = value(await coursework.createTask('p-mledesma', taskOf({ name: 'Solo de A' })))
  const ofB = value(await coursework.createTask('p-gferreyra', taskOf({ name: 'Solo de B', sectionIds: [B] })))

  const taguirre = value(await coursework.tasksOf('p-taguirre', 'am1'))
  const mcabrera = value(await coursework.tasksOf('p-mcabrera', 'am1'))

  assert.deepEqual(
    taguirre.tasks.map((t) => t.name),
    ['Solo de A']
  )
  assert.deepEqual(
    mcabrera.tasks.map((t) => t.name),
    ['Solo de B']
  )
  assert.deepEqual(await coursework.task('p-taguirre', ofB.id), { ok: false, error: 'tarea-desconocida' })
  assert.equal(value(await coursework.task('p-taguirre', ofA.id)).role, 'alumno')
})

test('una tarea de varias comisiones la ven los alumnos de todas, cada uno con su comisión', async () => {
  const { coursework } = build(withTwoSectionsForOneTeacher())
  const created = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [A, B] })))

  const asTeacher = value(await coursework.task('p-gferreyra', created.id))
  const asStudentOfA = value(await coursework.task('p-taguirre', created.id))
  const asStudentOfB = value(await coursework.task('p-mcabrera', created.id))

  assert.deepEqual(asTeacher.sections.map((s) => s.sectionId).sort(), [A, B])
  // Un alumno nunca se entera de las otras comisiones de la tarea.
  assert.deepEqual(asStudentOfA.sections, [{ sectionId: A, name: 'A' }])
  assert.deepEqual(asStudentOfB.sections, [{ sectionId: B, name: 'B' }])
  assert.equal(asStudentOfA.canManage, false)
})

test('solo los docentes de las comisiones de la tarea la gestionan', async () => {
  const { coursework } = build()
  const created = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [B] })))
  const changes = { name: 'Otro nombre', instructions: 'Otra consigna', dueAt: '2026-11-20T10:00:00-03:00' }

  // La docente de A no ve una tarea de B: para ella no existe. Un alumno la ve de A, pero no la edita.
  assert.deepEqual(await coursework.updateTask('p-mledesma', created.id, changes), {
    ok: false,
    error: 'tarea-desconocida'
  })
  assert.deepEqual(await coursework.updateTask('p-mcabrera', created.id, changes), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.equal(value(await coursework.task('p-gferreyra', created.id)).name, 'Práctica 3: integrales')
})

test('un docente cambia nombre, consigna y fecha límite, pero no las comisiones ni si lleva nota', async () => {
  const { coursework } = build()
  const created = value(await coursework.createTask('p-mledesma', taskOf()))

  const updated = value(
    await coursework.updateTask('p-mledesma', created.id, {
      name: '  Práctica 3 (corregida)  ',
      instructions: 'Hacé solo los pares.',
      dueAt: '2026-11-20T10:00:00-03:00'
    })
  )

  assert.equal(updated.name, 'Práctica 3 (corregida)')
  assert.equal(updated.instructions, 'Hacé solo los pares.')
  assert.equal(updated.dueAt, '2026-11-20T13:00:00.000Z')
  assert.equal(updated.graded, true)
  assert.deepEqual(updated.sections, created.sections)
  // El alumno ve lo editado.
  assert.equal(value(await coursework.task('p-taguirre', created.id)).name, 'Práctica 3 (corregida)')
})

test('no se crea con nombre vacío, fecha inválida, consigna enorme o archivo vacío', async () => {
  const { coursework } = build()

  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ name: '   ' })), {
    ok: false,
    error: 'nombre-invalido'
  })
  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ dueAt: 'mañana' })), {
    ok: false,
    error: 'fecha-invalida'
  })
  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ instructions: 'x'.repeat(5001) })), {
    ok: false,
    error: 'consigna-invalida'
  })
  const empty = { name: 'vacio.txt', contentType: 'text/plain', bytes: new Uint8Array() }
  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ file: empty })), {
    ok: false,
    error: 'archivo-vacio'
  })
  assert.deepEqual(value(await coursework.tasksOf('p-mledesma', 'am1')).tasks, [])
})

test('crear una tarea es solo de docentes, y de las comisiones que dictan', async () => {
  const { coursework } = build()

  // Un alumno no crea.
  assert.deepEqual(await coursework.createTask('p-taguirre', taskOf()), { ok: false, error: 'solo-docentes' })
  // Ni un docente de otra materia.
  assert.deepEqual(await coursework.createTask('p-darrieta', taskOf()), { ok: false, error: 'sin-acceso' })
  // Una docente no crea para la comisión de otro, aunque el formulario la mande.
  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ sectionIds: [A, B] })), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await coursework.createTask('p-mledesma', taskOf({ sectionIds: [] })), {
    ok: false,
    error: 'sin-comisiones'
  })
  // Una persona que Cursada no conoce.
  assert.deepEqual(await coursework.createTask('p-nadie', taskOf()), { ok: false, error: 'persona-desconocida' })
  const none = value(await coursework.tasksOf('p-mledesma', 'am1'))
  assert.deepEqual(none.tasks, [])
})

test('una tarea sin nota queda marcada así', async () => {
  const { coursework } = build()
  await coursework.createTask('p-mledesma', taskOf({ name: 'Con nota', graded: true }))
  await coursework.createTask('p-mledesma', taskOf({ name: 'Sin nota', graded: false }))

  const list = value(await coursework.tasksOf('p-taguirre', 'am1'))

  assert.deepEqual(
    list.tasks.map((t) => [t.name, t.graded]),
    [
      ['Con nota', true],
      ['Sin nota', false]
    ]
  )
})

test('las que vencen primero salen arriba y las vencidas al final, según el reloj', async () => {
  const { coursework, advance } = build()
  await coursework.createTask('p-mledesma', taskOf({ name: 'Tarde', dueAt: '2026-11-20T10:00:00-03:00' }))
  await coursework.createTask('p-mledesma', taskOf({ name: 'Temprano', dueAt: '2026-11-12T10:00:00-03:00' }))
  await coursework.createTask('p-mledesma', taskOf({ name: 'Ya venció', dueAt: '2026-11-09T10:00:00-03:00' }))

  const before = value(await coursework.tasksOf('p-taguirre', 'am1'))
  assert.deepEqual(
    before.tasks.map((t) => [t.name, t.past]),
    [
      ['Temprano', false],
      ['Tarde', false],
      ['Ya venció', true]
    ]
  )

  advance(3 * 24 * 60)
  const after = value(await coursework.tasksOf('p-taguirre', 'am1'))
  assert.deepEqual(
    after.tasks.map((t) => [t.name, t.past]),
    [
      ['Tarde', false],
      ['Temprano', true],
      ['Ya venció', true]
    ]
  )
})

test('el docente elige la comisión y una que no es suya cae en la primera; el alumno siempre ve la suya', async () => {
  const { coursework } = build(withTwoSectionsForOneTeacher())
  await coursework.createTask('p-gferreyra', taskOf({ name: 'De A', sectionIds: [A] }))
  await coursework.createTask('p-gferreyra', taskOf({ name: 'De B', sectionIds: [B] }))

  const inA = value(await coursework.tasksOf('p-gferreyra', 'am1', A))
  const inB = value(await coursework.tasksOf('p-gferreyra', 'am1', B))
  const invalid = value(await coursework.tasksOf('p-gferreyra', 'am1', 'sec-que-no-existe'))
  const student = value(await coursework.tasksOf('p-taguirre', 'am1', B))

  assert.deepEqual(
    inA.tasks.map((t) => t.name),
    ['De A']
  )
  assert.deepEqual(
    inB.tasks.map((t) => t.name),
    ['De B']
  )
  assert.equal(inB.sectionId, B)
  assert.equal(invalid.sectionId, inA.sections[0].sectionId)
  assert.deepEqual(inA.sections.map((s) => s.sectionId).sort(), [A, B])
  // La comisión B no es de Tomás: pidiendo `?comision=B` sigue viendo la suya.
  assert.equal(student.sectionId, A)
  assert.deepEqual(
    student.tasks.map((t) => t.name),
    ['De A']
  )
})

test('quien no es de la materia no ve ni lista nada', async () => {
  const { coursework } = build()
  const created = value(await coursework.createTask('p-mledesma', taskOf()))

  assert.deepEqual(await coursework.tasksOf('p-darrieta', 'am1'), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.task('p-agimenez', created.id), { ok: false, error: 'tarea-desconocida' })
  // Una alumna de Análisis I de otra facultad lista las suyas, no las de Ingeniería.
  assert.deepEqual(value(await coursework.tasksOf('p-agimenez', 'am1')).tasks, [])
  assert.deepEqual(await coursework.task('p-taguirre', 'tarea-inventada'), { ok: false, error: 'tarea-desconocida' })
})

test('el archivo de la consigna lo bajan los docentes y los alumnos de la comisión, y nadie más', async () => {
  const { coursework } = build()
  const bytes = new TextEncoder().encode('guía de ejercicios')
  const created = value(
    await coursework.createTask('p-mledesma', taskOf({ file: { name: 'guia.txt', contentType: 'text/plain', bytes } }))
  )
  assert.ok(created.file)
  assert.equal(created.file.name, 'guia.txt')
  assert.equal(created.file.size, bytes.byteLength)
  const fileId = created.file.url.split('/')[2]

  const teacher = value(await coursework.file('p-mledesma', fileId))
  const student = value(await coursework.file('p-taguirre', fileId))

  assert.deepEqual([...teacher.bytes], [...bytes])
  assert.equal(student.contentType, 'text/plain')
  // Un alumno de la comisión B, un docente de otra comisión y alguien de otra facultad no.
  assert.deepEqual(await coursework.file('p-mcabrera', fileId), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.file('p-gferreyra', fileId), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.file('p-agimenez', fileId), { ok: false, error: 'sin-acceso' })
  // Un id que no es de ninguna tarea.
  assert.deepEqual(await coursework.file('p-taguirre', '00000000-0000-4000-8000-000000000000'), {
    ok: false,
    error: 'archivo-desconocido'
  })
  assert.deepEqual(await coursework.file('p-taguirre', 'no-es-un-uuid'), { ok: false, error: 'archivo-desconocido' })
})

test('si la base no guarda la tarea, el archivo que se había guardado se borra', async () => {
  const { clock } = movableClock(syntheticData.now)
  const { port: siu } = fallible(createMemorySiu(syntheticData, clock))
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
  const studies = createStudies({ people, siu, classroom: createMemoryClassroom(syntheticData), clock })
  const real = createMemoryFiles()
  const saved: string[] = []
  const deleted: string[] = []
  const files: FilesPort = {
    ...real,
    async save(file) {
      const result = await real.save(file)
      if (result.ok) saved.push(result.value.id)
      return result
    },
    async delete(id) {
      deleted.push(id)
      return real.delete(id)
    }
  }
  const store = createMemoryCourseworkStore()
  const coursework = createCoursework({
    studies,
    files,
    clock,
    store: { ...store, createTask: async () => fail('falla-externa') }
  })
  const file = { name: 'guia.txt', contentType: 'text/plain', bytes: new TextEncoder().encode('guía') }

  const result = await coursework.createTask('p-mledesma', taskOf({ file }))

  assert.deepEqual(result, { ok: false, error: 'falla-externa' })
  assert.equal(saved.length, 1)
  assert.deepEqual(deleted, saved)
})

test('con el SIU caído se usa la última lectura de comisiones y se avisa desde cuándo', async () => {
  const { coursework, siuState } = build()
  const created = value(await coursework.createTask('p-mledesma', taskOf()))
  value(await coursework.tasksOf('p-taguirre', 'am1'))

  siuState.down = true
  const list = await coursework.tasksOf('p-taguirre', 'am1')
  const detail = await coursework.task('p-taguirre', created.id)

  assert.ok(list.ok)
  assert.ok(list.value.staleSince)
  assert.equal(list.value.tasks.length, 1)
  assert.ok(detail.ok)
  assert.ok(detail.value.staleSince)
  // Sin ninguna lectura previa, no hay con qué decidir.
  assert.deepEqual(await coursework.tasksOf('p-lbenitez', 'am1'), { ok: false, error: 'falla-externa' })
})
