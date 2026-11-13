/* El adaptador de Claude del asistente del Planning, con un cliente de mentira:
   sin red y sin gastar tokens. Mira qué se le pide a la API y cómo se lee lo que
   devuelve. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import Anthropic from '@anthropic-ai/sdk'
import { ASSISTANT_MODEL, createClaudePlanningAssistant } from '@/lib/adapters/claude/planning-assistant'

type Params = Record<string, unknown>

function fakeClient(reply: (params: Params) => unknown) {
  const calls: Params[] = []
  const client = {
    messages: {
      create: async (params: Params) => {
        calls.push(params)
        return reply(params)
      }
    }
  } as unknown as Pick<Anthropic, 'messages'>
  return { client, calls }
}

const message = (text: string, stop_reason = 'end_turn', extra: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: ASSISTANT_MODEL,
  content: [
    { type: 'thinking', thinking: '', signature: 'x' },
    { type: 'text', text }
  ],
  stop_reason,
  ...extra
})

const REQUEST = { message: 'suspendé Física I del lunes', today: 'martes 2026-11-10', catalog: '1|Física I|A|…' }

test('pide Sonnet 5.5 con esfuerzo high, salida estructurada y el listado cacheado, sin herramientas', async () => {
  const { client, calls } = fakeClient(() => message('{"altas":[],"bajas":[],"pregunta":""}'))
  const assistant = createClaudePlanningAssistant({ apiKey: 'prueba', client, log: () => {} })
  assert.deepEqual(await assistant.interpret(REQUEST), { ok: true, value: { altas: [], bajas: [], pregunta: '' } })

  const [params] = calls
  assert.equal(params.model, 'claude-sonnet-5-5')
  assert.equal(params.max_tokens, 8000)
  const config = params.output_config as { effort: string; format: { type: string; schema: { required: string[] } } }
  assert.equal(config.effort, 'high')
  assert.equal(config.format.type, 'json_schema')
  assert.deepEqual(config.format.schema.required, ['altas', 'bajas', 'pregunta'])
  assert.equal(params.tools, undefined, 'sin herramientas: no hay loop posible')
  assert.equal(params.thinking, undefined)
  const system = params.system as { text: string; cache_control?: unknown }[]
  assert.deepEqual(system[1].cache_control, { type: 'ephemeral' })
  assert.match(system[1].text, /1\|Física I/)
  const [user] = params.messages as { role: string; content: string }[]
  assert.match(user.content, /Hoy es martes 2026-11-10/)
  assert.match(user.content, /suspendé Física I del lunes/)
})

test('lee las altas y las bajas del JSON, y descarta lo que no tiene la forma del esquema', async () => {
  const altas = [
    {
      materia: 'Física I',
      comision: 'A',
      facultad: 'FI',
      sede: 'Pilar',
      edificio: 'Olivo',
      modulo: 'Módulo A',
      aula: 'Aula A9',
      dia: '',
      fecha: '2026-11-16',
      inicio: '9:00',
      fin: '13:00',
      estado: 'suspendida'
    }
  ]
  const ok = createClaudePlanningAssistant({
    apiKey: 'prueba',
    client: fakeClient(() => message(JSON.stringify({ altas, bajas: [2], pregunta: '' }))).client,
    log: () => {}
  })
  assert.deepEqual(await ok.interpret(REQUEST), { ok: true, value: { altas, bajas: [2], pregunta: '' } })

  for (const text of ['no es JSON', '{"altas":[{"materia":1}],"bajas":[],"pregunta":""}', '{"bajas":["1"]}']) {
    const bad = createClaudePlanningAssistant({
      apiKey: 'prueba',
      client: fakeClient(() => message(text)).client,
      log: () => {}
    })
    assert.deepEqual(await bad.interpret(REQUEST), { ok: false, error: 'respuesta-invalida' }, text)
  }
})

test('si el modelo se niega o la respuesta queda cortada, lo dice sin leerla', async () => {
  const refused = createClaudePlanningAssistant({
    apiKey: 'prueba',
    client: fakeClient(() => message('', 'refusal', { stop_details: { type: 'refusal', category: null } })).client,
    log: () => {}
  })
  assert.deepEqual(await refused.interpret(REQUEST), { ok: false, error: 'rechazado' })
  const cut = createClaudePlanningAssistant({
    apiKey: 'prueba',
    client: fakeClient(() => message('{"altas":[', 'max_tokens')).client,
    log: () => {}
  })
  assert.deepEqual(await cut.interpret(REQUEST), { ok: false, error: 'respuesta-invalida' })
})

test('un error de la API vuelve como falla-externa, y el log no lleva el mensaje de secretaría', async () => {
  const logs: string[] = []
  const assistant = createClaudePlanningAssistant({
    apiKey: 'prueba',
    client: fakeClient(() => {
      throw new Anthropic.APIConnectionTimeoutError()
    }).client,
    log: (line) => logs.push(line)
  })
  assert.deepEqual(await assistant.interpret(REQUEST), { ok: false, error: 'falla-externa' })
  assert.deepEqual(logs, ['[asistente] tiempo agotado'])
})
