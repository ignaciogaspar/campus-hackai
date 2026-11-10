import { closePoll, openSlidePoll, showPollResults } from '@/lib/live/polls'
import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/**
 * POST: encuestas desde la consola. Solo profesor.
 * - {action:'open', position?}  abre la encuesta de la slide :::encuesta (default: la actual)
 * - {action:'results', pollId?} muestra resultados · {action:'hide', pollId?} vuelve al QR
 * - {action:'close', pollId?}   cierra
 */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  const action = typeof body.action === 'string' ? body.action : 'open'
  const pollId = typeof body.pollId === 'string' ? body.pollId : null
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    if (action === 'open') return openSlidePoll(live, typeof body.position === 'number' ? body.position : null, 'profesor')
    if (action === 'results') return showPollResults(live, pollId, true, 'profesor')
    if (action === 'hide') return showPollResults(live, pollId, false, 'profesor')
    if (action === 'close') return closePoll(live, pollId, 'profesor')
    throw new LiveError(`Acción desconocida: ${action}`)
  })
}
