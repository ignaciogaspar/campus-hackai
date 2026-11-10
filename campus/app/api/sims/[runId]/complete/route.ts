import { readJson, withSession } from '@/lib/sims/http'
import { completeRun, runForSession } from '@/lib/sims/server'

export const dynamic = 'force-dynamic'

/** POST {score?, summary?, state?} → {run}. Cierra la corrida. */
export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  return withSession(async (session) => {
    const run = await runForSession(runId, session, 'write')
    const body = await readJson(req)
    return { run: await completeRun(run, body) }
  })
}
