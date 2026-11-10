import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { LearningStore } from '../lib/learning/store'
import { COURSE, learningFixture, OUTSIDER, STUDENT_A, STUDENT_B, TEACHER } from './learning-fixture'

async function main() {
  const fixture = learningFixture()
  const client = createClient('http://fixture.invalid', 'fixture-service', { global: { fetch: fixture.fetch }, auth: { persistSession: false } })
  const store = new LearningStore(client, COURSE)
  const values = { takeaway: 'Mi idea personal', unclear: 'Mi duda', application: 'Un proceso concreto' }
  let checks = 0
  const ok = (condition: unknown, label: string) => { assert.ok(condition, label); checks++ }
  const rejects = async (promise: Promise<unknown>, label: string) => { await assert.rejects(promise, label); checks++ }

  await rejects(store.student(OUTSIDER), 'rechaza alumno de otro curso')
  await rejects(store.teacher(STUDENT_A, 'aicm-j1'), 'rechaza alumno en el editor docente')
  await rejects(store.saveReflection(STUDENT_A, 'other-j1', 0, values), 'rechaza jornada ajena')
  await rejects(store.saveReflection(STUDENT_A, 'aicm-j2', 0, values), 'no permite reflexionar antes del cierre')
  ok(await store.saveReflection(STUDENT_A, 'aicm-j1', 0, values) === 1, 'guarda reflexión')
  await rejects(store.saveReflection(STUDENT_A, 'aicm-j1', 0, values), 'no duplica la reflexión')
  ok((await store.student(STUDENT_B)).reflections.length === 0, 'no expone reflexión ajena')
  ok(await store.saveReflection(STUDENT_A, 'aicm-j1', 1, { ...values, takeaway: 'Nueva idea' }) === 2, 'edita reflexión')
  await rejects(store.saveReflection(STUDENT_A, 'aicm-j1', 1, values), 'detecta edición obsoleta')

  const message = { body: 'Mensaje privado A', label: 'Ver mi organización', href: '/campus/organizacion' }
  await rejects(store.saveFeedback(STUDENT_B, STUDENT_A, 'aicm-j1', 0, message, null), 'solo docentes escriben devoluciones')
  await rejects(store.saveFeedback(TEACHER, OUTSIDER, 'aicm-j1', 0, message, null), 'docente no escribe a otro curso')
  ok(await store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 0, message, null) === 1, 'guarda borrador')
  ok((await store.student(STUDENT_A)).feedback.length === 0, 'borrador no visible para alumno')
  const future = new Date(Date.now() + 86400_000).toISOString()
  ok(await store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 1, message, future) === 2, 'programa publicación')
  ok((await store.student(STUDENT_A)).feedback.length === 0, 'programada no visible antes de hora')
  ok((await store.student(STUDENT_A, Date.parse(future))).feedback.length === 1, 'visible al llegar la hora')
  await rejects(store.acknowledge(STUDENT_A, 'aicm-j1', fixture.tables.session_feedback[0].publication_id, 'read'), 'no permite marcar futura como leída')
  const publish = new Date(Date.now() - 1).toISOString()
  ok(await store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 2, message, publish) === 3, 'publica ahora')
  const visible = (await store.student(STUDENT_A)).feedback[0]
  ok(visible?.body === message.body, 'alumno ve su mensaje')
  ok(!('draft_body' in visible) && !('updated_by' in visible), 'proyección excluye campos docentes')
  ok((await store.student(STUDENT_B)).feedback.length === 0, 'otro alumno no ve el mensaje')
  await rejects(store.acknowledge(STUDENT_B, 'aicm-j1', visible.publication_id, 'read'), 'no marca mensaje ajeno')
  await store.acknowledge(STUDENT_A, 'aicm-j1', visible.publication_id, 'read')
  ok((await store.student(STUDENT_A)).feedback[0].read_at && !(await store.student(STUDENT_A)).feedback[0].applied_at, 'lectura no implica aplicación y conserva historial')
  await store.acknowledge(STUDENT_A, 'aicm-j1', visible.publication_id, 'applied')
  ok((await store.student(STUDENT_A)).feedback[0].applied_at, 'registra aplicación por separado')
  await store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 3, { ...message, body: 'Borrador nuevo' }, null)
  ok((await store.student(STUDENT_A)).feedback[0].body === message.body, 'editar borrador preserva publicación')
  await rejects(store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 3, message, publish), 'conflicto docente no pisa cambios')
  await rejects(store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 4, message, future), 'programación no oculta mensaje ya publicado')
  await store.saveFeedback(TEACHER, STUDENT_A, 'aicm-j1', 4, { ...message, body: 'Nueva publicación' }, publish)
  await rejects(store.acknowledge(STUDENT_A, 'aicm-j1', visible.publication_id, 'read'), 'no confirma versión obsoleta')
  ok(!(await store.student(STUDENT_A)).feedback[0].read_at, 'nueva publicación solicita nueva lectura')
  fixture.fail('session_reflections')
  await rejects(store.saveReflection(STUDENT_A, 'aicm-j1', 2, values), 'fallo de persistencia no informa éxito')
  await rejects(store.student(STUDENT_A), 'error de lectura no simula un historial vacío')
  console.log(`Learning flow: ${checks} checks passed (isolated PostgREST fixture).`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
