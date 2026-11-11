import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { compose } from '@/lib/composition'
import { syntheticData } from '@/lib/adapters/synthetic-data'

const siuId = (personId: string) => syntheticData.people.find((p) => p.id === personId)!.siuId

test('el SIU en memoria rechaza inscripciones sin cupo, fuera de período o repetidas', async () => {
  const { siu } = compose({}).ports
  const lucia = siuId('p-lbenitez')

  assert.deepEqual(await siu.enroll(lucia, { kind: 'comision', sectionId: 'sec-fi1-fi-v' }), { ok: false, error: 'sin-cupo' })
  assert.deepEqual(await siu.enroll(lucia, { kind: 'comision', sectionId: 'sec-am1-fi-b' }), { ok: false, error: 'fuera-de-periodo' })

  const first = await siu.enroll(lucia, { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' })
  assert.equal(first.ok, true)
  assert.deepEqual(await siu.enroll(lucia, { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' }), { ok: false, error: 'ya-inscripto' })

  const dropped = await siu.drop(lucia, { kind: 'mesa', examBoardId: 'mesa-am1-fi-dic' })
  assert.equal(dropped.ok, true)
  const enrollments = await siu.examEnrollments(lucia)
  assert.deepEqual(enrollments, { ok: true, value: [] })
})

test('el SIU en memoria separa las inscripciones vigentes de las históricas', async () => {
  const { siu } = compose({}).ports
  const tomas = siuId('p-taguirre')
  const vigentes = await siu.courseEnrollments(tomas)
  const todas = await siu.courseEnrollments(tomas, { historic: true })
  assert.deepEqual(vigentes.ok && vigentes.value.map((e) => e.sectionId).sort(), ['sec-am1-fi-a', 'sec-pr1-fi-a'])
  assert.deepEqual(todas.ok && todas.value.map((e) => e.sectionId).sort(), ['sec-aga-fi-a', 'sec-am1-fi-a', 'sec-pr1-fi-a'])
})

test('el canal externo en memoria lee desde un cursor y no repite mensajes', async () => {
  const { externalChannel } = compose({}).ports
  const channelId = '1301000000000000002'

  const first = await externalChannel.read(channelId, null)
  assert.ok(first.ok)
  assert.equal(first.value.messages.length, 2)
  assert.equal(first.value.messages[1].threadId, first.value.messages[0].id)

  const posted = await externalChannel.post(channelId, 'Consulta desde HackAI')
  assert.ok(posted.ok)
  const second = await externalChannel.read(channelId, first.value.cursor)
  assert.deepEqual(second.ok && second.value.messages.map((m) => m.text), ['Consulta desde HackAI'])

  const third = await externalChannel.read(channelId, second.ok ? second.value.cursor : null)
  assert.deepEqual(third.ok && third.value.messages, [])
})

test('un adjunto del canal externo se baja y se guarda en archivos', async () => {
  const { externalChannel, files } = compose({}).ports
  const page = await externalChannel.read('1301000000000000003', null)
  assert.ok(page.ok)
  const attachment = page.value.messages[0].attachments[0]

  const downloaded = await externalChannel.download(attachment)
  assert.ok(downloaded.ok)
  const saved = await files.save({ name: downloaded.value.filename, contentType: downloaded.value.contentType, bytes: downloaded.value.bytes })
  assert.ok(saved.ok)
  assert.equal(saved.value.name, 'resumen-derivadas.pdf')
  assert.ok(saved.value.url.startsWith('data:application/pdf;base64,'))

  assert.deepEqual(await externalChannel.download({ ...attachment, url: 'https://vencida' }), { ok: false, error: 'adjunto-vencido' })
})

test('el aula en memoria sin matriculación ni tareas lo declara y responde «no soportado»', async () => {
  const classroom = createMemoryClassroom(syntheticData, { capabilities: { canEnrol: false, hasAssignments: false } })

  assert.deepEqual(classroom.capabilities, { canEnrol: false, hasAssignments: false })
  assert.deepEqual(await classroom.enrol('404', 'c-pr1-fi-a', 'student'), { ok: false, error: 'no-soportado' })
  assert.deepEqual(await classroom.unenrol('401', 'c-pr1-fi-a'), { ok: false, error: 'no-soportado' })
  assert.deepEqual(await classroom.assignments('c-pr1-fi-a'), { ok: false, error: 'no-soportado' })
  assert.equal((await classroom.coursesOf('401')).ok, true)
  assert.equal(classroom.courseUrl('c-pr1-fi-a'), `${syntheticData.moodle.baseUrl}/course/view.php?id=c-pr1-fi-a`)
})

test('el aula en memoria no comparte matrículas entre instancias', async () => {
  const a = createMemoryClassroom(syntheticData)
  const b = createMemoryClassroom(syntheticData)

  assert.equal((await a.enrol('404', 'c-pr1-fi-a', 'student')).ok, true)

  const inB = await b.coursesOf('404')
  assert.equal(inB.ok && inB.value.some((c) => c.id === 'c-pr1-fi-a'), false)
})
