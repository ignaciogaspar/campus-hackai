/* Lo último de una conversación del espacio: lo que se deja a la vista al abrirla y al enviar. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { latestOf } from '@/components/spaces/format'
import type { Message, Thread } from '@/lib/core/spaces'

function message(id: string, personId: string, replyTo: string | null = null): Message {
  return {
    id,
    channelId: 'c-1',
    author: { personId, name: personId, role: 'alumno' },
    text: id,
    attachments: [],
    origin: 'hackai',
    externalId: null,
    status: 'publicado',
    replyTo,
    question: null,
    unread: false,
    createdAt: '2026-11-10T15:00:00.000Z'
  }
}

const thread = (m: Message, ...replies: Message[]): Thread => ({ message: m, replies })

test('sin mensajes no hay nada que dejar a la vista', () => {
  assert.equal(latestOf([], 'p-yo'), null)
})

test('lo último es el último mensaje de la lista, o su última respuesta', () => {
  const threads = [thread(message('m-1', 'p-otro')), thread(message('m-2', 'p-otro'), message('r-1', 'p-yo', 'm-2'))]
  assert.deepEqual(latestOf(threads, 'p-yo'), { id: 'r-1', mine: true })
  assert.deepEqual(latestOf(threads.slice(0, 1), 'p-yo'), { id: 'm-1', mine: false })
})

test('una respuesta en una consulta vieja no cambia lo último: queda arriba, en su tarjeta', () => {
  const threads = [thread(message('m-1', 'p-otro'), message('r-9', 'p-yo', 'm-1')), thread(message('m-2', 'p-otro'))]
  assert.deepEqual(latestOf(threads, 'p-yo'), { id: 'm-2', mine: false })
})
