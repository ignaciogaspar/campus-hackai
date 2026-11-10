import { readJson, withSession } from '@/lib/sims/http'
import { appendEvents, runForSession } from '@/lib/sims/server'
import type { SimEventInput } from '@/lib/sims/types'

export const dynamic = 'force-dynamic'

/** POST {events:[{type, payload?, at?}]} → {saved}. */
export async function POST(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  return withSession(async (session) => {
    const run = await runForSession(runId, session, 'write')
    const body = await readJson(req)
    const saved = await appendEvents(run, (body.events ?? []) as SimEventInput[])
    return { saved }
  })
}
