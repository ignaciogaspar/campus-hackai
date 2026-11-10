import { readJson, withSession } from '@/lib/sims/http'
import { runForSession, saveRunState } from '@/lib/sims/server'

export const dynamic = 'force-dynamic'

/** PUT|POST {state} → {ok}. Guarda el estado serializable para retomar. */
async function handler(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  return withSession(async (session) => {
    const run = await runForSession(runId, session, 'write')
    const body = await readJson(req)
    await saveRunState(run, body.state)
    return { ok: true }
  })
}

export const PUT = handler
export const POST = handler
