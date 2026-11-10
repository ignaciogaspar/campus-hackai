import { db } from '@/lib/db'
import { listCohortNotes, listMyNotes, saveNote, validLiveSessionId } from '@/lib/student/core'
import { apiSession, asDeckId, asPosition, json, jsonError, readJson } from '@/lib/student/server'
import { isVisibility } from '@/lib/student/types'

export const dynamic = 'force-dynamic'

/**
 * GET ?deckId=[&position=] → {notes} (propias del deck) y, con position,
 * también {cohort} (notas que otros compartieron en esa slide).
 */
export async function GET(req: Request) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const params = new URL(req.url).searchParams
  const deckId = asDeckId(params.get('deckId'))
  if (!deckId) return jsonError('Falta deckId.')
  const client = db()
  const raw = params.get('position')
  const position = raw === null ? null : asPosition(raw)
  const notes = await listMyNotes(client, session.personId, deckId)
  if (position === null) return json({ notes })
  return json({
    notes: notes.filter((n) => n.position === position),
    cohort: await listCohortNotes(client, deckId, position, session.personId),
  })
}

/**
 * POST {deckId, position, slideId?, body, quote?, visibility?, liveSessionId?} → {note}
 * slideId (la slide que se estaba viendo al escribir) gana sobre position.
 * Upsert de la nota propia de esa slide. Vacía (sin texto ni cita) se borra → {note: null}.
 */
export async function POST(req: Request) {
  const session = await apiSession()
  if (session instanceof Response) return session
  const body = await readJson(req)
  const deckId = asDeckId(body?.deckId)
  const position = asPosition(body?.position)
  if (!deckId || position === null || typeof body?.body !== 'string') return jsonError('Datos inválidos (deckId, position, body).')
  const quote = typeof body.quote === 'string' ? body.quote : null
  const visibility = isVisibility(body.visibility) ? body.visibility : 'privada'
  const client = db()
  const liveSessionId = await validLiveSessionId(client, body.liveSessionId, deckId)
  const note = await saveNote(client, { personId: session.personId, deckId, position, slideId: typeof body.slideId === 'string' ? body.slideId : null, body: body.body, quote, visibility, liveSessionId })
  if (note === 'no-slide') return jsonError('Esa slide no existe en el deck.', 404)
  return json({ note })
}

export const PUT = POST
