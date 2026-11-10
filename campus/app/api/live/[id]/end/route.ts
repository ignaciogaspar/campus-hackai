import { withLive, type LiveRouteParams } from '@/lib/live/route'
import { endLive } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/** POST: termina la clase (cierra encuestas abiertas y avisa a todos). Solo profesor. */
export async function POST(_req: Request, ctx: LiveRouteParams) {
  return withLive(ctx, { role: 'profesor' }, async (live) => {
    await endLive(live, 'profesor')
    return { ok: true, status: 'ended' }
  })
}
