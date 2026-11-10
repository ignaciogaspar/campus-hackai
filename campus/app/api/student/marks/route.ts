import { db } from '@/lib/db'
import { listMyMarks, toggleMark, slideMarkCounts, validLiveSessionId } from '@/lib/student/core'
import { apiSession, asDeckId, asPosition, broadcastMarksUpdated, json, jsonError, readJson } from '@/lib/student/server'
import { isMarkKind, markTotals } from '@/lib/student/types'

export const dynamic = 'force-dynamic'

/** GET ?deckId= → {marks: [{position, kind}], totals} (propias). */
export async function GET(req: Request) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const deckId = asDeckId(new URL(req.url).searchParams.get('deckId'))
  if (!deckId) return jsonError('Falta deckId.')
  const marks = await listMyMarks(db(), session.personId, deckId)
  return json({ marks, totals: markTotals(marks) })
}

/**
 * POST {deckId, position, slideId?, kind, liveSessionId?, active?} → {active, slide, totals}.
 * slideId (la slide que se estaba viendo) gana sobre position.
 * Alterna la marca (o la fuerza con `active`). En clase emite `marks.updated`.
 */
export async function POST(req: Request) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const body = await readJson(req)
  const deckId = asDeckId(body?.deckId)
  const position = asPosition(body?.position)
  const kind = body?.kind
  if (!deckId || position === null || !isMarkKind(kind)) return jsonError('Datos inválidos (deckId, position, kind).')
  const client = db()
  const liveSessionId = await validLiveSessionId(client, body?.liveSessionId, deckId)
  const result = await toggleMark(client, {
    personId: session.personId, deckId, position, slideId: typeof body?.slideId === 'string' ? body.slideId : null, kind, liveSessionId,
    active: typeof body?.active === 'boolean' ? body.active : undefined,
  })
  if (!result) return jsonError('Esa slide no existe en el deck.', 404)
  if (liveSessionId) {
    const pos = result.position ?? position
    const counts = await slideMarkCounts(client, deckId, pos, liveSessionId)
    await broadcastMarksUpdated(liveSessionId, { deckId, position: pos, counts })
  }
  return json(result)
}
