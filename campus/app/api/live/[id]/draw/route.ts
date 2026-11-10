import { readJson, withLive, type LiveRouteParams } from '@/lib/live/route'
import { LiveError } from '@/lib/live/session'
import { pickRandomStudent, setDrawOutcome } from '@/lib/live/students'

export const dynamic = 'force-dynamic'

const OUTCOMES = ['pendiente', 'participo', 'paso', 'ausente'] as const

/**
 * POST: sorteo desde la consola. Solo profesor.
 * - {} o {caseId?}: sortea de la ronda vigente y lo muestra
 * - {drawId, outcome}: marca el resultado (participo registra participación)
 */
export async function POST(req: Request, ctx: LiveRouteParams) {
  const body = await readJson(req)
  return withLive(ctx, { role: 'profesor', open: true }, async (live) => {
    if (typeof body.drawId === 'string') {
      const outcome = body.outcome as (typeof OUTCOMES)[number]
      if (!OUTCOMES.includes(outcome)) throw new LiveError('Resultado inválido.')
      await setDrawOutcome(live, body.drawId, outcome, 'profesor')
      return { ok: true }
    }
    return pickRandomStudent(live, { caseId: typeof body.caseId === 'string' ? body.caseId : null, drawnBy: 'profesor' })
  })
}
