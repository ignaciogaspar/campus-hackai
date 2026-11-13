/* El estado de una consulta en el hilo, con las mismas palabras que el Hoy del docente. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { questionState } from '@/components/spaces/format'
import type { Message, Thread } from '@/lib/core/spaces'

function message(id: string, role: 'alumno' | 'profesor' | null, question: Message['question'] = null): Message {
  return {
    id,
    channelId: 'c-1',
    author: { personId: role ? `p-${id}` : null, name: id, role },
    text: id,
    attachments: [],
    origin: 'hackai',
    externalId: null,
    status: 'publicado',
    replyTo: null,
    question,
    unread: false,
    createdAt: '2026-11-10T15:00:00.000Z'
  }
}

const open = { resolved: false }
const thread = (m: Message, ...replies: Message[]): Thread => ({ message: m, replies })

test('un mensaje que no es consulta no tiene estado', () => {
  assert.equal(questionState(thread(message('aviso', 'profesor'))), null)
})

test('una consulta sin respuestas, o con la última de un alumno, está sin responder', () => {
  assert.equal(questionState(thread(message('q', 'alumno', open))), 'sin-responder')
  assert.equal(questionState(thread(message('q', 'alumno', open), message('r', 'alumno'))), 'sin-responder')
  assert.equal(
    questionState(thread(message('q', 'alumno', open), message('r1', 'profesor'), message('r2', 'alumno'))),
    'sin-responder'
  )
  // Alguien de Discord sin cuenta vinculada no cuenta como docente.
  assert.equal(questionState(thread(message('q', 'alumno', open), message('r', null))), 'sin-responder')
})

test('con la última respuesta de un docente está respondida, y marcada resuelta, resuelta', () => {
  assert.equal(questionState(thread(message('q', 'alumno', open), message('r', 'profesor'))), 'respondida')
  assert.equal(questionState(thread(message('q', 'alumno', { resolved: true }))), 'resuelta')
})
