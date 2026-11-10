import { activePollId, pollSnapshot } from '@/lib/live/polls'
import { withLive, type LiveRouteParams } from '@/lib/live/route'
import { recentDraws } from '@/lib/live/students'
import { recentTranscript, recentTurns } from '@/lib/live/transcript'
import type { ConsoleSnapshot } from '@/lib/live/types'

export const dynamic = 'force-dynamic'

/** GET: panel lateral del profesor (transcript, turnos del agente, encuesta activa, sorteos). */
export async function GET(_req: Request, ctx: LiveRouteParams) {
  return withLive(ctx, { role: 'profesor' }, async (live): Promise<ConsoleSnapshot> => {
    const pollId = await activePollId(live)
    const [transcript, turns, activePoll, draws] = await Promise.all([
      recentTranscript(live.id, { limit: 40 }),
      recentTurns(live.id, 8),
      pollId ? pollSnapshot(pollId) : Promise.resolve(null),
      recentDraws(live),
    ])
    return { transcript, turns, activePoll, draws: draws.draws, round: draws.round }
  })
}
