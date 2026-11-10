import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError } from '@/lib/live/session'
import { saveSegment } from '@/lib/live/transcript'

export const dynamic = 'force-dynamic'

/**
 * POST {text, isCommand}: segmento final del reconocedor de voz. Se guarda
 * con la posición actual; sin transcripción encendida solo se guardan las
 * órdenes al agente. Solo profesor.
 */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    const text = typeof body.text === 'string' ? body.text : ''
    if (!text.trim()) throw new LiveError('Segmento vacío.')
    const line = await saveSegment(live, { text, isCommand: body.isCommand === true })
    return { saved: Boolean(line), line }
  })
}
