import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFixedClock } from '@/lib/adapters/memoria/clock'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemoryPlanningAssistant } from '@/lib/adapters/memoria/planning-assistant'
import { createMemoryPlanningStore } from '@/lib/adapters/memoria/planning-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createPeople } from '@/lib/core/people'
import { createPlanning, type PlanningEntryInput } from '@/lib/core/planning'
import { DAILY_LIMIT, MAX_MESSAGE_CHARS } from '@/lib/core/planning/assistant'
import type { AssistantAnswer, AssistantError, AssistantRow } from '@/lib/ports/planning-assistant'
import type { Result } from '@/lib/result'

function value<T>(result: Result<T, string>): T {
  if (!result.ok) assert.fail(`se esperaba ok y vino ${result.error}`)
  return result.value
}

const SECRETARIA = 'p-secretaria-fi'

const FISICA: PlanningEntryInput = {
  subject: 'Física I',
  section: 'A',
  school: 'FI',
  campus: 'Pilar',
  building: 'Olivo',
  wing: 'Módulo A',
  room: 'Aula A9',
  weekday: 'lunes',
  date: null,
  start: 540,
  end: 780,
  cancelled: false
}

const QUIMICA: PlanningEntryInput = { ...FISICA, subject: 'Química', room: 'Aula A10', weekday: 'martes' }

const row = (overrides: Partial<AssistantRow>): AssistantRow => ({
  materia: 'Física I',
  comision: 'A',
  facultad: 'FI',
  sede: 'Pilar',
  edificio: 'Olivo',
  modulo: 'Módulo A',
  aula: 'Aula A9',
  dia: '',
  fecha: '',
  inicio: '9:00',
  fin: '13:00',
  estado: '',
  ...overrides
})

const answer = (a: Partial<AssistantAnswer>): AssistantAnswer => ({ altas: [], bajas: [], pregunta: '', ...a })

function build(
  answers: Record<string, AssistantAnswer | AssistantError>,
  entries = [FISICA, QUIMICA],
  withAssistant = true
) {
  const clock = createFixedClock(syntheticData.now)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu: createMemorySiu(syntheticData, clock),
    store: createMemoryPeopleStore(syntheticData)
  })
  const port = createMemoryPlanningAssistant(answers)
  const planning = createPlanning({
    people,
    store: createMemoryPlanningStore(entries),
    assistant: withAssistant ? { port, clock } : undefined
  })
  return { planning, port }
}

test('solo secretaría usa el asistente: a nadie más se le llama al modelo', async () => {
  const { planning, port } = build({ hola: answer({}) })
  assert.deepEqual(await planning.interpret('p-taguirre', 'hola'), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await planning.interpret('p-mledesma', 'hola'), { ok: false, error: 'solo-secretaria' })
  assert.deepEqual(await planning.interpret('p-fantasma', 'hola'), { ok: false, error: 'persona-desconocida' })
  assert.deepEqual(await planning.apply('p-taguirre', [], []), { ok: false, error: 'solo-secretaria' })
  assert.equal(port.requests.length, 0, 'ninguna llamada al modelo')
})

test('sin asistente configurado o con el mensaje vacío, no llama al modelo', async () => {
  const off = build({}, [FISICA], false)
  assert.equal(off.planning.assistantEnabled, false)
  assert.deepEqual(await off.planning.interpret(SECRETARIA, 'hola'), { ok: false, error: 'sin-asistente' })
  const on = build({})
  assert.equal(on.planning.assistantEnabled, true)
  assert.deepEqual(await on.planning.interpret(SECRETARIA, '   '), { ok: false, error: 'mensaje-vacio' })
  assert.equal(on.port.requests.length, 0)
})

test('al modelo le llega el mensaje recortado, el día de hoy y lo cargado con números cortos, sin los ids', async () => {
  const long = `suspendé Física ${'x'.repeat(2000)}`
  const { planning, port } = build({ [long.slice(0, MAX_MESSAGE_CHARS)]: answer({ pregunta: '¿Qué día?' }) })
  value(await planning.interpret(SECRETARIA, long))
  const [request] = port.requests
  assert.equal(request.message.length, MAX_MESSAGE_CHARS)
  assert.equal(request.today, 'martes 2026-11-10')
  assert.equal(
    request.catalog,
    [
      '1|Física I|A|FI|Pilar|Olivo|Módulo A|Aula A9|lunes|9:00-13:00|',
      '2|Química|A|FI|Pilar|Olivo|Módulo A|Aula A10|martes|9:00-13:00|'
    ].join('\n')
  )
})

test('una suspensión propuesta se chequea como una planilla y se guarda al confirmarla', async () => {
  const message = 'suspendé Física I del lunes 16'
  const { planning } = build({
    [message]: answer({ altas: [row({ fecha: '2026-11-16', estado: 'suspendida' })] })
  })
  const proposal = value(await planning.interpret(SECRETARIA, message))
  assert.equal(proposal.question, null)
  assert.deepEqual(proposal.preview.counts, { ok: 1, duplicates: 0, errors: 0 })
  assert.deepEqual(proposal.removals, [])
  assert.equal(proposal.remaining, DAILY_LIMIT - 1)

  assert.deepEqual(await planning.apply(SECRETARIA, proposal.rows, []), {
    ok: true,
    value: { saved: 1, removed: 0, duplicates: 0 }
  })
  const day = value(await planning.classes('2026-11-16', '2026-11-16'))
  assert.deepEqual(
    day.map((c) => [c.subject, c.change]),
    [['Física I', 'suspendida']]
  )
})

test('mudar una clase para siempre es una baja y un alta en la misma aula y hora, sin chocar consigo misma', async () => {
  const message = 'Física I pasa a la Aula B2 desde ahora'
  const { planning } = build({
    [message]: answer({ bajas: [1], altas: [row({ dia: 'lunes', aula: 'Aula B2' })] })
  })
  const proposal = value(await planning.interpret(SECRETARIA, message))
  assert.deepEqual(
    proposal.removals.map((e) => [e.subject, e.room]),
    [['Física I', 'Aula A9']]
  )
  assert.equal(proposal.preview.counts.errors, 0)
  const saved = await planning.apply(
    SECRETARIA,
    proposal.rows,
    proposal.removals.map((e) => e.id)
  )
  assert.deepEqual(saved, { ok: true, value: { saved: 1, removed: 1, duplicates: 0 } })
  assert.deepEqual(
    value(await planning.entries()).map((e) => [e.subject, e.room]),
    [
      ['Física I', 'Aula B2'],
      ['Química', 'Aula A10']
    ]
  )
})

test('lo que choca se muestra con su motivo y no se guarda', async () => {
  const message = 'agregá Termodinámica los martes en la A10'
  const { planning } = build({
    [message]: answer({ altas: [row({ materia: 'Termodinámica', dia: 'martes', aula: 'Aula A10' })] })
  })
  const proposal = value(await planning.interpret(SECRETARIA, message))
  assert.equal(proposal.preview.counts.errors, 1)
  assert.deepEqual(await planning.apply(SECRETARIA, proposal.rows, []), { ok: false, error: 'con-errores' })
  assert.equal(value(await planning.entries()).length, 2)
})

test('una pregunta del asistente no propone cambios; un número que no está en el listado no se usa', async () => {
  const { planning } = build({
    'borrá Física': answer({ pregunta: '¿De qué comisión?', bajas: [1] }),
    'borrá la 9': answer({ bajas: [9] })
  })
  const asked = value(await planning.interpret(SECRETARIA, 'borrá Física'))
  assert.equal(asked.question, '¿De qué comisión?')
  assert.deepEqual([asked.rows, asked.removals], [[], []])
  assert.deepEqual(await planning.interpret(SECRETARIA, 'borrá la 9'), { ok: false, error: 'no-entendi' })
})

test('si el asistente falla, se niega o responde algo que no se puede usar, lo dice', async () => {
  const { planning } = build({ a: 'falla-externa', b: 'rechazado', c: 'respuesta-invalida' })
  assert.deepEqual(await planning.interpret(SECRETARIA, 'a'), { ok: false, error: 'asistente-caido' })
  assert.deepEqual(await planning.interpret(SECRETARIA, 'b'), { ok: false, error: 'asistente-rechazo' })
  assert.deepEqual(await planning.interpret(SECRETARIA, 'c'), { ok: false, error: 'no-entendi' })
})

test(`hay un tope de ${DAILY_LIMIT} pedidos por día: el siguiente no llega al modelo`, async () => {
  const { planning, port } = build({ hola: answer({ pregunta: '¿Qué necesitás?' }) })
  for (let i = 0; i < DAILY_LIMIT; i++) value(await planning.interpret(SECRETARIA, 'hola'))
  assert.deepEqual(await planning.interpret(SECRETARIA, 'hola'), { ok: false, error: 'tope-diario' })
  assert.equal(port.requests.length, DAILY_LIMIT)
})

test('confirmar una baja de una clase que ya no está no cambia nada', async () => {
  const { planning } = build({})
  assert.deepEqual(await planning.apply(SECRETARIA, [], ['no-existe']), { ok: false, error: 'clase-desconocida' })
  assert.deepEqual(await planning.apply(SECRETARIA, [], []), { ok: false, error: 'sin-cambios' })
  assert.equal(value(await planning.entries()).length, 2)
})
