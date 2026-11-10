import { parseOverlay } from '@/lib/live/overlay-data'
import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError, setOverlay } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/** POST {overlay: Overlay | null}: pone o limpia el overlay. Solo profesor. */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    const overlay = parseOverlay(body.overlay ?? null)
    if (overlay === undefined) throw new LiveError('Overlay inválido.')
    return setOverlay(live, overlay, 'profesor')
  })
}
