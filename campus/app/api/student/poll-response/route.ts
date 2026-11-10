import { ensureGuestKey, getGuestKey, getSession } from '@/lib/auth'
import { db, COURSE_ID } from '@/lib/db'
import { normName } from '@/lib/live/types'
import { clientIp, rateHit } from '@/lib/security'
import { answerPoll, getPublicPoll, resultsVisible, type Respondent } from '@/lib/student/core'
import { broadcastPollUpdated, json, jsonError, readJson } from '@/lib/student/server'

export const dynamic = 'force-dynamic'

/** Tope de invitados nuevos por IP y encuesta (un aula puede compartir la IP del wifi). */
const GUEST_PER_IP = 40
/** Tope de respuestas de invitados por encuesta. */
const GUEST_PER_POLL = 150

/**
 * POST {pollId, choice?, text?, guestName?} → {response, results}
 * Con sesión responde la persona; sin sesión, un invitado (cookie campus_guest + nombre).
 * Una respuesta por persona: si ya respondió, se reemplaza mientras la encuesta esté abierta.
 * Invitados: solo mientras la clase de la encuesta está en vivo, con tope por
 * IP y por encuesta, y sin usar el nombre de alguien del padrón.
 * `results` vuelve solo si el profesor ya los mostró (o la encuesta cerró).
 * Emite `poll.updated` (completo al profesor; a los celulares sin conteos).
 */
export async function POST(req: Request) {
  const body = await readJson(req)
  const pollId = typeof body?.pollId === 'string' ? body.pollId : ''
  if (!pollId) return jsonError('Falta pollId.')
  const client = db()
  const session = await getSession()
  let who: Respondent
  if (session) {
    who = { personId: session.personId }
  } else {
    const poll = await getPublicPoll(client, pollId)
    if (!poll) return jsonError('No encontramos esa encuesta.', 404)
    const { data: live } = poll.liveSessionId
      ? await client.from('live_sessions').select('status').eq('id', poll.liveSessionId).maybeSingle()
      : { data: null }
    if (live?.status !== 'live') return jsonError('Para responder esta encuesta ingresá al campus.', 401)
    const guestName = typeof body?.guestName === 'string' ? body.guestName : null
    if (guestName && normName(guestName)) {
      const { data: people } = await client.from('people').select('full_name').eq('course_id', COURSE_ID)
      const n = normName(guestName)
      if ((people ?? []).some((p) => normName(p.full_name as string) === n)) {
        return jsonError('Ese nombre es de alguien del curso: ingresá con tu nombre y PIN para responder.', 403)
      }
    }
    const existing = await getGuestKey()
    if (!existing) {
      // invitado nuevo (sin cookie): acá se frena el relleno con requests sin cookies
      if (!(await rateHit(`guest-poll:${await clientIp()}:${pollId}`, 3600, GUEST_PER_IP))) {
        return jsonError('Demasiadas respuestas desde esta red. Ingresá con tu nombre para responder.', 429)
      }
      const { count } = await client.from('poll_responses').select('id', { count: 'exact', head: true }).eq('poll_id', pollId).not('guest_key', 'is', null)
      if ((count ?? 0) >= GUEST_PER_POLL) return jsonError('Esta encuesta ya no acepta más invitados. Ingresá con tu nombre para responder.', 429)
    }
    who = { guestKey: existing ?? (await ensureGuestKey()), guestName }
  }
  const out = await answerPoll(client, pollId, who, { choice: body?.choice, text: body?.text })
  if (!out.ok) return jsonError(out.error, out.status)
  await broadcastPollUpdated(out.poll.liveSessionId, out.results)
  const visible = await resultsVisible(client, out.poll)
  return json({ response: out.response, results: visible ? out.results : null })
}
