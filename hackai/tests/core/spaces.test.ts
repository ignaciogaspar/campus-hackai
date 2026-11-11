import assert from 'node:assert/strict'
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
import { createPeople } from '@/lib/core/people'
import { type Channel, createSpaces, type SpaceView } from '@/lib/core/spaces'
import { createStudies } from '@/lib/core/studies'
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

function build(data: SyntheticData = syntheticData) {
  const clock = createFixedClock(data.now)
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
  return { spaces, store, siuState }
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
  assert.deepEqual(posted.value.attachments, [
    { name: 'ejercicio.png', contentType: 'image/png', size: 3, url: 'data:image/png;base64,AQID' }
  ])

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
