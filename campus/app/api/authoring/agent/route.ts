import { getSession } from '@/lib/auth'
import { claude } from '@/lib/claude'
import { db } from '@/lib/db'
import { runAuthoringAgent } from '@/lib/authoring/agent'
import type { AgentTurn } from '@/lib/authoring/agent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Requiere Fluid compute en Vercel (Hobby: máx. 300 s). El agente corta solo a los 240 s (AUTHORING_DEADLINE_MS). */
export const maxDuration = 300

/**
 * POST /api/authoring/agent {deckId, instruction, selectedPosition?, history?}
 * Responde NDJSON: una línea por evento.
 *   {type:'step', step:{tool, label, ok}}
 *   {type:'done', reply, proposals, steps, usage}
 *   {type:'error', error}
 * Las propuestas NO se aplican acá: el editor las manda a applyProposalAction.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'profesor') return Response.json({ error: 'Solo profesores' }, { status: 401 })
  let body: { deckId?: unknown; instruction?: unknown; selectedPosition?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const deckId = typeof body.deckId === 'string' ? body.deckId : ''
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
  if (!deckId || !instruction) return Response.json({ error: 'Faltan deckId o instruction' }, { status: 400 })
  if (instruction.length > 4000) return Response.json({ error: 'La instrucción es demasiado larga' }, { status: 400 })
  const selectedPosition = typeof body.selectedPosition === 'number' ? body.selectedPosition : null
  const history: AgentTurn[] = Array.isArray(body.history)
    ? body.history
      .filter((t): t is AgentTurn => Boolean(t) && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
      .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }))
    : []

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // si el cliente se desconectó, enqueue tira: no queremos que eso tape el error real
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`)) } catch { /* cliente desconectado */ }
      }
      try {
        const result = await runAuthoringAgent({
          sb: db(), anthropic: claude(), deckId, instruction, selectedPosition, history,
          onStep: (step) => send({ type: 'step', step }),
        })
        send({ type: 'done', ...result })
      } catch (err) {
        console.error('[autoria/agent]', err)
        send({ type: 'error', error: (err as Error).message || 'El agente falló' })
      } finally {
        try { controller.close() } catch { /* ya cerrado */ }
      }
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } })
}
