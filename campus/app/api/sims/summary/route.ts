import { withSession } from '@/lib/sims/http'
import { SimError, isUuid } from '@/lib/sims/server'
import { simSummary } from '@/lib/sims/summary'

export const dynamic = 'force-dynamic'

/** GET ?simId=<id>&live=<liveSessionId> → SimSummary (anónimo: sin nombres). */
export async function GET(req: Request) {
  return withSession(async () => {
    const url = new URL(req.url)
    const simId = url.searchParams.get('simId') ?? ''
    if (!/^[a-z0-9-]{2,40}$/.test(simId)) throw new SimError('simId inválido')
    const live = url.searchParams.get('live')
    return simSummary(simId, isUuid(live) ? live : null)
  })
}
