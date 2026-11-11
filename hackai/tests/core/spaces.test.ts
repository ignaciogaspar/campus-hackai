import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { type SyntheticData, syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { type Channel, createSpaces, type SpaceView } from '@/lib/core/spaces'
import { createStudies } from '@/lib/core/studies'
import type { ClockPort } from '@/lib/ports/clock'
import type { SiuPort } from '@/lib/ports/siu'
import { fail } from '@/lib/result'

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

function build(data: SyntheticData = syntheticData) {
  let now = data.now
  // Reloj que se puede mover, para subir material en distintas semanas.
  const clock: ClockPort = { capabilities: { fixed: true }, now: () => new Date(now) }
  const setNow = (iso: string) => {
    now = iso
  }
  const { port: siu, state: siuState } = fallibleSiu(createMemorySiu(data, clock))
  const classroom = createMemoryClassroom(data)
  const people = createPeople({ identity: createMemoryIdentity(data), siu, store: createMemoryPeopleStore(data) })
  const studies = createStudies({ people, siu, classroom, clock })
  const store = createMemorySpacesStore()
  const spaces = createSpaces({
    people,
    studies,
    externalChannel: createMemoryExternalChannel(data, clock),
    classroom,
    files: createMemoryFiles(),
    clock,
    store
  })
  return { spaces, store, siuState, setNow }
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
    canManage: true
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
      externalLink: null
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
    unread.value.map((u) => [u.subjectName, u.channelName, u.kind, u.count, u.latest]),
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
      count: 2,
      latest: undefined
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
