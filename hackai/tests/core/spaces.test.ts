import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { syntheticPdf } from '@/lib/adapters/synthetic-files'
import { createPeople, type PeopleStore } from '@/lib/core/people'
import { type Channel, createSpaces, type SpacesStore, type SpaceView } from '@/lib/core/spaces'
import { createStudies } from '@/lib/core/studies'
import type { ClassroomAnnouncement, ClassroomPort } from '@/lib/ports/classroom'
import type { ClockPort } from '@/lib/ports/clock'
import type { ExternalChannelPort } from '@/lib/ports/external-channel'
import type { FilesPort } from '@/lib/ports/files'
import type { SiuPort } from '@/lib/ports/siu'
import { fail, ok } from '@/lib/result'
import { fallible } from '@/tests/core/helpers'

const NOW = syntheticData.now

/** SIU en memoria que se puede «caer»: con `down`, toda llamada devuelve `falla-externa`. */
function fallibleSiu(siu: SiuPort) {
  const state = { down: false }
  const port = new Proxy(siu, {
    get(target, key) {
      const value = target[key as keyof SiuPort]
      if (typeof value !== 'function') return value
      return (...args: unknown[]) =>
        state.down
          ? Promise.resolve(fail('falla-externa'))
          : (value as (...a: unknown[]) => unknown).apply(target, args)
    }
  })
  return { port, state }
}

// Archivos devuelve la URL de la ruta que los entrega: /archivos/<id>/<nombre>.
function assertFileUrl(url: string | undefined, name: string) {
  assert.match(url ?? '', /^\/archivos\/[0-9a-f-]{36}\/[^/]+$/)
  assert.ok(url?.endsWith(`/${encodeURIComponent(name)}`))
}

/** Copia del set sin avisos ni recursos de Moodle: abrir un espacio no importa nada del aula. */
function withoutMoodleContent(data: SyntheticData): SyntheticData {
  const copy = structuredClone(data)
  copy.moodle.announcements = []
  copy.moodle.contents = []
  return copy
}

/** Por defecto el aula no tiene avisos ni recursos, para que los tests que no son
    de Moodle no cuenten lo que se importa al abrir. Los de Moodle pasan su aula. */
function build(
  data: SyntheticData = syntheticData,
  overrides: {
    store?: SpacesStore
    files?: FilesPort
    classroom?: ClassroomPort
    peopleStore?: PeopleStore
    /** Que el reloj diga que avanza solo, como el del sistema: así `open` mide cada cuánto sincroniza. */
    clockMoves?: boolean
    externalChannel?: ExternalChannelPort
    /** Los milisegundos que espacian las sincronizaciones con el canal externo al abrir un espacio. */
    timer?: () => number
  } = {}
) {
  let now = data.now
  // Reloj que se puede mover, para subir material en distintas semanas.
  const clock: ClockPort = { capabilities: { fixed: !overrides.clockMoves }, now: () => new Date(now) }
  const setNow = (iso: string) => {
    now = iso
  }
  const { port: siu, state: siuState } = fallibleSiu(createMemorySiu(data, clock))
  const classroom = overrides.classroom ?? createMemoryClassroom(withoutMoodleContent(data))
  const peopleStore = overrides.peopleStore ?? createMemoryPeopleStore(data)
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: peopleStore })
  const studies = createStudies({ people, siu, classroom, clock })
  const store = overrides.store ?? createMemorySpacesStore()
  const files: FilesPort = overrides.files ?? createMemoryFiles()
  const spaces = createSpaces({
    people,
    studies,
    externalChannel: overrides.externalChannel ?? createMemoryExternalChannel(data, clock),
    classroom,
    files,
    clock,
    store,
    // Sin temporizador propio no avanza: cada espacio se sincroniza una vez al abrirlo.
    timer: overrides.timer ?? (() => 0)
  })
  return { spaces, studies, store, files, siuState, setNow }
}

/** Copia del set sintético con una inscripción a cursada de más. */
function withEnrollment(personSiuId: string, sectionId: string): SyntheticData {
  const data = structuredClone(syntheticData)
  data.siu.courseEnrollments.push({
    id: 'ic-extra',
    transactionNumber: 'T-999999',
    personId: personSiuId,
    sectionId,
    date: data.siu.courseEnrollments[0].date,
    status: 'aceptada'
  })
  return data
}

/** Los canales como se muestran: `#avisos (A)`, `#material`. */
const labels = (channels: Channel[]) =>
  channels.map((c) => (c.sectionName ? `#${c.name} (${c.sectionName})` : `#${c.name}`))

const named = (view: SpaceView, name: string, sectionName: string | null = null) => {
  const found = view.channels.find((c) => c.name === name && c.sectionName === sectionName)
  assert.ok(found, `no está #${name} (${sectionName})`)
  return found
}

test('la primera vez que un alumno abre la materia se crea el espacio con el material y los canales de su comisión', async () => {
  const { spaces } = build()

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  const view = opened.value
  assert.deepEqual(
    { ...view.space, id: undefined },
    { id: undefined, subjectId: 'am1', subjectCode: 'AM1', schoolId: 'fi', name: 'Análisis Matemático I' }
  )
  assert.deepEqual(labels(view.channels), ['#avisos (A)', '#consultas (A)', '#material'])
  assert.equal(view.staleSince, null)
  assert.deepEqual(view.material, { layout: 'unidad', sections: [], sectionNames: [], recent: [] })
  assert.deepEqual(named(view, 'material'), {
    ...named(view, 'material'),
    kind: 'material',
    scope: { kind: 'materia' },
    sectionName: null,
    unread: 0,
    canPost: false,
    canResolve: false,
    externalLink: null
  })
  assert.equal(named(view, 'avisos', 'A').kind, 'avisos')
  assert.equal(named(view, 'consultas', 'A').kind, 'consultas')
})

test('las dos comisiones de la materia comparten el espacio y la otra facultad tiene el suyo', async () => {
  const { spaces } = build()

  const a = await spaces.open('p-taguirre', 'am1')
  const b = await spaces.open('p-mcabrera', 'am1')
  const fce = await spaces.open('p-agimenez', 'am1')

  assert.ok(a.ok && b.ok && fce.ok)
  assert.equal(a.value.space.id, b.value.space.id)
  assert.notEqual(fce.value.space.id, a.value.space.id)
  assert.equal(fce.value.space.schoolId, 'fce')
  assert.equal(named(a.value, 'material').id, named(b.value, 'material').id)
  assert.deepEqual(labels(b.value.channels), ['#avisos (B)', '#consultas (B)', '#material'])
})

test('abrir de nuevo no duplica los canales', async () => {
  const { spaces, store } = build()

  await spaces.open('p-taguirre', 'am1')
  const again = await spaces.open('p-lbenitez', 'am1')

  assert.ok(again.ok)
  const all = await store.channels([again.value.space.id])
  assert.ok(all.ok)
  assert.deepEqual(
    all.value.map((c) => c.name),
    ['material', 'avisos', 'consultas']
  )
})

test('quien no cursa ni dicta la materia no entra', async () => {
  const { spaces } = build()

  assert.deepEqual(await spaces.open('p-fjuarez', 'am1'), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.open('p-darrieta', 'am1'), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.open('p-nadie', 'am1'), { ok: false, error: 'persona-desconocida' })
})

test('quien se inscribe ya está adentro, con su comisión', async () => {
  // Joaquín cursa la A; con una inscripción nueva en la B, ve los canales de las dos.
  const { spaces } = build(withEnrollment('30105', 'sec-am1-fi-b'))

  const opened = await spaces.open('p-jescobar', 'am1')

  assert.ok(opened.ok)
  assert.deepEqual(labels(opened.value.channels), [
    '#avisos (A)',
    '#consultas (A)',
    '#avisos (B)',
    '#consultas (B)',
    '#material'
  ])
  assert.deepEqual(
    opened.value.viewer.sections.map((s) => s.name),
    ['A', 'B']
  )
})

test('el docente ve sus comisiones con sus docentes y puede gestionar el espacio', async () => {
  const { spaces } = build()

  const opened = await spaces.open('p-mledesma', 'am1')

  assert.ok(opened.ok)
  assert.deepEqual(opened.value.viewer, {
    personId: 'p-mledesma',
    role: 'profesor',
    sections: [
      {
        sectionId: 'sec-am1-fi-a',
        name: 'A',
        termName: 'Grado 2do Cuatrimestre 2026',
        current: true,
        teachers: [{ personId: 'p-mledesma', name: 'Mariana Ledesma' }]
      }
    ],
    canManage: true,
    directContacts: []
  })
  const student = await spaces.open('p-taguirre', 'am1')
  assert.ok(student.ok)
  assert.equal(student.value.viewer.canManage, false)
})

test('una materia archivada se sigue abriendo', async () => {
  const { spaces } = build()

  const opened = await spaces.open('p-vfunes', 'aga')

  assert.ok(opened.ok)
  assert.deepEqual(
    opened.value.viewer.sections.map((s) => [s.name, s.current]),
    [['A', false]]
  )
  // El alumno conserva el acceso a los canales y al material.
  const seen = await spaces.channel('p-vfunes', named(opened.value, 'material').id)
  assert.ok(seen.ok)
  const asked = await spaces.post('p-vfunes', named(opened.value, 'consultas', 'A').id, {
    text: '¿Cuándo es el final?'
  })
  assert.ok(asked.ok)
})

test('quien dictó la materia en un cuatrimestre que terminó la ve y la atiende, pero no la gestiona', async () => {
  const { spaces } = build()

  // Mariana Ledesma dictó Álgebra en el 1er cuatrimestre: su comisión está archivada.
  const opened = await spaces.open('p-mledesma', 'aga')
  assert.ok(opened.ok)
  assert.equal(opened.value.viewer.canManage, false)

  const space = opened.value.space.id
  const pdf = { name: 'final.pdf', contentType: 'application/pdf', bytes: new Uint8Array([1]) }
  assert.deepEqual(await spaces.addMaterial('p-mledesma', space, pdf), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await spaces.organizeMaterial('p-mledesma', space, 'semana'), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await spaces.createChannel('p-mledesma', space, { name: 'finales', scope: { kind: 'materia' } }), {
    ok: false,
    error: 'solo-docentes'
  })

  // Sigue siendo la docente de su comisión: publica avisos y resuelve consultas.
  const avisos = named(opened.value, 'avisos', 'A')
  assert.equal(avisos.canPost, true)
  assert.equal((await spaces.post('p-mledesma', avisos.id, { text: 'La mesa de diciembre es el 9.' })).ok, true)
  const asked = await spaces.post('p-vfunes', named(opened.value, 'consultas', 'A').id, { text: '¿Entra todo?' })
  assert.ok(asked.ok)
  assert.equal((await spaces.resolve('p-mledesma', asked.value.id)).ok, true)
})

test('si el SIU no responde, la membresía sale de la última lectura y se marca desactualizada', async () => {
  const { spaces, siuState } = build()

  siuState.down = true
  assert.deepEqual(await spaces.open('p-taguirre', 'am1'), { ok: false, error: 'falla-externa' })

  siuState.down = false
  await spaces.open('p-taguirre', 'am1')
  siuState.down = true
  const stale = await spaces.open('p-taguirre', 'am1')

  assert.ok(stale.ok)
  assert.equal(stale.value.staleSince, NOW)
})

/** Abre el espacio de AM1 de Ingeniería con un docente de cada comisión y devuelve sus canales. */
async function am1(spaces: ReturnType<typeof build>['spaces']) {
  const a = await spaces.open('p-mledesma', 'am1')
  const b = await spaces.open('p-gferreyra', 'am1')
  assert.ok(a.ok && b.ok)
  return {
    spaceId: a.value.space.id,
    material: named(a.value, 'material').id,
    avisosA: named(a.value, 'avisos', 'A').id,
    consultasA: named(a.value, 'consultas', 'A').id,
    avisosB: named(b.value, 'avisos', 'B').id,
    consultasB: named(b.value, 'consultas', 'B').id
  }
}

test('un alumno de la comisión A no ve #consultas de la B', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const opened = await spaces.open('p-taguirre', 'am1')
  assert.ok(opened.ok)
  assert.equal(
    opened.value.channels.some((c) => c.id === ids.consultasB || c.id === ids.avisosB),
    false
  )
  assert.deepEqual(await spaces.channel('p-taguirre', ids.consultasB), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.post('p-taguirre', ids.consultasB, { text: '¿Entra integrales?' }), {
    ok: false,
    error: 'sin-acceso'
  })
  // Tampoco el docente de la A ve los de la B.
  assert.deepEqual(await spaces.channel('p-mledesma', ids.consultasB), { ok: false, error: 'sin-acceso' })
  // Ni alguien de la otra facultad ve el material de esta.
  assert.deepEqual(await spaces.channel('p-agimenez', ids.material), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.channel('p-taguirre', 'ch-nada'), { ok: false, error: 'canal-desconocido' })
})

test('en #avisos escribe solo el docente de la comisión; cualquier otro recibe un error de permiso', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const posted = await spaces.post('p-mledesma', ids.avisosA, { text: 'El jueves no hay clase.' })
  assert.ok(posted.ok)
  assert.deepEqual(
    { ...posted.value, id: undefined },
    {
      id: undefined,
      channelId: ids.avisosA,
      author: { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' },
      text: 'El jueves no hay clase.',
      attachments: [],
      origin: 'hackai',
      externalId: null,
      status: 'publicado',
      replyTo: null,
      question: null,
      unread: false,
      createdAt: NOW
    }
  )
  assert.deepEqual(await spaces.post('p-taguirre', ids.avisosA, { text: 'Gracias' }), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.deepEqual(await spaces.post('p-gferreyra', ids.avisosA, { text: 'Hola' }), { ok: false, error: 'sin-acceso' })

  const asStudent = await spaces.open('p-taguirre', 'am1')
  const asTeacher = await spaces.open('p-mledesma', 'am1')
  assert.ok(asStudent.ok && asTeacher.ok)
  assert.equal(named(asStudent.value, 'avisos', 'A').canPost, false)
  assert.equal(named(asStudent.value, 'consultas', 'A').canPost, true)
  assert.equal(named(asTeacher.value, 'avisos', 'A').canPost, true)
})

test('en el material no se publican mensajes y un mensaje vacío no se publica', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  assert.deepEqual(await spaces.post('p-mledesma', ids.material, { text: 'Hola' }), {
    ok: false,
    error: 'sin-mensajes'
  })
  assert.deepEqual(await spaces.post('p-taguirre', ids.consultasA, { text: '   ' }), {
    ok: false,
    error: 'mensaje-vacio'
  })
  assert.deepEqual(await spaces.post('p-taguirre', 'ch-nada', { text: 'Hola' }), {
    ok: false,
    error: 'canal-desconocido'
  })
})

test('las consultas tienen sus respuestas en un hilo que ve toda la comisión', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const question = await spaces.post('p-taguirre', ids.consultasA, { text: '¿El parcial incluye límites?' })
  assert.ok(question.ok)
  assert.deepEqual(question.value.question, { resolved: false })
  const answer = await spaces.post('p-mledesma', ids.consultasA, { text: 'Sí, todo.', replyTo: question.value.id })
  assert.ok(answer.ok)
  assert.equal(answer.value.question, null)
  // Responder a una respuesta cuelga el mensaje de la raíz del hilo.
  const thanks = await spaces.post('p-lbenitez', ids.consultasA, { text: 'Gracias!', replyTo: answer.value.id })
  assert.ok(thanks.ok)
  assert.equal(thanks.value.replyTo, question.value.id)
  const other = await spaces.post('p-jescobar', ids.consultasA, { text: '¿Y derivadas?' })
  assert.ok(other.ok)

  const seen = await spaces.channel('p-lbenitez', ids.consultasA)
  assert.ok(seen.ok)
  assert.equal(seen.value.material, null)
  assert.deepEqual(
    seen.value.threads.map((t) => [t.message.text, t.replies.map((r) => `${r.author.name}: ${r.text}`)]),
    [
      ['¿El parcial incluye límites?', ['Mariana Ledesma: Sí, todo.', 'Lucía Benítez: Gracias!']],
      ['¿Y derivadas?', []]
    ]
  )
  assert.deepEqual(await spaces.post('p-taguirre', ids.consultasA, { text: 'Hola', replyTo: 'm-nada' }), {
    ok: false,
    error: 'mensaje-desconocido'
  })
  const notice = await spaces.post('p-mledesma', ids.avisosA, { text: 'Aviso' })
  assert.ok(notice.ok)
  assert.deepEqual(await spaces.post('p-taguirre', ids.consultasA, { text: 'Hola', replyTo: notice.value.id }), {
    ok: false,
    error: 'mensaje-desconocido'
  })
})

test('los adjuntos se guardan con Archivos y si uno falla no se publica nada', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const posted = await spaces.post('p-taguirre', ids.consultasA, {
    text: '',
    attachments: [{ name: 'ejercicio.png', contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }]
  })
  assert.ok(posted.ok)
  assert.deepEqual(
    posted.value.attachments.map((attachment) => ({ ...attachment, url: undefined })),
    [{ name: 'ejercicio.png', contentType: 'image/png', size: 3, url: undefined }]
  )
  assertFileUrl(posted.value.attachments[0]?.url, 'ejercicio.png')

  const tooBig = await spaces.post('p-taguirre', ids.consultasA, {
    text: 'Con todo',
    attachments: [
      { name: 'chico.txt', contentType: 'text/plain', bytes: new Uint8Array([1]) },
      { name: 'enorme.pdf', contentType: 'application/pdf', bytes: new Uint8Array(11 * 1024 * 1024) }
    ]
  })
  assert.deepEqual(tooBig, { ok: false, error: 'demasiado-grande' })
  const seen = await spaces.channel('p-taguirre', ids.consultasA)
  assert.ok(seen.ok)
  assert.equal(seen.value.threads.length, 1)
})

/** El id del archivo que lleva su URL: `/archivos/<id>/<nombre>`. */
const fileIdOf = (url: string | undefined) => url?.split('/')[2] ?? ''

test('el material de la materia lo bajan las dos comisiones, pero no alguien de otra facultad', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const bytes = new Uint8Array([37, 80, 68, 70])
  const added = await spaces.addMaterial('p-mledesma', ids.spaceId, {
    name: 'Guía 4.pdf',
    contentType: 'application/pdf',
    bytes
  })
  assert.ok(added.ok)
  const fileId = fileIdOf(added.value.url)

  for (const personId of ['p-taguirre', 'p-mcabrera', 'p-gferreyra']) {
    const file = await spaces.file(personId, fileId)
    assert.ok(file.ok, personId)
    assert.equal(file.value.contentType, 'application/pdf')
    assert.deepEqual(file.value.bytes, bytes)
  }
  assert.deepEqual(await spaces.file('p-agimenez', fileId), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.file('p-fjuarez', fileId), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.file('p-nadie', fileId), { ok: false, error: 'persona-desconocida' })
})

test('un adjunto de #consultas de la A lo baja la A, pero no la B', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const bytes = new Uint8Array([1, 2, 3])
  const posted = await spaces.post('p-taguirre', ids.consultasA, {
    text: '¿Está bien este?',
    attachments: [{ name: 'ejercicio.png', contentType: 'image/png', bytes }]
  })
  assert.ok(posted.ok)
  const fileId = fileIdOf(posted.value.attachments[0]?.url)

  for (const personId of ['p-lbenitez', 'p-mledesma']) {
    const file = await spaces.file(personId, fileId)
    assert.ok(file.ok, personId)
    assert.equal(file.value.contentType, 'image/png')
    assert.deepEqual(file.value.bytes, bytes)
  }
  assert.deepEqual(await spaces.file('p-mcabrera', fileId), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.file('p-gferreyra', fileId), { ok: false, error: 'sin-acceso' })
})

test('un archivo que no es de ningún material ni adjunto no se entrega a nadie', async () => {
  const { spaces, files } = build()
  await am1(spaces)
  // Guardado en Archivos, pero de ningún espacio.
  const loose = await files.save({ name: 'suelto.txt', contentType: 'text/plain', bytes: new Uint8Array([1]) })
  assert.ok(loose.ok)

  for (const fileId of [loose.value.id, randomUUID(), 'no-es-un-id', '../../secreto']) {
    assert.deepEqual(await spaces.file('p-taguirre', fileId), { ok: false, error: 'archivo-desconocido' }, fileId)
  }
})

/** Los no leídos de cada canal que la persona ve: `{ 'avisos (A)': 1, material: 0 }`. */
async function unreadOf(spaces: ReturnType<typeof build>['spaces'], personId: string, subjectId = 'am1') {
  const opened = await spaces.open(personId, subjectId)
  assert.ok(opened.ok)
  return Object.fromEntries(
    opened.value.channels.map((c) => [c.sectionName ? `${c.name} (${c.sectionName})` : c.name, c.unread])
  )
}

test('cada persona ve qué no leyó en cada canal', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  await spaces.post('p-mledesma', ids.avisosA, { text: 'El jueves no hay clase.' })
  await spaces.post('p-mledesma', ids.avisosA, { text: 'Subí la guía 4.' })
  const question = await spaces.post('p-lbenitez', ids.consultasA, { text: '¿Entra límites?' })
  assert.ok(question.ok)
  await spaces.post('p-gferreyra', ids.avisosB, { text: 'Aviso de la B' })

  assert.deepEqual(await unreadOf(spaces, 'p-taguirre'), { 'avisos (A)': 2, 'consultas (A)': 1, material: 0 })
  // Lo propio nunca está sin leer.
  assert.deepEqual(await unreadOf(spaces, 'p-lbenitez'), { 'avisos (A)': 2, 'consultas (A)': 0, material: 0 })
  assert.deepEqual(await unreadOf(spaces, 'p-mledesma'), { 'avisos (A)': 0, 'consultas (A)': 1, material: 0 })
  assert.deepEqual(await unreadOf(spaces, 'p-mcabrera'), { 'avisos (B)': 1, 'consultas (B)': 0, material: 0 })

  // Abrir el canal muestra qué era nuevo y lo marca leído.
  const seen = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(seen.ok)
  assert.equal(seen.value.channel.unread, 0)
  assert.deepEqual(
    seen.value.threads.map((t) => t.message.unread),
    [true, true]
  )
  assert.deepEqual(await unreadOf(spaces, 'p-taguirre'), { 'avisos (A)': 0, 'consultas (A)': 1, material: 0 })

  await spaces.post('p-mledesma', ids.avisosA, { text: 'Parcial el 16.' })
  const again = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(again.ok)
  assert.deepEqual(
    again.value.threads.map((t) => t.message.unread),
    [false, false, true]
  )

  // Responder marca leído el canal hasta la respuesta.
  await spaces.post('p-taguirre', ids.consultasA, { text: 'Yo también quiero saber', replyTo: question.value.id })
  assert.deepEqual(await unreadOf(spaces, 'p-taguirre'), { 'avisos (A)': 0, 'consultas (A)': 0, material: 0 })
})

test('el docente de la comisión marca resuelta una consulta y todos la ven resuelta', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const question = await spaces.post('p-taguirre', ids.consultasA, { text: '¿Entra límites?' })
  const answer = await spaces.post('p-mledesma', ids.consultasA, {
    text: 'Sí.',
    replyTo: question.ok ? question.value.id : ''
  })
  assert.ok(question.ok && answer.ok)

  assert.deepEqual(await spaces.resolve('p-taguirre', question.value.id), { ok: false, error: 'solo-docentes' })
  assert.deepEqual(await spaces.resolve('p-gferreyra', question.value.id), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.resolve('p-mledesma', answer.value.id), { ok: false, error: 'no-es-consulta' })
  assert.deepEqual(await spaces.resolve('p-mledesma', 'm-nada'), { ok: false, error: 'mensaje-desconocido' })

  const resolved = await spaces.resolve('p-mledesma', question.value.id)
  assert.ok(resolved.ok)
  assert.deepEqual(resolved.value.question, { resolved: true })
  assert.equal(resolved.value.author.name, 'Tomás Aguirre')
  // Es idempotente.
  const twice = await spaces.resolve('p-mledesma', question.value.id)
  assert.ok(twice.ok)
  assert.deepEqual(twice.value.question, { resolved: true })

  const seen = await spaces.channel('p-lbenitez', ids.consultasA)
  assert.ok(seen.ok)
  assert.deepEqual(seen.value.threads[0].message.question, { resolved: true })

  const asStudent = await spaces.open('p-taguirre', 'am1')
  const asTeacher = await spaces.open('p-mledesma', 'am1')
  assert.ok(asStudent.ok && asTeacher.ok)
  assert.equal(named(asStudent.value, 'consultas', 'A').canResolve, false)
  assert.equal(named(asTeacher.value, 'consultas', 'A').canResolve, true)
})

test('el docente crea un canal de la materia, que ven todos, o de su comisión, que ve solo ella', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const forSubject = await spaces.createChannel('p-mledesma', ids.spaceId, {
    name: ' #Parciales   Viejos ',
    scope: { kind: 'materia' }
  })
  assert.ok(forSubject.ok)
  assert.deepEqual(
    { ...forSubject.value, id: undefined },
    {
      id: undefined,
      spaceId: ids.spaceId,
      name: 'parciales-viejos',
      kind: 'libre',
      scope: { kind: 'materia' },
      sectionName: null,
      unread: 0,
      canPost: true,
      canResolve: true,
      canLink: true,
      externalLink: null,
      counterpart: null
    }
  )
  const forSection = await spaces.createChannel('p-mledesma', ids.spaceId, {
    name: 'Grupo TP',
    scope: { kind: 'comision', sectionId: 'sec-am1-fi-a' }
  })
  assert.ok(forSection.ok)
  assert.equal(forSection.value.sectionName, 'A')

  const a = await spaces.open('p-taguirre', 'am1')
  const b = await spaces.open('p-mcabrera', 'am1')
  assert.ok(a.ok && b.ok)
  assert.deepEqual(labels(a.value.channels), [
    '#avisos (A)',
    '#consultas (A)',
    '#material',
    '#parciales-viejos',
    '#grupo-tp (A)'
  ])
  assert.deepEqual(labels(b.value.channels), ['#avisos (B)', '#consultas (B)', '#material', '#parciales-viejos'])
  assert.deepEqual(await spaces.channel('p-mcabrera', forSection.value.id), { ok: false, error: 'sin-acceso' })
  // En los canales libres escribe cualquiera que los ve.
  const posted = await spaces.post('p-mcabrera', forSubject.value.id, { text: '¿Alguien tiene el de 2025?' })
  assert.ok(posted.ok)
  assert.equal(posted.value.question, null)
})

test('solo los docentes crean canales: de la materia, o de una comisión que dictan', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const fce = await spaces.open('p-cbustos', 'am1')
  assert.ok(fce.ok)
  const materia = { kind: 'materia' } as const

  assert.deepEqual(await spaces.createChannel('p-taguirre', ids.spaceId, { name: 'charla', scope: materia }), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.deepEqual(
    await spaces.createChannel('p-mledesma', ids.spaceId, {
      name: 'charla',
      scope: { kind: 'comision', sectionId: 'sec-am1-fi-b' }
    }),
    { ok: false, error: 'solo-docentes' }
  )
  assert.deepEqual(await spaces.createChannel('p-mledesma', fce.value.space.id, { name: 'charla', scope: materia }), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await spaces.createChannel('p-mledesma', 'sp-nada', { name: 'charla', scope: materia }), {
    ok: false,
    error: 'espacio-desconocido'
  })
})

test('el nombre de un canal nuevo se normaliza y no puede repetir uno que vean los mismos miembros', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const materia = { kind: 'materia' } as const
  const sectionA = { kind: 'comision', sectionId: 'sec-am1-fi-a' } as const
  const sectionB = { kind: 'comision', sectionId: 'sec-am1-fi-b' } as const
  const create = async (personId: string, name: string, scope: typeof materia | typeof sectionA | typeof sectionB) => {
    const created = await spaces.createChannel(personId, ids.spaceId, { name, scope })
    return created.ok ? created.value.name : created.error
  }

  assert.equal(await create('p-mledesma', 'Ñandú   Álgebra!!--2_bis', materia), 'ñandú-álgebra-2_bis')
  assert.equal(await create('p-mledesma', `${'a'.repeat(39)} b`, materia), 'a'.repeat(39))
  assert.equal(await create('p-mledesma', ' # !! ', materia), 'nombre-invalido')

  // Uno de la materia choca con cualquier canal del espacio.
  assert.equal(await create('p-mledesma', 'Avisos', materia), 'nombre-repetido')
  assert.equal(await create('p-mledesma', 'ñandú-álgebra-2_bis', materia), 'nombre-repetido')
  // Uno de comisión choca con los de la materia y los de esa comisión, no con los de otra.
  assert.equal(await create('p-mledesma', 'grupo', sectionA), 'grupo')
  assert.equal(await create('p-gferreyra', 'grupo', sectionB), 'grupo')
  assert.equal(await create('p-gferreyra', 'consultas', sectionB), 'nombre-repetido')
  assert.equal(await create('p-gferreyra', 'Ñandú álgebra 2_bis', sectionB), 'nombre-repetido')
  assert.equal(await create('p-gferreyra', 'grupo', materia), 'nombre-repetido')
})

test('un nombre con espacios, mayúsculas o tildes se normaliza en vez de dar error', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const create = async (name: string) => {
    const created = await spaces.createChannel('p-mledesma', ids.spaceId, { name, scope: { kind: 'materia' } })
    return created.ok ? created.value.name : created.error
  }

  assert.equal(await create('Parciales Viejos'), 'parciales-viejos')
  assert.equal(await create('  #TP 1  '), 'tp-1')
  assert.equal(await create('ÑANDÚ'), 'ñandú')
  // Lo que se pega de un PDF o escribe un teclado de Mac puede traer la tilde aparte de la letra.
  assert.equal(await create('Álgebra 2'), 'álgebra-2')
  assert.equal(await create('álgebra 2'), 'nombre-repetido')
})

const pdf = (name: string, section: string | null = null) => ({
  name,
  contentType: 'application/pdf',
  bytes: new Uint8Array([1, 2]),
  section
})

test('el docente sube material, que se guarda con Archivos y aparece con su origen y sin ver para los alumnos', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  const added = await spaces.addMaterial('p-mledesma', ids.spaceId, pdf('Guía 4.pdf', '  Unidad 2 '))
  assert.ok(added.ok)
  assert.deepEqual(
    { ...added.value, id: undefined, url: undefined },
    {
      id: undefined,
      name: 'Guía 4.pdf',
      url: undefined,
      contentType: 'application/pdf',
      size: 2,
      origin: 'hackai',
      section: 'Unidad 2',
      addedBy: { personId: 'p-mledesma', name: 'Mariana Ledesma' },
      addedAt: NOW,
      unread: false
    }
  )
  assertFileUrl(added.value.url, 'Guía 4.pdf')

  // Lo ven las dos comisiones; el docente de la B también sube.
  const fromB = await spaces.addMaterial('p-gferreyra', ids.spaceId, pdf('Resumen.pdf'))
  assert.ok(fromB.ok)
  assert.deepEqual(await unreadOf(spaces, 'p-taguirre'), { 'avisos (A)': 0, 'consultas (A)': 0, material: 2 })
  assert.deepEqual(await unreadOf(spaces, 'p-mledesma'), { 'avisos (A)': 0, 'consultas (A)': 0, material: 1 })
  const opened = await spaces.open('p-mcabrera', 'am1')
  assert.ok(opened.ok)
  assert.deepEqual(
    opened.value.material.recent.map((m) => [m.name, m.origin, m.unread]),
    [
      ['Resumen.pdf', 'hackai', true],
      ['Guía 4.pdf', 'hackai', true]
    ]
  )

  // Abrir el canal de material muestra qué era nuevo y lo marca visto.
  const seen = await spaces.channel('p-mcabrera', ids.material)
  assert.ok(seen.ok)
  assert.deepEqual(seen.value.threads, [])
  assert.equal(seen.value.channel.unread, 0)
  assert.deepEqual(
    seen.value.material?.recent.map((m) => m.unread),
    [true, true]
  )
  const again = await spaces.open('p-mcabrera', 'am1')
  assert.ok(again.ok)
  assert.equal(named(again.value, 'material').unread, 0)
  assert.deepEqual(
    again.value.material.recent.map((m) => m.unread),
    [false, false]
  )
})

test('solo los docentes de la materia suben material y un archivo vacío o enorme no entra', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  assert.deepEqual(await spaces.addMaterial('p-taguirre', ids.spaceId, pdf('Mío.pdf')), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.deepEqual(await spaces.addMaterial('p-cbustos', ids.spaceId, pdf('Otro.pdf')), {
    ok: false,
    error: 'sin-acceso'
  })
  assert.deepEqual(await spaces.addMaterial('p-mledesma', 'sp-nada', pdf('Otro.pdf')), {
    ok: false,
    error: 'espacio-desconocido'
  })
  assert.deepEqual(
    await spaces.addMaterial('p-mledesma', ids.spaceId, { ...pdf('Vacío.pdf'), bytes: new Uint8Array() }),
    { ok: false, error: 'archivo-vacio' }
  )
  assert.deepEqual(
    await spaces.addMaterial('p-mledesma', ids.spaceId, {
      ...pdf('Enorme.pdf'),
      bytes: new Uint8Array(11 * 1024 * 1024)
    }),
    { ok: false, error: 'demasiado-grande' }
  )
})

test('el material se muestra por unidad, por semana o todo junto, como lo organice el docente', async () => {
  const { spaces, setNow } = build()
  const ids = await am1(spaces)
  const upload = async (iso: string, name: string, section: string | null = null) => {
    setNow(iso)
    const added = await spaces.addMaterial('p-mledesma', ids.spaceId, pdf(name, section))
    assert.ok(added.ok)
  }
  // Lunes 2/11, domingo 15/11 a la noche (lunes en UTC), lunes 16/11 y martes 10/11, hora de Buenos Aires.
  await upload('2026-11-02T13:00:00.000Z', 'Programa.pdf', 'Unidad 10')
  await upload('2026-11-16T02:30:00.000Z', 'Guía 2.pdf', 'Unidad 2')
  await upload('2026-11-16T03:10:00.000Z', 'Guía 3.pdf')
  await upload('2026-11-10T15:00:00.000Z', 'Guía 1.pdf', 'Unidad 2')
  const sections = (view: { sections: { title: string; items: { name: string }[] }[] }) =>
    view.sections.map((s) => [s.title, s.items.map((i) => i.name)])

  const opened = await spaces.open('p-taguirre', 'am1')
  assert.ok(opened.ok)
  assert.equal(opened.value.material.layout, 'unidad')
  assert.deepEqual(sections(opened.value.material), [
    ['Unidad 2', ['Guía 1.pdf', 'Guía 2.pdf']],
    ['Unidad 10', ['Programa.pdf']],
    ['Sin unidad', ['Guía 3.pdf']]
  ])
  assert.deepEqual(opened.value.material.sectionNames, ['Unidad 2', 'Unidad 10'])
  assert.deepEqual(
    opened.value.material.recent.map((m) => m.name),
    ['Guía 1.pdf', 'Guía 3.pdf', 'Guía 2.pdf']
  )

  const byWeek = await spaces.organizeMaterial('p-mledesma', ids.spaceId, 'semana')
  assert.ok(byWeek.ok)
  assert.deepEqual(sections(byWeek.value), [
    ['Semana del 16 de noviembre', ['Guía 3.pdf']],
    ['Semana del 9 de noviembre', ['Guía 1.pdf', 'Guía 2.pdf']],
    ['Semana del 2 de noviembre', ['Programa.pdf']]
  ])
  const all = await spaces.organizeMaterial('p-gferreyra', ids.spaceId, 'todo')
  assert.ok(all.ok)
  assert.deepEqual(sections(all.value), [
    ['Todo el material', ['Guía 1.pdf', 'Guía 3.pdf', 'Guía 2.pdf', 'Programa.pdf']]
  ])
  const reopened = await spaces.open('p-mcabrera', 'am1')
  assert.ok(reopened.ok)
  assert.equal(reopened.value.material.layout, 'todo')

  assert.deepEqual(await spaces.organizeMaterial('p-taguirre', ids.spaceId, 'semana'), {
    ok: false,
    error: 'solo-docentes'
  })
  assert.deepEqual(await spaces.organizeMaterial('p-mledesma', 'sp-nada', 'semana'), {
    ok: false,
    error: 'espacio-desconocido'
  })
})

test('las novedades sin leer de todos sus espacios, la más nueva primero', async () => {
  const { spaces, store, setNow, siuState } = build()

  // Sin espacios abiertos no hay novedades, y pedirlas no crea ninguno.
  assert.deepEqual(await spaces.unreadFor('p-taguirre'), { ok: true, value: [] })
  const none = await store.spacesFor([{ subjectId: 'am1', schoolId: 'fi' }])
  assert.deepEqual(none, { ok: true, value: [] })

  const ids = await am1(spaces)
  const pr1 = await spaces.open('p-darrieta', 'pr1')
  const aga = await spaces.open('p-mledesma', 'aga')
  assert.ok(pr1.ok && aga.ok)
  setNow('2026-11-09T12:00:00.000Z')
  await spaces.post('p-mledesma', ids.avisosA, { text: 'El jueves no hay clase.' })
  setNow('2026-11-09T13:00:00.000Z')
  await spaces.post('p-mledesma', ids.avisosA, { text: 'Parcial el 16.' })
  await spaces.post('p-taguirre', ids.consultasA, { text: 'Lo mío no cuenta' })
  setNow('2026-11-09T14:00:00.000Z')
  await spaces.post('p-lbenitez', ids.consultasA, { text: '¿Entra límites?' })
  setNow('2026-11-10T09:00:00.000Z')
  await spaces.addMaterial('p-mledesma', ids.spaceId, pdf('Guía 4.pdf'))
  await spaces.post('p-darrieta', named(pr1.value, 'avisos', 'A').id, { text: 'Entrega del TP el viernes.' })
  // Álgebra está archivada: sus novedades no cuentan.
  await spaces.post('p-mledesma', named(aga.value, 'avisos', 'A').id, { text: 'Notas finales cargadas.' })

  const unread = await spaces.unreadFor('p-taguirre')

  assert.ok(unread.ok)
  assert.deepEqual(
    unread.value.map((u) => [
      u.subjectName,
      u.channelName,
      u.kind,
      u.count,
      { text: u.latest.text, origin: u.latest.origin, createdAt: u.latest.createdAt }
    ]),
    [
      [
        'Análisis Matemático I',
        'material',
        'material',
        1,
        { text: 'Guía 4.pdf', origin: 'hackai', createdAt: '2026-11-10T09:00:00.000Z' }
      ],
      [
        'Programación I',
        'avisos',
        'avisos',
        1,
        { text: 'Entrega del TP el viernes.', origin: 'hackai', createdAt: '2026-11-10T09:00:00.000Z' }
      ],
      [
        'Análisis Matemático I',
        'consultas',
        'consultas',
        1,
        { text: '¿Entra límites?', origin: 'hackai', createdAt: '2026-11-09T14:00:00.000Z' }
      ],
      [
        'Análisis Matemático I',
        'avisos',
        'avisos',
        2,
        { text: 'Parcial el 16.', origin: 'hackai', createdAt: '2026-11-09T13:00:00.000Z' }
      ]
    ]
  )
  assert.deepEqual(
    { ...unread.value[3], latest: undefined },
    {
      spaceId: ids.spaceId,
      subjectId: 'am1',
      subjectName: 'Análisis Matemático I',
      channelId: ids.avisosA,
      channelName: 'avisos',
      kind: 'avisos',
      sectionId: 'sec-am1-fi-a',
      count: 2,
      latest: undefined,
      counterpart: null,
      thread: null
    }
  )

  // Leer un canal lo saca de las novedades.
  await spaces.channel('p-taguirre', ids.avisosA)
  const after = await spaces.unreadFor('p-taguirre')
  assert.ok(after.ok)
  assert.equal(
    after.value.some((u) => u.channelId === ids.avisosA),
    false
  )

  assert.deepEqual(await spaces.unreadFor('p-nadie'), { ok: false, error: 'persona-desconocida' })
  siuState.down = true
  assert.deepEqual(await spaces.unreadFor('p-jescobar'), { ok: false, error: 'falla-externa' })
})

test('cada novedad dice quién la publicó, y un mensaje con solo un adjunto se muestra con el nombre del archivo', async () => {
  const { spaces, setNow } = build()
  const ids = await am1(spaces)
  setNow('2026-11-09T12:00:00.000Z')
  await spaces.post('p-mledesma', ids.avisosA, { text: 'Parcial el 16.' })
  setNow('2026-11-09T13:00:00.000Z')
  await spaces.post('p-lbenitez', ids.consultasA, {
    text: '  ',
    attachments: [{ name: 'ejercicio 3.png', contentType: 'image/png', bytes: new Uint8Array([1]) }]
  })
  setNow('2026-11-09T14:00:00.000Z')
  await spaces.addMaterial('p-mledesma', ids.spaceId, pdf('Guía 4.pdf'))

  const unread = await spaces.unreadFor('p-taguirre')

  assert.ok(unread.ok)
  assert.deepEqual(
    unread.value.map((u) => [u.kind, u.latest.text, u.latest.author]),
    [
      ['material', 'Guía 4.pdf', { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' }],
      ['consultas', 'ejercicio 3.png', { personId: 'p-lbenitez', name: 'Lucía Benítez', role: 'alumno' }],
      ['avisos', 'Parcial el 16.', { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' }]
    ]
  )
})

test('un mensaje de un canal externo sin persona lleva el nombre con que llegó, y uno de alguien sin datos se muestra igual', async () => {
  const { spaces, store } = build()
  const ids = await am1(spaces)
  // Mensajes que ya están en el almacén, como los dejaría la sincronización con el canal externo.
  const external = {
    channelId: ids.consultasA,
    text: '¿Alguien tiene la guía?',
    attachments: [],
    origin: 'discord' as const,
    externalId: 'd-1',
    status: 'publicado' as const,
    replyTo: null,
    resolved: null,
    createdAt: NOW
  }
  await store.addMessage({ ...external, authorId: null, authorName: 'tomi.aguirre' })
  await store.addMessage({ ...external, externalId: 'd-2', authorId: 'p-borrada', authorName: null })

  const seen = await spaces.channel('p-taguirre', ids.consultasA)

  assert.ok(seen.ok)
  assert.deepEqual(
    seen.value.threads.map((t) => [t.message.author, t.message.origin, t.message.externalId]),
    [
      [{ personId: null, name: 'tomi.aguirre', role: null }, 'discord', 'd-1'],
      [{ personId: 'p-borrada', name: 'Persona sin datos', role: null }, 'discord', 'd-2']
    ]
  )
})

/** Archivos en memoria que anota los ids de lo que guarda, para ver qué quedó
    después de un error. */
function trackedFiles() {
  const inner = createMemoryFiles()
  const saved: string[] = []
  const files: FilesPort = {
    ...inner,
    async save(file) {
      const result = await inner.save(file)
      if (result.ok) saved.push(result.value.id)
      return result
    }
  }
  return { files, saved }
}

/** Los ids que todavía se pueden leer de Archivos. */
async function stillStored(files: FilesPort, ids: string[]) {
  const found: string[] = []
  for (const id of ids) if ((await files.read(id)).ok) found.push(id)
  return found
}

test('si falla guardar el mensaje, los adjuntos ya guardados se borran de Archivos', async () => {
  const store: SpacesStore = { ...createMemorySpacesStore(), addMessage: async () => fail('falla-externa') }
  const { files, saved } = trackedFiles()
  const { spaces } = build(syntheticData, { store, files })
  const opened = await spaces.open('p-mledesma', 'am1')
  assert.ok(opened.ok)

  const posted = await spaces.post('p-mledesma', named(opened.value, 'avisos', 'A').id, {
    text: 'Con adjuntos',
    attachments: [
      { name: 'uno.png', contentType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'dos.png', contentType: 'image/png', bytes: new Uint8Array([2]) }
    ]
  })

  assert.deepEqual(posted, { ok: false, error: 'falla-externa' })
  assert.equal(saved.length, 2)
  assert.deepEqual(await stillStored(files, saved), [])
})

test('si falla guardar el material, el archivo ya guardado se borra de Archivos', async () => {
  const store: SpacesStore = { ...createMemorySpacesStore(), addMaterial: async () => fail('falla-externa') }
  const { files, saved } = trackedFiles()
  const { spaces } = build(syntheticData, { store, files })
  const opened = await spaces.open('p-mledesma', 'am1')
  assert.ok(opened.ok)

  const added = await spaces.addMaterial('p-mledesma', opened.value.space.id, pdf('Guía 4.pdf'))

  assert.deepEqual(added, { ok: false, error: 'falla-externa' })
  assert.equal(saved.length, 1)
  assert.deepEqual(await stillStored(files, saved), [])
})

test('si falla borrar el archivo, igual se devuelve el error del almacén', async () => {
  const store: SpacesStore = { ...createMemorySpacesStore(), addMaterial: async () => fail('falla-externa') }
  const inner = createMemoryFiles()
  const files: FilesPort = { ...inner, delete: async () => fail('falla-externa') }
  const { spaces } = build(syntheticData, { store, files })
  const opened = await spaces.open('p-mledesma', 'am1')
  assert.ok(opened.ok)

  const added = await spaces.addMaterial('p-mledesma', opened.value.space.id, pdf('Guía 4.pdf'))

  assert.deepEqual(added, { ok: false, error: 'falla-externa' })
})

test('quien se inscribe en una comisión ve enseguida los canales de su espacio', async () => {
  const { spaces, studies } = build()
  // Valentina Funes todavía no cursa Programación I.
  const before = await spaces.open('p-vfunes', 'pr1')
  assert.deepEqual(before, { ok: false, error: 'sin-acceso' })

  const enrolled = await studies.enroll('p-vfunes', { kind: 'comision', sectionId: 'sec-pr1-fi-v' })
  assert.ok(enrolled.ok)

  const opened = await spaces.open('p-vfunes', 'pr1')
  assert.ok(opened.ok)
  assert.deepEqual(labels(opened.value.channels), ['#avisos (Verano)', '#consultas (Verano)', '#material'])
  assert.equal(named(opened.value, 'avisos', 'Verano').kind, 'avisos')
  assert.equal(named(opened.value, 'consultas', 'Verano').kind, 'consultas')
})

// Sincronización con el canal externo de la cátedra (Discord, en memoria)

const [discordAvisos, discordConsultas, discordMaterial] = syntheticData.discord.channels
const discordOf = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.discordId!
const LEDESMA_EN_DISCORD = { id: discordOf('p-mledesma'), name: 'mledesma' }
/** El último mensaje que tenía el canal externo antes de cada prueba. */
const LAST_SYNTHETIC = '1310000000000000005'

/** Espacios con el canal externo a mano: se puede «caer», escribir en él como si
    fuera Discord y adelantar el temporizador que espacia las sincronizaciones. */
function buildSynced() {
  let ms = 0
  const discord = createMemoryExternalChannel(syntheticData, createFixedClock(NOW))
  const { port, state } = fallible(discord)
  const openedThreads: string[] = []
  const externalChannel: ExternalChannelPort = {
    capabilities: discord.capabilities,
    read: (channelId, cursor) => port.read(channelId, cursor),
    post: (channelId, text) => port.post(channelId, text),
    reply: (channelId, threadId, text) => port.reply(channelId, threadId, text),
    download: (attachment) => port.download(attachment),
    async openThread(channelId, messageId) {
      openedThreads.push(messageId)
      return port.openThread(channelId, messageId)
    }
  }
  const built = build(syntheticData, { externalChannel, timer: () => ms })
  const wait = (seconds: number) => {
    ms += seconds * 1000
  }
  return { ...built, discord, discordState: state, openedThreads, wait }
}

const decoded = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

test('el docente vincula #avisos con su canal de Discord y entra lo que ya había, con su autor', async () => {
  const { spaces } = buildSynced()
  const ids = await am1(spaces)

  const linked = await spaces.link('p-mledesma', ids.avisosA, { system: 'discord', channelId: discordAvisos.id })

  assert.ok(linked.ok)
  assert.deepEqual(linked.value.externalLink, { system: 'discord', channelId: discordAvisos.id })
  const seen = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(seen.ok)
  const [fromTeacher, fromWebhook] = seen.value.threads.map((t) => t.message)
  // La cuenta de Discord vinculada en el seed se reconoce a través de Personas.
  assert.equal(fromTeacher.author.personId, 'p-mledesma')
  assert.equal(fromTeacher.author.role, 'profesor')
  assert.deepEqual(
    [fromTeacher.origin, fromTeacher.externalId, fromTeacher.unread],
    ['discord', '1310000000000000001', true]
  )
  // Sin cuenta vinculada, llega con el nombre que tiene en Discord.
  assert.deepEqual(fromWebhook.author, { personId: null, name: 'Avisos de la cátedra', role: null })

  // El adjunto se copió a Archivos: se abre aunque venza el enlace de Discord, y solo para quien ve el canal.
  const [attachment] = fromTeacher.attachments
  assertFileUrl(attachment.url, 'temas-parcial-2.pdf')
  const file = await spaces.file('p-taguirre', fileIdOf(attachment.url))
  assert.ok(file.ok)
  // El set sintético guarda los PDF de Discord como PDF de verdad, que el navegador puede mostrar.
  assert.equal(decoded(file.value.bytes), syntheticPdf('temas-parcial-2'))
  assert.deepEqual(await spaces.file('p-mcabrera', fileIdOf(attachment.url)), { ok: false, error: 'sin-acceso' })
})

test('vinculan los docentes del canal, con un canal de Discord que exista y no esté vinculado con otro', async () => {
  const { spaces } = buildSynced()
  const ids = await am1(spaces)
  const avisos = { system: 'discord', channelId: discordAvisos.id } as const

  assert.deepEqual(await spaces.link('p-taguirre', ids.avisosA, avisos), { ok: false, error: 'solo-docentes' })
  // Ferreyra dicta la B: los canales de la A ni los ve.
  assert.deepEqual(await spaces.link('p-gferreyra', ids.avisosA, avisos), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(
    await spaces.link('p-mledesma', ids.avisosA, { system: 'discord', channelId: '1309999999999999999' }),
    { ok: false, error: 'canal-externo-inexistente' }
  )
  assert.ok((await spaces.link('p-mledesma', ids.avisosA, avisos)).ok)
  assert.deepEqual(await spaces.link('p-mledesma', ids.consultasA, avisos), {
    ok: false,
    error: 'canal-externo-en-uso'
  })

  const asStudent = await spaces.open('p-taguirre', 'am1')
  const asTeacher = await spaces.open('p-mledesma', 'am1')
  assert.ok(asStudent.ok && asTeacher.ok)
  assert.equal(named(asStudent.value, 'avisos', 'A').canLink, false)
  assert.deepEqual(
    [named(asTeacher.value, 'avisos', 'A').canLink, named(asTeacher.value, 'material').canLink],
    [true, true]
  )
})

test('lo publicado en HackAI llega a Discord sin volver duplicado, y la respuesta del docente allá vuelve a su consulta', async () => {
  const { spaces, discord, openedThreads, wait } = buildSynced()
  const ids = await am1(spaces)
  const consultas = { system: 'discord', channelId: discordConsultas.id } as const
  assert.ok((await spaces.link('p-mledesma', ids.consultasA, consultas)).ok)

  // Lo que ya había en Discord: una consulta de Tomás con la respuesta en su hilo.
  const before = await spaces.channel('p-taguirre', ids.consultasA)
  assert.ok(before.ok)
  const [old] = before.value.threads
  assert.deepEqual([old.message.author.personId, old.message.question], ['p-taguirre', { resolved: false }])
  assert.deepEqual(
    old.replies.map((r) => [r.author.personId, r.text]),
    [['p-mledesma', 'No, llega hasta derivadas y sus aplicaciones.']]
  )

  const posted = await spaces.post('p-taguirre', ids.consultasA, { text: '¿Hay consulta el viernes?' })
  assert.ok(posted.ok)
  assert.equal(posted.value.status, 'publicado')
  assert.ok(posted.value.externalId)
  // La consulta abre su hilo en Discord, para que la respuesta quede junta.
  assert.deepEqual(openedThreads, [posted.value.externalId])
  const answer = await spaces.post('p-mledesma', ids.consultasA, { text: 'Leé el apunte', replyTo: old.message.id })
  assert.ok(answer.ok)

  const inDiscord = await discord.read(discordConsultas.id, LAST_SYNTHETIC)
  assert.ok(inDiscord.ok)
  assert.deepEqual(
    inDiscord.value.messages.map((m) => [m.id, m.threadId]),
    [
      [posted.value.externalId, null],
      [answer.value.externalId, old.message.externalId]
    ]
  )
  // El texto va primero, para que el hilo se llame como la consulta, y el autor al final.
  assert.match(inDiscord.value.messages[0].text, /^¿Hay consulta el viernes\?\n-# .+ · desde HackAI$/)
  assert.match(inDiscord.value.messages[1].text, /^Leé el apunte\n-# .+ \(docente\) · desde HackAI$/)

  discord.receive(discordConsultas.id, {
    author: LEDESMA_EN_DISCORD,
    text: 'Sí, a las 18 en el aula 4.',
    threadId: posted.value.externalId
  })
  wait(10)
  assert.ok((await spaces.open('p-taguirre', 'am1')).ok)

  const after = await spaces.channel('p-taguirre', ids.consultasA)
  assert.ok(after.ok)
  assert.deepEqual(
    after.value.threads.map((t) => [t.message.text, t.replies.map((r) => [r.author.personId, r.text, r.origin])]),
    [
      [
        '¿Entran integrales en el segundo parcial?',
        [
          ['p-mledesma', 'No, llega hasta derivadas y sus aplicaciones.', 'discord'],
          ['p-mledesma', 'Leé el apunte', 'hackai']
        ]
      ],
      ['¿Hay consulta el viernes?', [['p-mledesma', 'Sí, a las 18 en el aula 4.', 'discord']]]
    ]
  )
})

test('si Discord no responde, lo publicado queda pendiente y la siguiente sincronización lo envía en orden', async () => {
  const { spaces, discord, discordState } = buildSynced()
  const ids = await am1(spaces)
  assert.ok((await spaces.link('p-mledesma', ids.avisosA, { system: 'discord', channelId: discordAvisos.id })).ok)

  discordState.down = true
  const first = await spaces.post('p-mledesma', ids.avisosA, { text: 'Mañana no hay clase.' })
  assert.ok(first.ok)
  const reply = await spaces.post('p-mledesma', ids.avisosA, {
    text: 'Recuperamos el jueves.',
    replyTo: first.value.id
  })
  assert.ok(reply.ok)
  // Queda publicado en HackAI: los alumnos lo ven aunque Discord esté caído.
  assert.deepEqual([first.value.status, first.value.externalId, reply.value.status], ['pendiente', null, 'pendiente'])
  const seenByStudent = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(seenByStudent.ok)
  assert.equal(seenByStudent.value.threads.at(-1)?.message.text, 'Mañana no hay clase.')

  assert.deepEqual(await spaces.syncAll(), { ok: true, value: { channels: 1, imported: 0, sent: 0, pending: 2 } })

  discordState.down = false
  assert.deepEqual(await spaces.syncAll(), { ok: true, value: { channels: 1, imported: 0, sent: 2, pending: 0 } })
  // Otra sincronización no reenvía ni importa lo que ya está.
  assert.deepEqual(await spaces.syncAll(), { ok: true, value: { channels: 1, imported: 0, sent: 0, pending: 0 } })

  const inDiscord = await discord.read(discordAvisos.id, LAST_SYNTHETIC)
  assert.ok(inDiscord.ok)
  const [firstOut, replyOut] = inDiscord.value.messages
  assert.match(firstOut.text, /^Mañana no hay clase\.\n/)
  assert.deepEqual([replyOut.threadId, inDiscord.value.messages.length], [firstOut.id, 2])

  const seen = await spaces.channel('p-mledesma', ids.avisosA)
  assert.ok(seen.ok)
  const mine = seen.value.threads.at(-1)!
  assert.deepEqual(
    [mine.message.status, mine.message.externalId, mine.replies.map((r) => [r.status, r.externalId])],
    ['publicado', firstOut.id, [['publicado', replyOut.id]]]
  )
  assert.equal(seen.value.threads.length, 3, 'los dos avisos que ya había y el nuevo, sin duplicados')
})

test('abrir el espacio trae lo nuevo de Discord, pero no más de una vez cada pocos segundos', async () => {
  const { spaces, discord, wait } = buildSynced()
  const ids = await am1(spaces)
  assert.ok((await spaces.link('p-mledesma', ids.avisosA, { system: 'discord', channelId: discordAvisos.id })).ok)
  const texts = async () => {
    const seen = await spaces.channel('p-taguirre', ids.avisosA)
    assert.ok(seen.ok)
    return seen.value.threads.map((t) => t.message.text)
  }

  discord.receive(discordAvisos.id, {
    author: LEDESMA_EN_DISCORD,
    text: 'La clase de hoy es en el aula 3.',
    attachments: [{ filename: 'plano.pdf', contentType: 'application/pdf', content: 'plano', expired: true }]
  })
  const opened = await spaces.open('p-taguirre', 'am1')
  assert.ok(opened.ok)
  assert.equal(named(opened.value, 'avisos', 'A').unread, 3)
  assert.equal((await texts()).at(-1), 'La clase de hoy es en el aula 3.')

  discord.receive(discordAvisos.id, { author: LEDESMA_EN_DISCORD, text: 'Traigan calculadora.' })
  wait(1)
  await spaces.open('p-taguirre', 'am1')
  assert.equal((await texts()).at(-1), 'La clase de hoy es en el aula 3.')

  wait(5)
  await spaces.open('p-taguirre', 'am1')
  assert.equal((await texts()).at(-1), 'Traigan calculadora.')

  // Un adjunto cuyo enlace ya había vencido no se pudo copiar: queda con su enlace original.
  const seen = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(seen.ok)
  const [expired] = seen.value.threads.at(-2)!.message.attachments
  assert.equal(expired.name, 'plano.pdf')
  assert.match(expired.url, /^https:\/\/cdn\.discordapp\.com\//)
})

test('los adjuntos del canal de material de Discord entran al material, y lo que se sube en HackAI se avisa allá', async () => {
  const { spaces, discord, wait } = buildSynced()
  const ids = await am1(spaces)
  const material = { system: 'discord', channelId: discordMaterial.id } as const
  assert.ok((await spaces.link('p-gferreyra', ids.material, material)).ok)

  discord.receive(discordMaterial.id, {
    author: LEDESMA_EN_DISCORD,
    text: 'Guía 4 y la vieja',
    attachments: [
      { filename: 'guia-4.pdf', contentType: 'application/pdf', content: 'Guía 4' },
      { filename: 'vieja.pdf', contentType: 'application/pdf', content: 'vieja', expired: true }
    ]
  })
  // Entra lo que sube cualquiera: quién publica en el canal lo decide el servidor de Discord.
  discord.receive(discordMaterial.id, {
    author: { id: discordOf('p-taguirre'), name: 'tomi.aguirre' },
    text: 'Mis apuntes',
    attachments: [{ filename: 'apuntes-tomi.pdf', contentType: 'application/pdf', content: 'apuntes' }]
  })
  discord.receive(discordMaterial.id, {
    author: { id: '1290000000000000777', name: 'sin.vincular' },
    text: 'Resumen',
    attachments: [{ filename: 'resumen-anonimo.pdf', contentType: 'application/pdf', content: 'resumen' }]
  })
  wait(10)
  const view = await spaces.open('p-taguirre', 'am1')
  assert.ok(view.ok)
  assert.deepEqual(
    view.value.material.recent.map((m) => [m.name, m.origin, m.addedBy?.personId ?? null, m.unread]),
    [
      ['resumen-anonimo.pdf', 'discord', null, true],
      ['apuntes-tomi.pdf', 'discord', 'p-taguirre', false],
      ['guia-4.pdf', 'discord', 'p-mledesma', true]
    ]
  )
  const guide = view.value.material.recent.find((m) => m.name === 'guia-4.pdf')
  const file = await spaces.file('p-lbenitez', fileIdOf(guide?.url))
  assert.ok(file.ok)
  assert.equal(decoded(file.value.bytes), 'Guía 4')
  // El texto no entra: el canal de material no lleva mensajes.
  const channel = await spaces.channel('p-taguirre', ids.material)
  assert.ok(channel.ok)
  assert.deepEqual(channel.value.threads, [])

  const added = await spaces.addMaterial('p-mledesma', ids.spaceId, {
    name: 'Guía 5.pdf',
    contentType: 'application/pdf',
    bytes: new TextEncoder().encode('Guía 5'),
    section: 'Unidad 3'
  })
  assert.ok(added.ok)
  const inDiscord = await discord.read(discordMaterial.id, LAST_SYNTHETIC)
  assert.ok(inDiscord.ok)
  assert.match(inDiscord.value.messages.at(-1)?.text ?? '', /subió material en HackAI \(Unidad 3\):\n📎 Guía 5\.pdf$/)
  // El aviso vuelve sin adjuntos: no se duplica en el material.
  wait(10)
  const again = await spaces.open('p-taguirre', 'am1')
  assert.ok(again.ok)
  assert.equal(again.value.material.recent.filter((m) => m.name === 'Guía 5.pdf').length, 1)
})

test('en #avisos de Discord entra lo que escribe cualquiera; sin cuenta vinculada, con su nombre de Discord', async () => {
  const { spaces, discord } = buildSynced()
  const ids = await am1(spaces)
  discord.receive(discordAvisos.id, {
    author: { id: '1290000000000000777', name: 'ayudante.am1' },
    text: 'Hoy llego tarde.'
  })
  discord.receive(discordAvisos.id, { author: LEDESMA_EN_DISCORD, text: 'El jueves hay consulta.' })
  assert.ok((await spaces.link('p-mledesma', ids.avisosA, { system: 'discord', channelId: discordAvisos.id })).ok)

  const seen = await spaces.channel('p-taguirre', ids.avisosA)
  assert.ok(seen.ok)
  // Quién publica en el canal lo decide el servidor de Discord (pregunta abierta 18).
  assert.deepEqual(
    seen.value.threads.map((t) => [t.message.text, t.message.author.personId, t.message.author.name]),
    [
      ['Recuerden que el segundo parcial es el lunes 16. Adjunto los temas.', 'p-mledesma', 'Mariana Ledesma'],
      ['Ya están las notas del primer parcial en el SIU.', null, 'Avisos de la cátedra'],
      ['Hoy llego tarde.', null, 'ayudante.am1'],
      ['El jueves hay consulta.', 'p-mledesma', 'Mariana Ledesma']
    ]
  )
})

test('una respuesta a un mensaje de antes de vincular el canal sale suelta y no traba lo que sigue', async () => {
  const { spaces, discord } = buildSynced()
  const ids = await am1(spaces)
  // Publicado antes de vincular: nunca llega a Discord, así que no tiene id externo.
  const old = await spaces.post('p-taguirre', ids.consultasA, { text: '¿El TP se entrega impreso?' })
  assert.ok(old.ok)
  assert.ok((await spaces.link('p-mledesma', ids.consultasA, { system: 'discord', channelId: discordConsultas.id })).ok)

  const answer = await spaces.post('p-mledesma', ids.consultasA, { text: 'No, por el aula.', replyTo: old.value.id })
  const next = await spaces.post('p-taguirre', ids.consultasA, { text: '¿Y la fecha?' })
  assert.ok(answer.ok && next.ok)
  assert.deepEqual([answer.value.status, next.value.status], ['publicado', 'publicado'])
  // En HackAI sigue en su hilo; en Discord va suelta, porque su mensaje no está allá.
  assert.equal(answer.value.replyTo, old.value.id)
  const inDiscord = await discord.read(discordConsultas.id, LAST_SYNTHETIC)
  assert.ok(inDiscord.ok)
  assert.deepEqual(
    inDiscord.value.messages.map((m) => [m.id, m.threadId]),
    [
      [answer.value.externalId, null],
      [next.value.externalId, null]
    ]
  )
  assert.deepEqual(await spaces.syncAll(), { ok: true, value: { channels: 1, imported: 0, sent: 0, pending: 0 } })
})

test('la versión de un canal cambia cuando entra algo de HackAI o de Discord, y no cambia si no pasó nada', async () => {
  const { spaces, discord, wait } = buildSynced()
  const ids = await am1(spaces)
  assert.ok((await spaces.link('p-mledesma', ids.consultasA, { system: 'discord', channelId: discordConsultas.id })).ok)
  const versionOf = async (channelId: string) => {
    const v = await spaces.version(channelId)
    assert.ok(v.ok)
    return v.value
  }

  const seen = await spaces.channel('p-taguirre', ids.consultasA)
  assert.ok(seen.ok)
  const start = seen.value.version
  assert.equal(await versionOf(ids.consultasA), start, 'la de leer el canal es la misma')
  assert.equal(await versionOf(ids.consultasA), start, 'sin nada nuevo, no cambia')

  // Lo que llega de Discord entra al chequear, respetando el espaciado de las sincronizaciones.
  discord.receive(discordConsultas.id, { author: LEDESMA_EN_DISCORD, text: 'Mañana hay consulta.' })
  wait(10)
  const afterDiscord = await versionOf(ids.consultasA)
  assert.notEqual(afterDiscord, start)

  const question = await spaces.post('p-taguirre', ids.consultasA, { text: '¿A qué hora?' })
  assert.ok(question.ok)
  const afterPost = await versionOf(ids.consultasA)
  assert.notEqual(afterPost, afterDiscord)

  assert.ok((await spaces.resolve('p-mledesma', question.value.id)).ok)
  assert.notEqual(await versionOf(ids.consultasA), afterPost)

  // El material: cambia cuando se sube un archivo.
  const material = await versionOf(ids.material)
  await spaces.addMaterial('p-mledesma', ids.spaceId, {
    name: 'Guía 6.pdf',
    contentType: 'application/pdf',
    bytes: new TextEncoder().encode('Guía 6')
  })
  assert.notEqual(await versionOf(ids.material), material)

  assert.deepEqual(await spaces.version('no-existe'), { ok: false, error: 'canal-desconocido' })
})

// Avisos y material de Moodle (#16). Estos tests arman el aula con el set completo.

/** Los mensajes de un canal como los ve la persona. */
async function messagesOf(spaces: ReturnType<typeof build>['spaces'], personId: string, channelId: string) {
  const read = await spaces.channel(personId, channelId)
  assert.ok(read.ok)
  return read.value.threads.map((t) => t.message)
}

test('al abrir el espacio, los avisos del foro de Moodle llegan a #avisos de su comisión, con origen Moodle', async () => {
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData) })

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  assert.equal(named(opened.value, 'avisos', 'A').unread, 1)
  const [aviso, ...rest] = await messagesOf(spaces, 'p-taguirre', named(opened.value, 'avisos', 'A').id)
  assert.deepEqual(rest, [])
  assert.deepEqual(
    { ...aviso, id: undefined, channelId: undefined },
    {
      id: undefined,
      channelId: undefined,
      author: { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' },
      text: 'Cambio de aula para el segundo parcial\n\nEl segundo parcial del lunes 16 se toma en el aula 20. Traigan DNI.',
      attachments: [],
      origin: 'moodle',
      externalId: 'av-1',
      status: 'publicado',
      replyTo: null,
      question: null,
      unread: true,
      createdAt: '2026-11-06T20:12:00.000Z'
    }
  )
})

test('volver a abrir el espacio no duplica los avisos de Moodle, y el de la A no llega a #avisos de la B', async () => {
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData) })
  const ids = await am1(spaces)

  assert.ok((await spaces.open('p-taguirre', 'am1')).ok)
  assert.ok((await spaces.open('p-mledesma', 'am1')).ok)

  const avisosA = await messagesOf(spaces, 'p-mledesma', ids.avisosA)
  assert.deepEqual(
    avisosA.map((m) => [m.origin, m.externalId]),
    [['moodle', 'av-1']]
  )
  assert.deepEqual(await messagesOf(spaces, 'p-gferreyra', ids.avisosB), [])
})

/** El material como lo muestra la pantalla, sección por sección. */
const materialRows = (view: SpaceView) =>
  view.material.sections.map((s) => [
    s.title,
    s.items.map((i) => [i.name, i.origin, i.url, i.contentType, i.size, i.addedBy, i.addedAt, i.unread])
  ])

test('al abrir el espacio, los recursos del curso de Moodle aparecen en el material con su tema y el enlace al recurso', async () => {
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData) })

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  // Moodle no da el tamaño de un recurso: 0 es «sin dato». El apunte es del curso de la B, que también
  // es una comisión vigente de la materia.
  assert.deepEqual(materialRows(opened.value), [
    [
      'Bibliografía',
      [
        [
          'Apunte de la cátedra',
          'moodle',
          '/simulado/moodle/mod/url/view.php?id=r-3',
          'text/uri-list',
          0,
          null,
          '2026-08-12T18:00:00.000Z',
          true
        ]
      ]
    ],
    [
      'Unidad 1: Límites',
      [
        [
          'Guía de ejercicios 1',
          'moodle',
          '/simulado/moodle/pluginfile.php/am1-fi-a/guia-1.pdf',
          'application/pdf',
          0,
          null,
          '2026-08-11T12:00:00.000Z',
          true
        ]
      ]
    ],
    [
      'Unidad 2: Derivadas',
      [
        [
          'Guía de ejercicios 2',
          'moodle',
          '/simulado/moodle/pluginfile.php/am1-fi-a/guia-2.pdf',
          'application/pdf',
          0,
          null,
          '2026-09-29T12:00:00.000Z',
          true
        ]
      ]
    ]
  ])
  assert.equal(named(opened.value, 'material').unread, 3)
})

test('el material reúne los recursos de Moodle de todas las comisiones vigentes, aunque nadie de la otra haya abierto el espacio, sin duplicarlos', async () => {
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData) })

  // Nadie de la B abrió el espacio todavía: sus recursos salen igual, de la oferta de la materia.
  await spaces.open('p-taguirre', 'am1')
  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  // El apunte es del curso de la B y es un enlace; el de AM1 de Ciencias Empresariales es de otro espacio.
  assert.deepEqual(
    opened.value.material.sections.map((s) => [s.title, s.items.map((i) => [i.name, i.contentType])]),
    [
      ['Bibliografía', [['Apunte de la cátedra', 'text/uri-list']]],
      ['Unidad 1: Límites', [['Guía de ejercicios 1', 'application/pdf']]],
      ['Unidad 2: Derivadas', [['Guía de ejercicios 2', 'application/pdf']]]
    ]
  )
  assert.equal(named(opened.value, 'material').unread, 3)
})

test('lo que trae de Moodle entra por fecha, así lo más nuevo queda primero aunque Moodle lo liste en otro orden', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.contents.reverse()
  data.moodle.announcements.push({
    ...data.moodle.announcements[0],
    id: 'av-viejo',
    subject: 'Bienvenida',
    message: 'Bienvenidos a la materia.',
    createdAt: '2026-08-10T12:00:00.000Z'
  })
  const { spaces } = build(data, { classroom: createMemoryClassroom(data) })

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  assert.deepEqual(
    opened.value.material.recent.map((i) => i.name),
    ['Guía de ejercicios 2', 'Apunte de la cátedra', 'Guía de ejercicios 1']
  )
  const avisos = await messagesOf(spaces, 'p-taguirre', named(opened.value, 'avisos', 'A').id)
  assert.deepEqual(
    avisos.map((m) => m.externalId),
    ['av-viejo', 'av-1'],
    'en el orden en que se publicaron'
  )
})

test('los adjuntos de un aviso de Moodle quedan como enlace al archivo en Moodle, sin copiarse a Archivos', async () => {
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData) })

  const opened = await spaces.open('p-fjuarez', 'co1')

  assert.ok(opened.ok)
  const [aviso] = await messagesOf(spaces, 'p-fjuarez', named(opened.value, 'avisos', 'A').id)
  assert.deepEqual(aviso.author, { personId: 'p-srosales', name: 'Silvina Rosales', role: 'profesor' })
  assert.deepEqual(aviso.attachments, [
    {
      name: 'temas-segundo-parcial.pdf',
      contentType: 'application/pdf',
      size: 48213,
      url: '/simulado/moodle/pluginfile.php/co1/temas-segundo-parcial.pdf'
    }
  ])
})

test('con Moodle caído el espacio abre igual, sin lo de Moodle, y lo trae en la próxima apertura', async () => {
  const { port: classroom, state } = fallible(createMemoryClassroom(syntheticData))
  const { spaces } = build(syntheticData, { classroom })
  state.down = true

  const down = await spaces.open('p-taguirre', 'am1')

  assert.ok(down.ok)
  assert.deepEqual(down.value.material.sections, [])
  assert.equal(named(down.value, 'avisos', 'A').unread, 0)

  state.down = false
  const back = await spaces.open('p-taguirre', 'am1')

  assert.ok(back.ok)
  assert.equal(named(back.value, 'avisos', 'A').unread, 1)
  assert.equal(named(back.value, 'material').unread, 3)
})

/** Aula en memoria con el set completo a la que se le pueden publicar avisos después de armarla. */
function classroomWithNewAnnouncements(data: SyntheticData) {
  const inner = createMemoryClassroom(data)
  const published: ClassroomAnnouncement[] = []
  const classroom: ClassroomPort = {
    ...inner,
    async announcements(courseId, since) {
      const read = await inner.announcements(courseId, since)
      if (!read.ok) return read
      return ok([...read.value, ...published.filter((a) => a.courseId === courseId)])
    }
  }
  return { classroom, publish: (a: ClassroomAnnouncement) => published.push(a) }
}

test('un aviso que se publica en Moodle después de abrir el espacio entra en la próxima apertura, sin repetir los otros', async () => {
  const { classroom, publish } = classroomWithNewAnnouncements(syntheticData)
  const { spaces } = build(syntheticData, { classroom })
  const first = await spaces.open('p-taguirre', 'am1')
  assert.ok(first.ok)
  const avisosA = named(first.value, 'avisos', 'A').id
  await spaces.channel('p-taguirre', avisosA)

  publish({
    id: 'av-nuevo',
    courseId: 'c-am1-fi-a',
    authorId: syntheticData.moodle.announcements[0].authorId,
    subject: 'Consultas antes del parcial',
    message: 'El viernes hay clase de consulta a las 18.',
    createdAt: '2026-11-10T21:00:00.000Z',
    attachments: []
  })
  const second = await spaces.open('p-taguirre', 'am1')

  assert.ok(second.ok)
  assert.equal(named(second.value, 'avisos', 'A').unread, 1)
  assert.deepEqual(
    (await messagesOf(spaces, 'p-taguirre', avisosA)).map((m) => [m.externalId, m.unread]),
    [
      ['av-1', false],
      ['av-nuevo', true]
    ]
  )
})

test('con un reloj que avanza, abrir el espacio no vuelve a Moodle antes de 10 segundos, y después sí', async () => {
  const { classroom, publish } = classroomWithNewAnnouncements(syntheticData)
  const reads = { courses: 0 }
  const counted: ClassroomPort = {
    ...classroom,
    coursesForSection: async (id) => {
      reads.courses++
      return classroom.coursesForSection(id)
    }
  }
  const { spaces, setNow } = build(syntheticData, { classroom: counted, clockMoves: true })
  assert.ok((await spaces.open('p-taguirre', 'am1')).ok)
  const afterFirst = reads.courses
  publish({
    id: 'av-nuevo',
    courseId: 'c-am1-fi-a',
    authorId: syntheticData.moodle.announcements[0].authorId,
    subject: 'Consultas antes del parcial',
    message: 'El viernes hay clase de consulta a las 18.',
    createdAt: '2026-11-10T21:00:00.000Z',
    attachments: []
  })

  setNow(new Date(Date.parse(syntheticData.now) + 9_000).toISOString())
  const soon = await spaces.open('p-taguirre', 'am1')

  assert.ok(soon.ok)
  assert.equal(reads.courses, afterFirst, 'no le pregunta a Moodle de nuevo')
  assert.equal(named(soon.value, 'avisos', 'A').unread, 1)

  setNow(new Date(Date.parse(syntheticData.now) + 10_000).toISOString())
  const later = await spaces.open('p-taguirre', 'am1')

  assert.ok(later.ok)
  assert.equal(named(later.value, 'avisos', 'A').unread, 2)
})

test('si Personas no responde al buscar al autor de un aviso, el aviso entra en la próxima apertura con su autor', async () => {
  const inner = createMemoryPeopleStore(syntheticData)
  const moodleDown = { value: true }
  const peopleStore: PeopleStore = {
    ...inner,
    ownerOf: async (system, id) =>
      moodleDown.value && system === 'moodle' ? fail('falla-externa') : inner.ownerOf(system, id)
  }
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData), peopleStore })

  const down = await spaces.open('p-taguirre', 'am1')

  assert.ok(down.ok)
  const avisosA = named(down.value, 'avisos', 'A').id
  assert.deepEqual(await messagesOf(spaces, 'p-taguirre', avisosA), [])

  moodleDown.value = false
  assert.ok((await spaces.open('p-taguirre', 'am1')).ok)

  const [aviso] = await messagesOf(spaces, 'p-taguirre', avisosA)
  assert.deepEqual([aviso.externalId, aviso.author.personId], ['av-1', 'p-mledesma'])
})

test('un aviso de una cuenta de Moodle que no es de nadie en HackAI se muestra igual, sin autor vinculado', async () => {
  const data = structuredClone(syntheticData)
  data.moodle.announcements[0].authorId = '999999'
  const { spaces } = build(data, { classroom: createMemoryClassroom(data) })

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  const [aviso] = await messagesOf(spaces, 'p-taguirre', named(opened.value, 'avisos', 'A').id)
  assert.deepEqual(
    [aviso.externalId, aviso.author],
    ['av-1', { personId: null, name: 'Persona sin datos', role: null }]
  )
})

test('si otro guardó lo mismo de Moodle a la vez y el almacén responde duplicado, el espacio abre igual', async () => {
  const inner = createMemorySpacesStore()
  const store: SpacesStore = {
    ...inner,
    addMessage: async (m) => (m.origin === 'moodle' ? fail('duplicado') : inner.addMessage(m)),
    addMaterial: async (m) => (m.origin === 'moodle' ? fail('duplicado') : inner.addMaterial(m))
  }
  const { spaces } = build(syntheticData, { classroom: createMemoryClassroom(syntheticData), store })

  const opened = await spaces.open('p-taguirre', 'am1')

  assert.ok(opened.ok)
  assert.equal(named(opened.value, 'avisos', 'A').unread, 0)
})

// Canales directos (#19). En el set, Ledesma dicta la A de AM1 (Tomás, Lucía y
// Joaquín) y Ferreyra la B (Martín, Sofía y Valentina). Joaquín y Martín
// también cursan Física I de verano con Ferreyra.

test('el alumno abre un canal directo con un docente de su comisión, le escribe y el docente le responde', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)

  const opened = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')

  assert.ok(opened.ok)
  assert.deepEqual(
    { ...opened.value, id: undefined },
    {
      id: undefined,
      spaceId,
      name: 'directo',
      kind: 'directo',
      scope: { kind: 'directo', personIds: ['p-mledesma', 'p-taguirre'] },
      sectionName: null,
      unread: 0,
      canPost: true,
      canResolve: false,
      // Los directos no se vinculan con el canal externo.
      canLink: false,
      externalLink: null,
      counterpart: { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' }
    }
  )
  const directId = opened.value.id
  const asked = await spaces.post('p-taguirre', directId, { text: '¿Puedo rendir el recuperatorio otro día?' })
  assert.ok(asked.ok)
  assert.equal(asked.value.question, null)

  const seen = await spaces.channel('p-mledesma', directId)
  assert.ok(seen.ok)
  assert.deepEqual(seen.value.channel.counterpart, { personId: 'p-taguirre', name: 'Tomás Aguirre', role: 'alumno' })
  assert.deepEqual(
    seen.value.threads.map((t) => [t.message.author.personId, t.message.text, t.message.unread]),
    [['p-taguirre', '¿Puedo rendir el recuperatorio otro día?', true]]
  )
  const answered = await spaces.post('p-mledesma', directId, { text: 'Sí, escribime la semana que viene.' })
  assert.ok(answered.ok)

  const back = await spaces.channel('p-taguirre', directId)
  assert.ok(back.ok)
  assert.deepEqual(
    back.value.threads.map((t) => [t.message.author.name, t.message.text]),
    [
      ['Tomás Aguirre', '¿Puedo rendir el recuperatorio otro día?'],
      ['Mariana Ledesma', 'Sí, escribime la semana que viene.']
    ]
  )
})

test('el espacio le dice al alumno a qué docentes de su comisión les puede escribir en privado, y al docente, a nadie', async () => {
  const { spaces } = build()
  await am1(spaces)

  const student = await spaces.open('p-taguirre', 'am1')
  const teacher = await spaces.open('p-gferreyra', 'am1')

  assert.ok(student.ok && teacher.ok)
  assert.deepEqual(student.value.viewer.directContacts, [
    { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor', sectionName: 'A' }
  ])
  const opened = await spaces.openDirect('p-taguirre', student.value.space.id, 'p-mledesma')
  assert.ok(opened.ok, 'cada contacto es alguien con quien `openDirect` abre el canal')
  assert.deepEqual(teacher.value.viewer.directContacts, [])
})

/** Joaquín cursa la A de AM1 con Ledesma y, antes, cursó AM1 en el 1er cuatrimestre con Ferreyra. */
function withPastSection(): SyntheticData {
  const data = withEnrollment('30105', 'sec-am1-fi-1c')
  const b = data.siu.sections.find((s) => s.id === 'sec-am1-fi-b')
  assert.ok(b)
  data.siu.sections.push({ ...b, id: 'sec-am1-fi-1c', name: 'C', termId: '1c-2026' })
  return data
}

test('quien recursa le escribe en privado al docente de su comisión vigente, no al de la que cursó antes', async () => {
  const { spaces } = build(withPastSection())
  await am1(spaces)

  const opened = await spaces.open('p-jescobar', 'am1')

  assert.ok(opened.ok)
  assert.deepEqual(
    opened.value.viewer.sections.map((s) => [s.name, s.current]),
    [
      ['A', true],
      ['C', false]
    ]
  )
  assert.deepEqual(
    opened.value.viewer.directContacts.map((c) => c.personId),
    ['p-mledesma']
  )
  const spaceId = opened.value.space.id
  assert.deepEqual(await spaces.openDirect('p-jescobar', spaceId, 'p-gferreyra'), {
    ok: false,
    error: 'sin-comision-en-comun'
  })
  assert.deepEqual(await spaces.openDirect('p-gferreyra', spaceId, 'p-jescobar'), {
    ok: false,
    error: 'sin-comision-en-comun'
  })
})

test('en una materia archivada, el alumno le sigue pudiendo escribir en privado al docente de su comisión', async () => {
  const { spaces } = build()

  // Valentina cursó Álgebra con Ledesma en el 1er cuatrimestre: no tiene comisión vigente (pregunta abierta 17).
  const opened = await spaces.open('p-vfunes', 'aga')

  assert.ok(opened.ok)
  assert.deepEqual(
    opened.value.viewer.directContacts.map((c) => [c.personId, c.sectionName]),
    [['p-mledesma', 'A']]
  )
  const direct = await spaces.openDirect('p-vfunes', opened.value.space.id, 'p-mledesma')
  assert.ok(direct.ok)
})

test('no hay canal directo entre dos alumnos, entre dos docentes ni con un docente de otra comisión', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)
  const direct = async (personId: string, otherPersonId: string, space = spaceId) => {
    const opened = await spaces.openDirect(personId, space, otherPersonId)
    return opened.ok ? 'ok' : opened.error
  }

  // Lucía es de la misma comisión que Tomás, pero es alumna.
  assert.equal(await direct('p-taguirre', 'p-lbenitez'), 'solo-alumno-docente')
  assert.equal(await direct('p-mledesma', 'p-gferreyra'), 'solo-alumno-docente')
  assert.equal(await direct('p-taguirre', 'p-taguirre'), 'solo-alumno-docente')
  // Ferreyra dicta la B; Tomás es de la A.
  assert.equal(await direct('p-taguirre', 'p-gferreyra'), 'sin-comision-en-comun')
  assert.equal(await direct('p-gferreyra', 'p-taguirre'), 'sin-comision-en-comun')
  // Joaquín y Ferreyra comparten Física I, no una comisión de AM1.
  assert.equal(await direct('p-jescobar', 'p-gferreyra'), 'sin-comision-en-comun')
  // Alguien de la materia en otra facultad, o que no existe.
  assert.equal(await direct('p-taguirre', 'p-cbustos'), 'sin-comision-en-comun')
  assert.equal(await direct('p-taguirre', 'p-nadie'), 'sin-comision-en-comun')
  // Quien abre tiene que ser del espacio.
  assert.equal(await direct('p-agimenez', 'p-mledesma'), 'sin-acceso')
  assert.equal(await direct('p-nadie', 'p-mledesma'), 'persona-desconocida')
  assert.equal(await direct('p-taguirre', 'p-mledesma', 'sp-nada'), 'espacio-desconocido')

  // Ninguno de los intentos dejó un canal directo.
  const opened = await spaces.open('p-taguirre', 'am1')
  assert.ok(opened.ok)
  assert.equal(
    opened.value.channels.some((c) => c.kind === 'directo'),
    false
  )
})

test('el canal directo es uno por par y por espacio, lo abra quien lo abra', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)

  const first = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')
  const again = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')
  const fromTeacher = await spaces.openDirect('p-mledesma', spaceId, 'p-taguirre')

  assert.ok(first.ok && again.ok && fromTeacher.ok)
  assert.equal(again.value.id, first.value.id)
  assert.equal(fromTeacher.value.id, first.value.id)
  assert.deepEqual(fromTeacher.value.counterpart, { personId: 'p-taguirre', name: 'Tomás Aguirre', role: 'alumno' })
  // Martín y Ferreyra comparten AM1 B y Física I de verano: un canal en cada espacio.
  const physics = await spaces.open('p-gferreyra', 'fi1')
  assert.ok(physics.ok)
  const inAm1 = await spaces.openDirect('p-mcabrera', spaceId, 'p-gferreyra')
  const inPhysics = await spaces.openDirect('p-mcabrera', physics.value.space.id, 'p-gferreyra')
  assert.ok(inAm1.ok && inPhysics.ok)
  assert.notEqual(inAm1.value.id, inPhysics.value.id)
  assert.equal(inPhysics.value.spaceId, physics.value.space.id)
})

test('el canal directo y sus adjuntos los ven solo sus dos personas', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)
  const opened = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')
  assert.ok(opened.ok)
  const directId = opened.value.id
  const posted = await spaces.post('p-taguirre', directId, {
    text: 'Le mando el certificado.',
    attachments: [{ name: 'certificado.pdf', contentType: 'application/pdf', bytes: new Uint8Array([7]) }]
  })
  assert.ok(posted.ok)
  const fileId = posted.value.attachments[0].url.split('/')[2]

  // Los dos lo ven al final de sus canales, con el nombre del otro.
  const asStudent = await spaces.open('p-taguirre', 'am1')
  const asTeacher = await spaces.open('p-mledesma', 'am1')
  assert.ok(asStudent.ok && asTeacher.ok)
  assert.equal(asStudent.value.channels.at(-1)?.counterpart?.name, 'Mariana Ledesma')
  assert.equal(asTeacher.value.channels.at(-1)?.counterpart?.name, 'Tomás Aguirre')
  assert.ok((await spaces.file('p-mledesma', fileId)).ok)

  // Ni otra alumna de la comisión ni el docente de la otra lo ven.
  for (const personId of ['p-lbenitez', 'p-gferreyra']) {
    const other = await spaces.open(personId, 'am1')
    assert.ok(other.ok)
    assert.equal(
      other.value.channels.some((c) => c.id === directId),
      false,
      personId
    )
    assert.deepEqual(await spaces.channel(personId, directId), { ok: false, error: 'sin-acceso' }, personId)
    assert.deepEqual(await spaces.post(personId, directId, { text: 'Hola' }), { ok: false, error: 'sin-acceso' })
    assert.deepEqual(await spaces.file(personId, fileId), { ok: false, error: 'sin-acceso' }, personId)
  }
})

test('los mensajes directos sin leer aparecen como novedad solo para quien los recibe', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)
  const opened = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')
  assert.ok(opened.ok)
  const directId = opened.value.id
  await spaces.post('p-taguirre', directId, { text: '¿Puedo rendir el recuperatorio otro día?' })

  const forTeacher = await spaces.unreadFor('p-mledesma')
  assert.ok(forTeacher.ok)
  assert.deepEqual(
    forTeacher.value.filter((u) => u.kind === 'directo').map((u) => [u.channelId, u.subjectId, u.count, u.latest.text]),
    [[directId, 'am1', 1, '¿Puedo rendir el recuperatorio otro día?']]
  )
  assert.equal((await unreadOf(spaces, 'p-mledesma')).directo, 1)
  const fromTeacher = await spaces.openDirect('p-mledesma', spaceId, 'p-taguirre')
  assert.ok(fromTeacher.ok)
  assert.equal(fromTeacher.value.unread, 1)
  for (const personId of ['p-taguirre', 'p-lbenitez']) {
    const unread = await spaces.unreadFor(personId)
    assert.ok(unread.ok)
    assert.equal(
      unread.value.some((u) => u.channelId === directId),
      false,
      personId
    )
  }

  // Una vez leído, deja de ser novedad.
  await spaces.channel('p-mledesma', directId)
  const after = await spaces.unreadFor('p-mledesma')
  assert.ok(after.ok)
  assert.equal(
    after.value.some((u) => u.channelId === directId),
    false
  )
})

test('si todo lo sin leer de un canal es respuesta de una misma consulta, la novedad lleva a ese hilo', async () => {
  const { spaces } = build()
  const { consultasA } = await am1(spaces)
  const threadOf = async () => {
    const unread = await spaces.unreadFor('p-taguirre')
    assert.ok(unread.ok)
    return unread.value.find((u) => u.channelId === consultasA)?.thread
  }
  const question = await spaces.post('p-taguirre', consultasA, { text: '¿Entra límites?' })
  assert.ok(question.ok)
  await spaces.post('p-mledesma', consultasA, { text: 'Sí.', replyTo: question.value.id })
  await spaces.post('p-lbenitez', consultasA, { text: '¿Y derivadas?', replyTo: question.value.id })

  assert.equal(await threadOf(), question.value.id)

  // Una consulta nueva va al canal, igual que lo sin leer de más de un hilo.
  await spaces.channel('p-taguirre', consultasA)
  await spaces.post('p-lbenitez', consultasA, { text: '¿Cuándo es el recuperatorio?' })
  assert.equal(await threadOf(), null)
  await spaces.post('p-mledesma', consultasA, { text: 'Derivadas no.', replyTo: question.value.id })
  assert.equal(await threadOf(), null)
})

test('un mensaje directo sin leer dice de quién es; en el resto de los canales no hay otra persona', async () => {
  const { spaces, setNow } = build()
  const { spaceId, avisosA } = await am1(spaces)
  setNow('2026-11-09T12:00:00.000Z')
  await spaces.post('p-mledesma', avisosA, { text: 'Parcial el 16.' })
  setNow('2026-11-09T13:00:00.000Z')
  const fromStudent = await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')
  const fromTeacher = await spaces.openDirect('p-mledesma', spaceId, 'p-lbenitez')
  assert.ok(fromStudent.ok && fromTeacher.ok)
  await spaces.post('p-taguirre', fromStudent.value.id, { text: '¿Puedo rendir el recuperatorio otro día?' })
  await spaces.post('p-mledesma', fromTeacher.value.id, { text: 'Te falta entregar el TP.' })

  const forStudent = await spaces.unreadFor('p-lbenitez')
  const forTeacher = await spaces.unreadFor('p-mledesma')

  assert.ok(forStudent.ok && forTeacher.ok)
  assert.deepEqual(
    forStudent.value.map((u) => [u.kind, u.counterpart]),
    [
      ['directo', { personId: 'p-mledesma', name: 'Mariana Ledesma', role: 'profesor' }],
      ['avisos', null]
    ]
  )
  assert.deepEqual(
    forTeacher.value.map((u) => [u.kind, u.counterpart]),
    [['directo', { personId: 'p-taguirre', name: 'Tomás Aguirre', role: 'alumno' }]]
  )
})

test('si Cursada no responde por alguna de las dos personas, abrir un canal directo da falla externa', async () => {
  const { spaces, siuState } = build()
  const { spaceId } = await am1(spaces)
  siuState.down = true

  // Nunca se leyeron las comisiones de Tomás ni las de Joaquín.
  assert.deepEqual(await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma'), { ok: false, error: 'falla-externa' })
  assert.deepEqual(await spaces.openDirect('p-mledesma', spaceId, 'p-jescobar'), { ok: false, error: 'falla-externa' })
})

test('un canal directo no le quita el nombre a un canal que crea el docente', async () => {
  const { spaces } = build()
  const { spaceId } = await am1(spaces)
  assert.ok((await spaces.openDirect('p-taguirre', spaceId, 'p-mledesma')).ok)

  const created = await spaces.createChannel('p-mledesma', spaceId, { name: 'directo', scope: { kind: 'materia' } })

  assert.ok(created.ok)
  assert.equal(created.value.kind, 'libre')
})

// Consultas que le tocan responder a un docente, para su Hoy.

test('al docente le tocan las consultas sin resolver de sus comisiones actuales, la más vieja primero', async () => {
  const { spaces, setNow } = build()
  const ids = await am1(spaces)
  setNow('2026-11-09T12:00:00.000Z')
  const limits = await spaces.post('p-taguirre', ids.consultasA, { text: '¿Entra límites?' })
  setNow('2026-11-09T13:00:00.000Z')
  const resolved = await spaces.post('p-lbenitez', ids.consultasA, { text: '¿Hay clase el jueves?' })
  await spaces.post('p-mcabrera', ids.consultasB, { text: '¿Puedo rendir en la A?' })
  setNow('2026-11-10T09:00:00.000Z')
  const derivatives = await spaces.post('p-jescobar', ids.consultasA, { text: '¿Y derivadas?' })
  assert.ok(limits.ok && resolved.ok && derivatives.ok)
  await spaces.post('p-mledesma', ids.consultasA, { text: 'Sí.', replyTo: limits.value.id })
  await spaces.post('p-lbenitez', ids.consultasA, { text: 'Gracias', replyTo: limits.value.id })
  await spaces.resolve('p-mledesma', resolved.value.id)
  // Un aviso no es una consulta.
  await spaces.post('p-mledesma', ids.avisosA, { text: 'Parcial el 16.' })

  const ledesma = await spaces.openQuestions('p-mledesma')
  const ferreyra = await spaces.openQuestions('p-gferreyra')

  assert.ok(ledesma.ok)
  assert.deepEqual(
    ledesma.value.map((q) => [q.text, q.author.name, q.sectionName, q.replies, q.createdAt]),
    [
      ['¿Entra límites?', 'Tomás Aguirre', 'A', 2, '2026-11-09T12:00:00.000Z'],
      ['¿Y derivadas?', 'Joaquín Escobar', 'A', 0, '2026-11-10T09:00:00.000Z']
    ]
  )
  assert.deepEqual(
    { ...ledesma.value[0], author: undefined },
    {
      messageId: limits.value.id,
      channelId: ids.consultasA,
      spaceId: ids.spaceId,
      subjectId: 'am1',
      subjectName: 'Análisis Matemático I',
      sectionName: 'A',
      text: '¿Entra límites?',
      author: undefined,
      origin: 'hackai',
      createdAt: '2026-11-09T12:00:00.000Z',
      replies: 2
    }
  )
  assert.ok(ferreyra.ok)
  assert.deepEqual(
    ferreyra.value.map((q) => q.text),
    ['¿Puedo rendir en la A?']
  )
})

test('a un alumno no le toca ninguna consulta, ni al docente las de una comisión archivada', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  await spaces.post('p-taguirre', ids.consultasA, { text: '¿Entra límites?' })
  const aga = await spaces.open('p-mledesma', 'aga')
  assert.ok(aga.ok)
  await spaces.post('p-taguirre', named(aga.value, 'consultas', 'A').id, { text: '¿Cuándo es el final?' })

  assert.deepEqual(await spaces.openQuestions('p-lbenitez'), { ok: true, value: [] })
  const ledesma = await spaces.openQuestions('p-mledesma')
  assert.ok(ledesma.ok)
  assert.deepEqual(
    ledesma.value.map((q) => q.subjectName),
    ['Análisis Matemático I']
  )
})

test('sin espacios abiertos no hay consultas y pedirlas no crea ninguno; si Cursada no responde, falla externa', async () => {
  const { spaces, store, siuState } = build()

  assert.deepEqual(await spaces.openQuestions('p-mledesma'), { ok: true, value: [] })
  assert.deepEqual(await store.spacesFor([{ subjectId: 'am1', schoolId: 'fi' }]), { ok: true, value: [] })
  assert.deepEqual(await spaces.openQuestions('p-nadie'), { ok: false, error: 'persona-desconocida' })
  siuState.down = true
  assert.deepEqual(await spaces.openQuestions('p-gferreyra'), { ok: false, error: 'falla-externa' })
})

test('la búsqueda encuentra el material por nombre o por unidad, sin distinguir mayúsculas ni tildes', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  for (const [name, section] of [
    ['Guía de límites.pdf', 'Unidad 1: Límites'],
    ['Guía 2.pdf', 'Unidad 1: Límites'],
    ['Práctica derivadas.pdf', 'Unidad 2: Derivadas'],
    ['Programa.pdf', null]
  ] as const) {
    assert.ok((await spaces.addMaterial('p-mledesma', ids.spaceId, pdf(name, section))).ok)
  }
  const names = async (query: string) => {
    const found = await spaces.search('p-taguirre', ids.spaceId, query)
    assert.ok(found.ok)
    return found.value.material.map((m) => m.name)
  }

  // Por unidad: lo que tiene «unidad 2» tal cual va primero, y después lo que tiene las dos palabras.
  assert.deepEqual(await names('  UNIDAD   2 '), ['Práctica derivadas.pdf', 'Guía 2.pdf'])
  // Por palabras, en cualquier orden y repartidas entre el nombre y la unidad.
  assert.deepEqual(await names('limites guia'), ['Guía 2.pdf', 'Guía de límites.pdf'])
  assert.deepEqual(await names('derivadas practica'), ['Práctica derivadas.pdf'])
  assert.deepEqual(await names('guia integrales'), [])
  // Por nombre, sin tildes ni mayúsculas, el más nuevo primero.
  assert.deepEqual(await names('guia'), ['Guía 2.pdf', 'Guía de límites.pdf'])
  assert.deepEqual(await names('limites'), ['Guía 2.pdf', 'Guía de límites.pdf'])
  assert.deepEqual(await names('PRÁCTICA'), ['Práctica derivadas.pdf'])
  assert.deepEqual(await names('integrales'), [])
  assert.deepEqual(await spaces.search('p-taguirre', ids.spaceId, '   '), {
    ok: true,
    value: { query: '', material: [], questions: [] }
  })

  // Cada resultado dice de dónde viene y cómo abrirlo, y buscar no lo marca visto.
  const found = await spaces.search('p-taguirre', ids.spaceId, 'programa')
  assert.ok(found.ok)
  assert.equal(found.value.query, 'programa')
  assert.deepEqual(
    found.value.material.map((m) => [m.origin, m.unread, m.url.startsWith('/archivos/')]),
    [['hackai', true, true]]
  )
  assert.deepEqual(await unreadOf(spaces, 'p-taguirre'), { 'avisos (A)': 0, 'consultas (A)': 0, material: 4 })
})

test('la búsqueda trae las consultas de la comisión del alumno, las resueltas primero, y nunca las de otra', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)
  const ask = async (personId: string, channelId: string, text: string) => {
    const asked = await spaces.post(personId, channelId, { text })
    assert.ok(asked.ok)
    return asked.value.id
  }
  const open = await ask('p-taguirre', ids.consultasA, '¿El parcial incluye límites?')
  const solved = await ask('p-lbenitez', ids.consultasA, '¿Hay que saber la tabla de derivadas?')
  assert.ok((await spaces.post('p-mledesma', ids.consultasA, { text: 'Sí, entra Límites.', replyTo: solved })).ok)
  assert.ok((await spaces.resolve('p-mledesma', solved)).ok)
  await ask('p-mcabrera', ids.consultasB, '¿Entran límites al infinito?')
  // Lo que no es consulta (un aviso) no aparece.
  assert.ok((await spaces.post('p-mledesma', ids.avisosA, { text: 'Límites queda para el parcial.' })).ok)

  const found = await spaces.search('p-taguirre', ids.spaceId, 'LIMITES')
  assert.ok(found.ok)
  assert.deepEqual(
    found.value.questions.map((q) => ({ ...q, createdAt: undefined })),
    [
      {
        messageId: solved,
        channelId: ids.consultasA,
        sectionName: 'A',
        text: '¿Hay que saber la tabla de derivadas?',
        author: { personId: 'p-lbenitez', name: found.value.questions[0]?.author.name, role: 'alumno' },
        resolved: true,
        replies: 1,
        createdAt: undefined
      },
      {
        messageId: open,
        channelId: ids.consultasA,
        sectionName: 'A',
        text: '¿El parcial incluye límites?',
        author: { personId: 'p-taguirre', name: found.value.questions[1]?.author.name, role: 'alumno' },
        resolved: false,
        replies: 0,
        createdAt: undefined
      }
    ]
  )

  // La alumna de la B solo ve la de su comisión.
  const fromB = await spaces.search('p-mcabrera', ids.spaceId, 'límites')
  assert.ok(fromB.ok)
  assert.deepEqual(
    fromB.value.questions.map((q) => [q.text, q.sectionName]),
    [['¿Entran límites al infinito?', 'B']]
  )
})

test('no busca en un espacio ajeno ni en uno que no existe', async () => {
  const { spaces } = build()
  const ids = await am1(spaces)

  assert.deepEqual(await spaces.search('p-agimenez', ids.spaceId, 'guía'), { ok: false, error: 'sin-acceso' })
  assert.deepEqual(await spaces.search('p-taguirre', 'sp-nada', 'guía'), { ok: false, error: 'espacio-desconocido' })
})
