import { getGuestKey, getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getMyResponse, getPublicPoll, pollResults, resultsVisible } from '@/lib/student/core'
import { json, jsonError } from '@/lib/student/server'

export const dynamic = 'force-dynamic'

/**
 * GET → {poll, mine, results}. `results` solo si la encuesta está cerrada o el
 * profesor está mostrando resultados (overlay poll con showResults).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params
  const client = db()
  const poll = await getPublicPoll(client, pollId)
  if (!poll) return jsonError('No encontramos esa encuesta.', 404)
  const session = await getSession()
  const guestKey = session ? null : await getGuestKey()
  const mine = session
    ? await getMyResponse(client, pollId, { personId: session.personId })
    : guestKey ? await getMyResponse(client, pollId, { guestKey }) : null
  const showResults = await resultsVisible(client, poll)
  return json({ poll, mine, results: showResults ? await pollResults(client, poll) : null })
}
