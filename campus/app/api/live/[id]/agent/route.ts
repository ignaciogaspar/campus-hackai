import { runLiveAgent } from '@/lib/agent/run'
import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError } from '@/lib/live/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** POST {utterance}: orden al agente en vivo → {reply, actions, latencyMs, turnId}. Solo profesor. */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live, session) => {
    const utterance = typeof body.utterance === 'string' ? body.utterance.replace(/\s+/g, ' ').trim().slice(0, 2000) : ''
    if (!utterance) throw new LiveError('La orden está vacía.')
    return runLiveAgent(live, utterance, session.personId)
  })
}
