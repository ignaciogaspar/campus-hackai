import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
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
function build(data: SyntheticData = syntheticData, wrapFiles: (files: FilesPort) => FilesPort = (f) => f) {
  const { clock, advance } = movableClock(data.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(data, clock))
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({
    people,
    siu,
    classroom: createMemoryClassroom(data),
    clock,
    store: createMemoryStudiesStore()
  })
  const files = wrapFiles(createMemoryFiles())
  const store = createMemoryCourseworkStore()
  const coursework = createCoursework({ studies, files, clock, store })
  return { coursework, studies, files, store, siuState, advance }
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
  const studies = createStudies({
    people,
    siu,
    classroom: createMemoryClassroom(syntheticData),
    clock,
    store: createMemoryStudiesStore()
  })
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

// --- Entregas ---------------------------------------------------------------

const upload = (name: string, text = `contenido de ${name}`) => ({
  name,
  contentType: 'text/plain',
  bytes: new TextEncoder().encode(text)
})

/** El id del archivo en su URL: `/archivos/<id>/<nombre>`. */
const fileIdOf = (file: { url: string }) => file.url.split('/')[2]

/** Una tarea de A que vence el viernes 13/11 a las 23:59, y quien la entrega. */
async function withTaskInA(fields: Partial<NewTask> = {}, wrapFiles?: (files: FilesPort) => FilesPort) {
  const built = build(syntheticData, wrapFiles)
  const task = value(await built.coursework.createTask('p-mledesma', taskOf(fields)))
  return { ...built, task }
}

test('un alumno entrega uno o más archivos y ve cuándo entregó, sin atraso si llegó a tiempo', async () => {
  const { coursework, task } = await withTaskInA()

  const submission = value(await coursework.submit('p-taguirre', task.id, [upload('tp3.txt'), upload('anexo.txt')]))

  assert.equal(submission.taskId, task.id)
  assert.equal(submission.submittedAt, '2026-11-10T15:00:00.000Z')
  assert.deepEqual(
    submission.files.map((f) => f.name),
    ['tp3.txt', 'anexo.txt']
  )
  assert.match(submission.files[0].url, /^\/archivos\/[0-9a-f-]{36}\/tp3\.txt$/)
  assert.equal(submission.late, null)
  assert.equal(submission.graded, false)
  const detail = value(await coursework.task('p-taguirre', task.id))
  assert.deepEqual(detail.submission, submission)
  const list = value(await coursework.tasksOf('p-taguirre', 'am1'))
  assert.deepEqual(list.tasks[0].submission, submission)
})

test('una entrega después de la fecha límite se acepta y queda atrasada, con cuántos minutos', async () => {
  const { coursework, task, advance } = await withTaskInA()
  // Hasta el viernes 23:59 hay 3 días y 11 horas y 59 minutos; 150 minutos más.
  advance(3 * 24 * 60 + 11 * 60 + 59 + 150)

  const submission = value(await coursework.submit('p-taguirre', task.id, [upload('tarde.txt')]))

  assert.deepEqual(submission.late, { minutes: 150 })
  assert.equal(value(await coursework.task('p-taguirre', task.id)).past, true)
})

test('un atraso de segundos cuenta como un minuto, y entregar justo en la hora límite no es tarde', async () => {
  const { coursework, task, advance } = await withTaskInA({ dueAt: '2026-11-10T15:00:30.000Z' })
  advance(0.5)

  const onTime = value(await coursework.submit('p-taguirre', task.id, [upload('a.txt')]))
  advance(0.5)
  const justLate = value(await coursework.submit('p-taguirre', task.id, [upload('b.txt')]))

  assert.equal(onTime.late, null)
  assert.deepEqual(justLate.late, { minutes: 1 })
})

test('si el docente corre la fecha límite, el atraso de una entrega se recalcula', async () => {
  const { coursework, task, advance } = await withTaskInA()
  advance(3 * 24 * 60 + 11 * 60 + 59 + 60)
  const late = value(await coursework.submit('p-taguirre', task.id, [upload('tarde.txt')]))
  assert.deepEqual(late.late, { minutes: 60 })

  value(
    await coursework.updateTask('p-mledesma', task.id, {
      name: task.name,
      instructions: task.instructions,
      dueAt: '2026-11-20T23:59:00-03:00'
    })
  )

  assert.equal(value(await coursework.task('p-taguirre', task.id)).submission?.late, null)
})

test('un alumno de la comisión A no entrega una tarea que es solo de la B', async () => {
  const { coursework, files } = build()
  const onlyB = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [B] })))

  const denied = await coursework.submit('p-taguirre', onlyB.id, [upload('intruso.txt')])
  const allowed = await coursework.submit('p-mcabrera', onlyB.id, [upload('mia.txt')])

  assert.deepEqual(denied, { ok: false, error: 'tarea-desconocida' })
  assert.ok(allowed.ok)
  assert.ok((await files.read(fileIdOf(allowed.value.files[0]))).ok)
  assert.deepEqual(await coursework.submit('p-taguirre', 'tarea-inventada', [upload('x.txt')]), {
    ok: false,
    error: 'tarea-desconocida'
  })
})

test('un docente no entrega tareas, ni siquiera las de su comisión', async () => {
  const { coursework, task } = await withTaskInA()

  assert.deepEqual(await coursework.submit('p-mledesma', task.id, [upload('x.txt')]), {
    ok: false,
    error: 'solo-alumnos'
  })
})

test('entregar de nuevo reemplaza la entrega anterior y borra sus archivos, hasta que el docente la califica', async () => {
  const { coursework, files, store, task, advance } = await withTaskInA()
  const first = value(await coursework.submit('p-taguirre', task.id, [upload('v1.txt')]))
  advance(60)

  const second = value(await coursework.submit('p-taguirre', task.id, [upload('v2.txt'), upload('v2-anexo.txt')]))

  assert.equal(second.id, first.id)
  assert.equal(second.submittedAt, '2026-11-10T16:00:00.000Z')
  assert.deepEqual(
    second.files.map((f) => f.name),
    ['v2.txt', 'v2-anexo.txt']
  )
  assert.equal(value(await coursework.task('p-taguirre', task.id)).submission?.files.length, 2)
  assert.deepEqual(await files.read(fileIdOf(first.files[0])), { ok: false, error: 'no-encontrado' })

  // El docente califica: la entrega queda cerrada.
  const stored = value(await store.submission(task.id, 'p-taguirre'))
  assert.ok(stored)
  value(await store.saveSubmission({ ...stored, gradedAt: '2026-11-11T12:00:00.000Z' }))

  assert.deepEqual(await coursework.submit('p-taguirre', task.id, [upload('v3.txt')]), {
    ok: false,
    error: 'ya-calificada'
  })
  const closed = value(await coursework.task('p-taguirre', task.id))
  assert.equal(closed.submission?.graded, true)
  assert.equal(closed.submission?.files.length, 2)
})

test('cada alumno tiene su entrega: lo que entrega uno no lo ve otro', async () => {
  const { coursework, task } = await withTaskInA()
  value(await coursework.submit('p-taguirre', task.id, [upload('mia.txt')]))

  assert.equal(value(await coursework.task('p-lbenitez', task.id)).submission, null)
  assert.equal(value(await coursework.tasksOf('p-lbenitez', 'am1')).tasks[0].submission, null)
  // El docente tampoco tiene «su» entrega.
  assert.equal(value(await coursework.task('p-mledesma', task.id)).submission, null)
})

test('una entrega necesita al menos un archivo, ninguno vacío, hasta diez y no pasar el máximo en total', async () => {
  const { coursework, files, task } = await withTaskInA()
  const max = files.capabilities.maxBytes
  const big = (name: string, bytes: number) => ({ name, contentType: 'application/pdf', bytes: new Uint8Array(bytes) })

  assert.deepEqual(await coursework.submit('p-taguirre', task.id, []), { ok: false, error: 'sin-archivos' })
  assert.deepEqual(await coursework.submit('p-taguirre', task.id, [upload('a.txt'), upload('vacio.txt', '')]), {
    ok: false,
    error: 'archivo-vacio'
  })
  const eleven = Array.from({ length: 11 }, (_, i) => upload(`f${i}.txt`))
  assert.deepEqual(await coursework.submit('p-taguirre', task.id, eleven), { ok: false, error: 'demasiados-archivos' })
  // Cada uno entra, pero juntos pasan el máximo: el pedido entero se corta.
  const tooMuch = [big('a.pdf', max - 10), big('b.pdf', 20)]
  assert.deepEqual(await coursework.submit('p-taguirre', task.id, tooMuch), { ok: false, error: 'demasiado-grande' })
  assert.equal(value(await coursework.task('p-taguirre', task.id)).submission, null)
})

test('si no se puede guardar la entrega, no quedan archivos sueltos y la entrega anterior sigue', async () => {
  const saved: string[] = []
  const deleted: string[] = []
  const { coursework, studies, store, files, task } = await withTaskInA({}, (real) => ({
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
  }))
  const first = value(await coursework.submit('p-taguirre', task.id, [upload('v1.txt')]))
  saved.length = 0
  const { clock } = movableClock(syntheticData.now)
  const broken = createCoursework({
    studies,
    files,
    clock,
    store: { ...store, saveSubmission: async () => fail('falla-externa') }
  })

  const result = await broken.submit('p-taguirre', task.id, [upload('v2.txt'), upload('v2b.txt')])

  assert.deepEqual(result, { ok: false, error: 'falla-externa' })
  assert.equal(saved.length, 2)
  assert.deepEqual(deleted, saved)
  assert.deepEqual(value(await coursework.task('p-taguirre', task.id)).submission, first)
})

test('los archivos de una entrega los baja quien la hizo y el docente de su comisión, y nadie más', async () => {
  const { coursework, task } = await withTaskInA()
  const submission = value(await coursework.submit('p-taguirre', task.id, [upload('mia.txt', 'mi tarea')]))
  const fileId = fileIdOf(submission.files[0])

  const own = value(await coursework.file('p-taguirre', fileId))
  assert.equal(new TextDecoder().decode(own.bytes), 'mi tarea')
  const teacher = value(await coursework.file('p-mledesma', fileId))
  assert.equal(new TextDecoder().decode(teacher.bytes), 'mi tarea')
  // Otro alumno de la comisión, un docente de otra comisión y un alumno de otra comisión no.
  for (const person of ['p-lbenitez', 'p-gferreyra', 'p-mcabrera']) {
    assert.deepEqual(await coursework.file(person, fileId), { ok: false, error: 'sin-acceso' })
  }
})

test('las tareas con fecha del alumno son las de las materias actuales donde cursa, por fecha límite', async () => {
  const { coursework } = build()
  const late = value(
    await coursework.createTask('p-mledesma', taskOf({ name: 'Última', dueAt: '2026-11-27T23:59:00-03:00' }))
  )
  const soon = value(
    await coursework.createTask('p-mledesma', taskOf({ name: 'Primera', dueAt: '2026-11-12T23:59:00-03:00' }))
  )
  value(await coursework.createTask('p-gferreyra', taskOf({ name: 'Solo de la B', sectionIds: [B] })))

  const dated = value(await coursework.dated('p-taguirre'))

  assert.deepEqual(
    dated.map((t) => [t.id, t.name, t.subjectCode, t.past]),
    [
      [soon.id, 'Primera', 'AM1', false],
      [late.id, 'Última', 'AM1', false]
    ]
  )
  assert.deepEqual(value(await coursework.dated('p-mledesma')), [])
  assert.deepEqual(await coursework.dated('p-nadie'), { ok: false, error: 'persona-desconocida' })
})

// --- Quién entregó ----------------------------------------------------------

/** Entre A (Aguirre, Benítez, Escobar): Aguirre entrega a tiempo, Benítez 150 minutos tarde y Escobar no entrega. */
async function withDeliveries() {
  const built = await withTaskInA()
  const { coursework, task, advance } = built
  const onTime = value(await coursework.submit('p-taguirre', task.id, [upload('tp3.txt')]))
  advance(3 * 24 * 60 + 11 * 60 + 59 + 150)
  const late = value(await coursework.submit('p-lbenitez', task.id, [upload('tarde.txt'), upload('anexo.txt')]))
  return { ...built, onTime, late }
}

test('el docente ve todos los alumnos de la comisión: quién entregó, quién no y quién entregó tarde y por cuánto', async () => {
  const { coursework, task, onTime, late } = await withDeliveries()

  const result = value(await coursework.submissions('p-mledesma', task.id, A))

  assert.equal(result.sectionId, A)
  assert.equal(result.task.id, task.id)
  assert.deepEqual(
    result.rows.map((r) => [r.student.name, r.state, r.submission?.id ?? null, r.submission?.late ?? null]),
    [
      ['Aguirre, Tomás', 'entregada', onTime.id, null],
      ['Benítez, Lucía', 'atrasada', late.id, { minutes: 150 }],
      ['Escobar, Joaquín', 'sin-entrega', null, null]
    ]
  )
  assert.deepEqual(result.counts, { onTime: 1, late: 1, missing: 1 })
  assert.equal(result.staleSince, null)
})

test('sin entregas, todos los alumnos de la comisión figuran sin entregar', async () => {
  const { coursework, task } = await withTaskInA()

  const result = value(await coursework.submissions('p-mledesma', task.id, A))

  assert.deepEqual(result.counts, { onTime: 0, late: 0, missing: 3 })
  assert.ok(result.rows.every((r) => r.submission === null))
})

test('si el docente corre la fecha límite, quién está atrasado se recalcula', async () => {
  const { coursework, task } = await withDeliveries()

  value(
    await coursework.updateTask('p-mledesma', task.id, {
      name: task.name,
      instructions: '',
      dueAt: '2026-11-20T23:59:00-03:00'
    })
  )

  const result = value(await coursework.submissions('p-mledesma', task.id, A))
  assert.deepEqual(result.counts, { onTime: 2, late: 0, missing: 1 })
})

test('quién entregó es solo del docente de esa comisión: otro docente, un alumno o una comisión ajena no ven nada', async () => {
  const { coursework, task } = await withDeliveries()

  // Un docente de otra comisión ni siquiera sabe que la tarea existe.
  assert.deepEqual(await coursework.submissions('p-gferreyra', task.id, A), { ok: false, error: 'tarea-desconocida' })
  assert.deepEqual(await coursework.submissions('p-gferreyra', task.id, B), { ok: false, error: 'tarea-desconocida' })
  assert.deepEqual(await coursework.submissions('p-taguirre', task.id, A), { ok: false, error: 'solo-docentes' })
  // La docente de A pide la lista de una comisión que no dicta: aunque la ruta sea suya.
  assert.deepEqual(await coursework.submissions('p-mledesma', task.id, B), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await coursework.submissions('p-mledesma', task.id, 'sec-inventada'), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await coursework.submissions('p-mledesma', 'tarea-inventada', A), {
    ok: false,
    error: 'tarea-desconocida'
  })
  assert.deepEqual(await coursework.submissions('p-nadie', task.id, A), { ok: false, error: 'persona-desconocida' })
})

test('en una tarea de dos comisiones del mismo docente, cada lista trae solo los alumnos de su comisión', async () => {
  const { coursework } = build(withTwoSectionsForOneTeacher())
  const task = value(await coursework.createTask('p-gferreyra', taskOf({ sectionIds: [A, B] })))
  value(await coursework.submit('p-taguirre', task.id, [upload('a.txt')]))
  value(await coursework.submit('p-mcabrera', task.id, [upload('b.txt')]))

  const ofA = value(await coursework.submissions('p-gferreyra', task.id, A))
  const ofB = value(await coursework.submissions('p-gferreyra', task.id, B))

  const names = (r: typeof ofA) => r.rows.map((x) => [x.student.personId, x.state])
  assert.ok(names(ofA).some(([id, state]) => id === 'p-taguirre' && state === 'entregada'))
  assert.ok(!names(ofA).some(([id]) => id === 'p-mcabrera'))
  assert.ok(names(ofB).some(([id, state]) => id === 'p-mcabrera' && state === 'entregada'))
  assert.ok(!names(ofB).some(([id]) => id === 'p-taguirre'))
})

test('el docente abre una entrega y ve de quién es y sus archivos', async () => {
  const { coursework, task, late } = await withDeliveries()

  const detail = value(await coursework.submission('p-mledesma', late.id))

  assert.equal(detail.task.id, task.id)
  assert.equal(detail.sectionId, A)
  assert.equal(detail.student.name, 'Benítez, Lucía')
  assert.equal(detail.student.legajo.length > 0, true)
  assert.deepEqual(detail.submission, late)
  assert.deepEqual(detail.submission.late, { minutes: 150 })
  assert.deepEqual(
    detail.submission.files.map((f) => f.name),
    ['tarde.txt', 'anexo.txt']
  )
  const bytes = value(await coursework.file('p-mledesma', fileIdOf(detail.submission.files[0])))
  assert.equal(new TextDecoder().decode(bytes.bytes), 'contenido de tarde.txt')
})

test('una entrega la abre solo el docente de la comisión del alumno: para los demás no existe', async () => {
  const { coursework, onTime } = await withDeliveries()

  for (const person of ['p-gferreyra', 'p-taguirre', 'p-lbenitez', 'p-mcabrera']) {
    assert.deepEqual(await coursework.submission(person, onTime.id), { ok: false, error: 'entrega-desconocida' })
  }
  assert.deepEqual(await coursework.submission('p-mledesma', 'entrega-inventada'), {
    ok: false,
    error: 'entrega-desconocida'
  })
  assert.deepEqual(await coursework.submission('p-nadie', onTime.id), { ok: false, error: 'persona-desconocida' })
})

test('con el SIU caído, quién entregó sale de la última lectura y avisa desde cuándo', async () => {
  const { coursework, task, siuState } = await withDeliveries()
  value(await coursework.submissions('p-mledesma', task.id, A))

  siuState.down = true

  const result = value(await coursework.submissions('p-mledesma', task.id, A))
  assert.equal(result.rows.length, 3)
  assert.notEqual(result.staleSince, null)
})
