import Link from 'next/link'
import { PollCard } from '@/components/student/PollCard'
import { getGuestKey, getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getMyResponse, getPublicPoll } from '@/lib/student/core'
import { routes } from '@/lib/routes'
import '@/components/student/student.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Encuesta' }

/** Destino del QR de una encuesta: responder con o sin login. */
export default async function PollPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params
  const client = db()
  const poll = await getPublicPoll(client, pollId)
  if (!poll || poll.status === 'draft') {
    return (
      <div className="st-ingreso">
        <h1>{poll ? 'La encuesta todavía no está abierta' : 'No encontramos esa encuesta'}</h1>
        <p className="muted">{poll ? 'Esperá a que el profesor la abra y volvé a escanear el QR.' : 'Revisá el enlace o el QR.'}</p>
      </div>
    )
  }
  const session = await getSession()
  const guestKey = session ? null : await getGuestKey()
  const mine = session
    ? await getMyResponse(client, pollId, { personId: session.personId })
    : guestKey ? await getMyResponse(client, pollId, { guestKey }) : null
  const [person, live] = await Promise.all([
    session ? client.from('people').select('full_name').eq('id', session.personId).maybeSingle().then((r) => r.data) : null,
    poll.liveSessionId ? client.from('live_sessions').select('code, status').eq('id', poll.liveSessionId).maybeSingle().then((r) => r.data) : null,
  ])

  return (
    <div className="st-encuesta">
      <div className="st-encuesta-marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="IAE Business School" height={36} />
        <span className="chico muted">{person ? `Respondés como ${person.full_name}` : 'Respondés como invitado'}</span>
      </div>
      <PollCard poll={poll} guest={!session} initialMine={mine} showResultsAfterAnswer={false} />
      {live?.status === 'live' ? (
        <p className="chico muted st-encuesta-pie">
          ¿Estás en la clase? <Link href={routes.liveStudent(live.code)}>Seguí las slides desde tu celular</Link>.
        </p>
      ) : null}
      {!session ? (
        <p className="chico muted st-encuesta-pie">¿Sos alumno del programa? <Link href={`/?next=${encodeURIComponent(routes.poll(pollId))}`}>Ingresá al campus</Link> para que la respuesta quede a tu nombre.</p>
      ) : null}
    </div>
  )
}
