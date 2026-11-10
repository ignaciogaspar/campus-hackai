import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { claude, MODEL_LIVE } from '@/lib/claude'
import { db } from '@/lib/db'
import type { LiveSession } from '@/lib/db-types'
import { broadcast } from '@/lib/realtime'
import { refreshLive } from '@/lib/live/session'
import type { AgentAction, AgentResponse } from '@/lib/live/types'
import { loadAgentContext, renderContext } from './context'
import { LIVE_AGENT_SYSTEM } from './prompt'
import { LIVE_TOOLS, runTool } from './tools'

/* Loop del agente en vivo: Claude con herramientas hasta la respuesta final,
   máximo 6 vueltas y ~25 s en total. Guarda agent_turns con la latencia. */

const MAX_ITERATIONS = 6
const DEADLINE_MS = 25_000
/** Esfuerzo bajo: el profesor está esperando frente a la clase. */
const EFFORT = (process.env.LIVE_AGENT_EFFORT as 'low' | 'medium' | 'high' | undefined) ?? 'low'

type BetaMessageParam = Anthropic.Beta.BetaMessageParam
type BetaToolResult = Anthropic.Beta.BetaToolResultBlockParam

export async function runLiveAgent(live: LiveSession, utterance: string, personId: string | null): Promise<AgentResponse> {
  const started = Date.now()
  const actions: AgentAction[] = []
  let reply = ''
  let error: string | undefined
  const usage = { input: 0, output: 0, cacheRead: 0, iterations: 0 }

  try {
    const ctx = await loadAgentContext(live, utterance)
    const contextText = await renderContext(ctx)
    const messages: BetaMessageParam[] = [{
      role: 'user',
      content: [
        { type: 'text', text: contextText },
        { type: 'text', text: `Orden del profesor: «${utterance}»` },
      ],
    }]

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const remaining = DEADLINE_MS - (Date.now() - started)
      if (remaining < 1500) {
        error = 'Se acabó el tiempo del agente.'
        break
      }
      const response = await claude().beta.messages.create({
        model: MODEL_LIVE,
        max_tokens: 4096,
        system: [{ type: 'text', text: LIVE_AGENT_SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: LIVE_TOOLS,
        messages,
        output_config: { effort: EFFORT },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      }, { timeout: remaining, maxRetries: 0 })
      usage.iterations++
      usage.input += response.usage.input_tokens
      usage.output += response.usage.output_tokens
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0

      if (response.stop_reason === 'refusal') {
        error = 'El modelo no quiso ejecutar esa orden.'
        break
      }
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join(' ').trim()
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      if (text) reply = text
      if (response.stop_reason !== 'tool_use' || !toolUses.length) {
        if (response.stop_reason === 'max_tokens' && !reply) error = 'Respuesta cortada.'
        break
      }
      messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] })
      // en orden: varias acciones sobre la misma clase no se pisan
      const results: BetaToolResult[] = []
      for (const tu of toolUses) {
        const input = (tu.input && typeof tu.input === 'object' ? tu.input : {}) as Record<string, unknown>
        // el turno dura varios segundos: el profesor pudo navegar o cambiar el
        // overlay mientras tanto. Cada herramienta decide con la fila actual.
        await refreshLive(ctx.live).catch(() => undefined)
        const out = await runTool(ctx, tu.name, input)
        actions.push({ tool: tu.name, input: compactInput(input), ok: out.ok, summary: out.summary })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.result, is_error: !out.ok })
      }
      messages.push({ role: 'user', content: results })
      if (i === MAX_ITERATIONS - 1) reply = reply || 'Listo.'
    }
  } catch (err) {
    console.error('[agent]', err)
    error = err instanceof Error ? err.message : String(err)
    if (/abort|timeout|timed out/i.test(error)) error = 'El agente tardó demasiado.'
  }

  reply = oneLine(reply) || (actions.length ? actions.filter((a) => a.ok).map((a) => a.summary).join(' · ') || 'No pude hacerlo.' : error ? 'No pude hacerlo.' : 'No entendí la orden.')
  const latencyMs = Date.now() - started
  const { data: turn } = await db().from('agent_turns').insert({
    live_session_id: live.id,
    person_id: personId,
    surface: 'live',
    utterance,
    tool_calls: actions,
    reply,
    error: error ?? null,
    latency_ms: latencyMs,
  }).select('id').single()
  const turnId = (turn?.id as number | undefined) ?? null
  await broadcast(live.id, 'agent.turn', { turnId, utterance, reply, actions, latencyMs, error: error ?? null })
  if (process.env.LIVE_AGENT_DEBUG) console.log('[agent] usage', usage)
  return { reply, actions, latencyMs, turnId, error }
}

function oneLine(s: string): string {
  return s.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240)
}

/** Para guardar en agent_turns sin markdowns enormes. */
function compactInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' && v.length > 600 ? `${v.slice(0, 600)}…` : v
  return out
}
