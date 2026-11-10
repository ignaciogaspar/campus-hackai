import { withSession } from '@/lib/sims/http'
import { runForSession } from '@/lib/sims/server'

export const dynamic = 'force-dynamic'

/** GET → {run} (dueño o profesor). */
export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  return withSession(async (session) => ({ run: await runForSession(runId, session, 'read') }))
}
