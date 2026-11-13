/* El asistente del Planning con Claude (ADR 0010), por el SDK oficial de
   Anthropic. Una sola llamada por mensaje, sin herramientas ni historial: el
   modelo no ejecuta nada, solo traduce el pedido de secretaría a un JSON con un
   esquema fijo (salida estructurada). Así no hay loops ni reintentos del
   modelo sobre sí mismo.

   Para gastar poco: las instrucciones y el listado de clases van primero, como
   prefijo cacheado (`cache_control`), y lo que cambia en cada pedido (la fecha
   y el mensaje) va después, en el turno del usuario. `max_tokens` acotado y un
   tiempo máximo por llamada; el SDK reintenta solo los 429, los 5xx y las
   caídas de red. Los logs llevan el tipo de error y el código, nunca el
   mensaje de secretaría. */
import Anthropic from '@anthropic-ai/sdk'
import type {
  AssistantAnswer,
  AssistantError,
  AssistantRow,
  PlanningAssistantPort
} from '@/lib/ports/planning-assistant'
import { fail, ok, type Result } from '@/lib/result'

/** El modelo y el esfuerzo que eligió el equipo (13/11/2026). */
export const ASSISTANT_MODEL = 'claude-sonnet-5-5'
const EFFORT = 'high'

/** Alcanza para el pensamiento con esfuerzo `high` y una respuesta con varias filas. */
const MAX_TOKENS = 8000
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

const COLUMNS: (keyof AssistantRow)[] = [
  'materia',
  'comision',
  'facultad',
  'sede',
  'edificio',
  'modulo',
  'aula',
  'dia',
  'fecha',
  'inicio',
  'fin',
  'estado'
]

/** El esquema de la respuesta: salida estructurada, sin campos de más. */
const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['altas', 'bajas', 'pregunta'],
  properties: {
    altas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: COLUMNS,
        properties: Object.fromEntries(COLUMNS.map((c) => [c, { type: 'string' }]))
      }
    },
    bajas: { type: 'array', items: { type: 'integer' } },
    pregunta: { type: 'string' }
  }
}

const INSTRUCTIONS = `Sos el asistente de la secretaría académica de la Universidad Austral para el Planning de Aulas: dónde y a qué hora se dicta cada clase. Traducís el pedido de secretaría a cambios del Planning. No ejecutás nada: lo que devolvés lo revisa el sistema (choques de aula, repetidas) y lo confirma secretaría.

Devolvés tres cosas:
- "altas": clases para sumar. Cada una es semanal (completá "dia", de lunes a sabado, sin tilde, y dejá "fecha" vacía) o de un día solo (completá "fecha" en formato AAAA-MM-DD y dejá "dia" vacío). Horas en HH:MM. Lo que no aplica va vacío.
- "bajas": los números del listado de las clases que hay que sacar del Planning para siempre.
- "pregunta": si falta un dato imprescindible o el pedido es ambiguo, una pregunta breve en español rioplatense (con voseo) para secretaría; en ese caso dejá "altas" y "bajas" vacías. Si no, vacía.

Cómo traducir:
- Cambio de aula u horario de un día ("el jueves AM1 va a la A10"): un alta con "fecha", copiando materia, comisión, facultad, sede, edificio y módulo de la clase cargada, con el aula o el horario nuevo.
- Suspender la clase de un día ("suspendé", "no hay clase", "se cancela"): un alta con "fecha", el horario de la clase cargada y "estado": "suspendida". No es una baja.
- Clase extra de un día: un alta con "fecha".
- Clase nueva que se repite cada semana: un alta con "dia".
- Sacar una clase del Planning para siempre ("borrá", "sacá", "dala de baja"): una baja con su número.
- Mudar una clase semanal para siempre ("desde ahora", "pasa a"): la baja de la vieja y el alta de la nueva.
- Si el pedido nombra una clase que está en el listado (aunque sea con una sigla, como "AM1" por "Análisis Matemático I"), copiá los nombres exactos del listado: así el sistema la reconoce.
- "El viernes", "mañana" o "la semana que viene" se calculan con la fecha de hoy. Si un día sin fecha puede ser este o el siguiente, elegí el próximo que viene.
- Si hay varias clases que coinciden y no se sabe cuál es (por ejemplo, dos comisiones), preguntá. No inventes datos que no están en el pedido ni en el listado.

El listado tiene una clase por línea: número|materia|comisión|facultad|sede|edificio|módulo|aula|día o fecha|horario|estado.`

/** La respuesta, si tiene la forma del esquema. Igual se revisa: la salida del modelo nunca se usa sin validar. */
function answerOf(value: unknown): AssistantAnswer | null {
  if (typeof value !== 'object' || value === null) return null
  const { altas, bajas, pregunta } = value as Record<string, unknown>
  const isRow = (row: unknown): row is AssistantRow =>
    typeof row === 'object' &&
    row !== null &&
    COLUMNS.every((c) => typeof (row as Record<string, unknown>)[c] === 'string')
  if (!Array.isArray(altas) || !altas.every(isRow)) return null
  if (!Array.isArray(bajas) || !bajas.every((n) => Number.isInteger(n))) return null
  if (typeof pregunta !== 'string') return null
  return { altas, bajas: bajas as number[], pregunta }
}

/** El tipo de error para el log, sin datos del pedido. */
function errorLog(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return '[asistente] tiempo agotado'
  if (error instanceof Anthropic.RateLimitError) return '[asistente] límite de pedidos (429)'
  if (error instanceof Anthropic.APIError) return `[asistente] error ${error.status ?? 'sin código'}`
  return '[asistente] error inesperado'
}

/** La respuesta leída: se negó, quedó cortada o es el JSON del esquema. */
function readResponse(
  response: Anthropic.Message,
  log: (message: string) => void
): Result<AssistantAnswer, AssistantError> {
  if (response.stop_reason === 'refusal') {
    log(`[asistente] el modelo se negó (${response.stop_details?.category ?? 'sin categoría'})`)
    return fail('rechazado')
  }
  if (response.stop_reason === 'max_tokens') {
    log('[asistente] respuesta cortada por max_tokens')
    return fail('respuesta-invalida')
  }
  const text = response.content.find((block) => block.type === 'text')
  if (text?.type !== 'text') return fail('respuesta-invalida')
  try {
    const answer = answerOf(JSON.parse(text.text))
    return answer ? ok(answer) : fail('respuesta-invalida')
  } catch {
    return fail('respuesta-invalida')
  }
}

export type ClaudePlanningAssistantOptions = {
  apiKey: string
  log?: (message: string) => void
  /** Para los tests: un cliente con la misma forma que el del SDK. */
  client?: Pick<Anthropic, 'messages'>
}

export function createClaudePlanningAssistant({
  apiKey,
  log = console.warn,
  client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES })
}: ClaudePlanningAssistantOptions): PlanningAssistantPort {
  async function call(system: string, catalog: string, user: string) {
    return client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT, format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      system: [
        { type: 'text', text: system },
        { type: 'text', text: `Clases cargadas:\n${catalog || '(ninguna)'}`, cache_control: { type: 'ephemeral' } }
      ],
      messages: [{ role: 'user', content: user }]
    })
  }

  return {
    async interpret({ message, today, catalog }): Promise<Result<AssistantAnswer, AssistantError>> {
      try {
        const response = await call(INSTRUCTIONS, catalog, `Hoy es ${today}.\n\nPedido de secretaría:\n${message}`)
        return readResponse(response, log)
      } catch (error) {
        log(errorLog(error))
        return fail('falla-externa')
      }
    }
  }
}
