import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError, setTranscriptEnabled } from '@/lib/live/session'

export const dynamic = 'force-dynamic'

/** POST {transcriptEnabled}: prende o apaga la transcripción de la clase. Solo profesor. */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    if (typeof body.transcriptEnabled !== 'boolean') throw new LiveError('Falta transcriptEnabled.')
    await setTranscriptEnabled(live, body.transcriptEnabled, 'profesor')
    return { transcriptEnabled: live.transcript_enabled }
  })
}
