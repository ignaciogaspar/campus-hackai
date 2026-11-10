import { db } from '@/lib/db'
import { liveByCode, liveSnapshot } from '@/lib/student/core'
import { json, jsonError } from '@/lib/student/server'

export const dynamic = 'force-dynamic'

/**
 * GET [?slides=1] → StudentLiveSnapshot {liveSessionId, code, deckId, status,
 * position, overlay, deckVersion, activePoll, slides?}. Sin notas del docente.
 * Abierto a invitados (pueden seguir la clase y responder encuestas).
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const client = db()
  const live = await liveByCode(client, code)
  if (!live) return jsonError('No hay ninguna clase con ese código.', 404)
  const withSlides = new URL(req.url).searchParams.get('slides') === '1'
  return json(await liveSnapshot(client, live, withSlides))
}
