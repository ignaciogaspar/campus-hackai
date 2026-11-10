import { readJson, withSession } from '@/lib/sims/http'
import { SimError, startRun } from '@/lib/sims/server'

export const dynamic = 'force-dynamic'

/** POST {simId, liveSessionId?, fresh?, meta?} → {run, resumed}. Retoma la corrida en curso si hay. */
export async function POST(req: Request) {
  return withSession(async (session) => {
    const body = await readJson(req)
    const simId = typeof body.simId === 'string' ? body.simId : ''
    if (!/^[a-z0-9-]{2,40}$/.test(simId)) throw new SimError('simId inválido')
    const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta as Record<string, unknown> : undefined
    return startRun({
      simId,
      personId: session.personId,
      liveSessionId: typeof body.liveSessionId === 'string' ? body.liveSessionId : null,
      fresh: body.fresh === true,
      meta,
    })
  })
}
