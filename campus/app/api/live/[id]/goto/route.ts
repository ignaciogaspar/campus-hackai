import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError, setPosition } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/** POST {position} (0-based) o {delta}: cambia la slide visible. Solo profesor. */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    const position = typeof body.position === 'number' ? body.position
      : typeof body.delta === 'number' ? live.current_position + body.delta
        : null
    if (position === null) throw new LiveError('Falta position o delta.')
    return setPosition(live, position, 'profesor')
  })
}
