// Demo en vivo de J8: un agente con tool use que consulta stock.
// Un cliente pregunta por WhatsApp; Claude pide la herramienta
// `consultar_stock`, el programa la ejecuta contra una planilla (el «ERP»)
// y Claude responde con el dato. Imprime cada request con tokens y costo.
//
// Uso (Node 22, con ANTHROPIC_API_KEY en .env.local):
//   npx tsx scripts/demo/j8-stock-agent.ts "¿Tienen 20 bombas de 1 HP para el jueves?"
//   npx tsx scripts/demo/j8-stock-agent.ts --json public/decks/aicm/media/j8/demo-log.json "…"
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import '../seed/env'

const MODEL = 'claude-sonnet-5-5'
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 } // US$ por millón de tokens, oct-2026
const CSV = resolve(__dirname, '../../public/decks/aicm/media/j8/stock.csv')

const args = process.argv.slice(2)
const jsonAt = args.indexOf('--json')
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : undefined
const question = args.join(' ') || '¿Tienen 20 bombas de 1 HP para el jueves?'

type Row = { sku: string; producto: string; deposito: string; stock: number; precio_usd: number; reposicion: string }

function readStock(): Row[] {
  const [head, ...lines] = readFileSync(CSV, 'utf8').trim().split('\n')
  const keys = head.split(',')
  return lines.map((l) => {
    const v = l.split(',')
    const o = Object.fromEntries(keys.map((k, i) => [k, v[i]]))
    return { ...o, stock: Number(o.stock), precio_usd: Number(o.precio_usd) } as Row
  })
}

function consultarStock(input: { sku: string }) {
  const rows = readStock().filter((r) => r.sku === input.sku.toUpperCase())
  if (!rows.length) return { error: `No existe el SKU ${input.sku}` }
  return { sku: rows[0].sku, producto: rows[0].producto, precio_usd: rows[0].precio_usd, depositos: rows.map((r) => ({ deposito: r.deposito, stock: r.stock })), reposicion: rows[0].reposicion }
}

const tools: Anthropic.Beta.BetaTool[] = [{
  name: 'consultar_stock',
  description: 'Devuelve el stock por depósito, el precio y la próxima reposición de un SKU del catálogo.',
  input_schema: { type: 'object', properties: { sku: { type: 'string', description: 'SKU, p. ej. BC-1HP' } }, required: ['sku'], additionalProperties: false },
  strict: true,
}]

const system = [
  'Sos el asistente de ventas por WhatsApp de una distribuidora de bombas de agua. Respondé en español rioplatense, en 2 o 3 oraciones.',
  'Catálogo (SKU · producto): BC-1HP Bomba centrífuga 1 HP · BC-2HP Bomba centrífuga 2 HP · BS-1HP Bomba sumergible 1 HP · PR-24L Presurizadora 24 L.',
  'Nunca inventes stock ni precios: consultalos siempre con consultar_stock. Hoy es martes 8/12/2026; el envío desde Pilar o Rosario tarda 1 día hábil.',
].join('\n')

const usd = (u: Anthropic.Beta.BetaUsage) =>
  (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6

export interface AgentRun { question: string; text: string; requests: Record<string, unknown>[]; usd: number }

/** Corre el ciclo de tool use para una pregunta. `quiet` no imprime el log. */
export async function runAgent(question: string, quiet = false): Promise<AgentRun> {
  const say = (s: string) => { if (!quiet) console.log(s) }
  const client = new Anthropic()
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: question }]
  const log: Record<string, unknown>[] = []
  let total = 0
  let answer = ''
  say(`\nCliente: ${question}\n`)
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now()
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      tools,
      messages,
    })
    const ms = Date.now() - t0
    const cost = usd(res.usage)
    total += cost
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')
    say(`── request ${i} · ${ms} ms · stop_reason=${res.stop_reason} · in=${res.usage.input_tokens} out=${res.usage.output_tokens} · US$${cost.toFixed(5)}`)
    log.push({ request: i, ms, stop_reason: res.stop_reason, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens }, usd: Number(cost.toFixed(5)), tool_use: calls.map((c) => ({ name: c.name, input: c.input })), text: text || undefined })
    messages.push({ role: 'assistant', content: res.content })
    if (res.stop_reason !== 'tool_use') {
      if (res.stop_reason === 'refusal') say('   (el modelo declinó)')
      say(`\nBot: ${text}\n`)
      answer = text
      break
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = calls.map((c) => {
      const out = consultarStock(c.input as { sku: string })
      say(`   tool_use ${c.name}(${JSON.stringify(c.input)}) → ${JSON.stringify(out)}`)
      const last = log[log.length - 1]
      last.tool_result = [...((last.tool_result as unknown[] | undefined) ?? []), out]
      return { type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out), is_error: 'error' in out }
    })
    messages.push({ role: 'user', content: results })
  }
  say(`Total: US$${total.toFixed(5)} por consulta · ${MODEL}`)
  return { question, text: answer, requests: log, usd: Number(total.toFixed(5)) }
}

async function main() {
  const run = await runAgent(question)
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ model: MODEL, fecha: new Date().toISOString().slice(0, 10), ...run }, null, 2) + '\n')
}

if (require.main === module) main().catch((e) => {
  if (e instanceof Anthropic.AuthenticationError) console.error('Falta ANTHROPIC_API_KEY válida en .env.local')
  else if (e instanceof Anthropic.APIError) console.error(`Error de la API ${e.status}: ${e.message}`)
  else console.error(e)
  process.exit(1)
})
