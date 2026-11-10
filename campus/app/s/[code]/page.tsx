import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { RosterEntry } from '@/components/auth/LoginForms'
import { LiveStudent } from '@/components/student/LiveStudent'
import { QuickJoin } from '@/components/student/QuickJoin'
import { getSession } from '@/lib/auth'
import { COURSE_ID, db } from '@/lib/db'
import { liveByCode, liveSnapshot, listMyMarks, listMyNotes } from '@/lib/student/core'
import '@/components/student/student.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clase en vivo' }

export default async function StudentLivePage({ params, searchParams }: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ invitado?: string }>
}) {
  const { code: raw } = await params
  const { invitado } = await searchParams
  const code = raw.toUpperCase()
  if (code !== raw) redirect(`/s/${code}${invitado ? '?invitado=1' : ''}`)
  const client = db()
  const live = await liveByCode(client, code)
  if (!live) {
    return (
      <div className="st-ingreso">
        <h1>No encontramos la clase {code}</h1>
        <p className="muted">Revisá el código en la pantalla del aula.</p>
        <Link className="btn btn-primario" href="/s">Probar con otro código</Link>
      </div>
    )
  }
  const { data: deck } = await client.from('decks').select('title, kind, html_url').eq('id', live.deck_id).maybeSingle()
  const deckTitle = deck?.title ?? 'Clase'
  const session = await getSession()

  if (!session && !invitado) {
    const { data } = await client.from('people').select('id, full_name, company')
      .eq('course_id', COURSE_ID).eq('role', 'alumno').order('full_name')
    const roster: RosterEntry[] = (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name, company: p.company }))
    return <QuickJoin code={code} roster={roster} deckTitle={deckTitle} />
  }

  const [snap, me, marks, notes, cs] = await Promise.all([
    liveSnapshot(client, live, true),
    session ? client.from('people').select('id, full_name').eq('id', session.personId).maybeSingle().then((r) => r.data) : null,
    session ? listMyMarks(client, session.personId, live.deck_id) : [],
    session ? listMyNotes(client, session.personId, live.deck_id) : [],
    client.from('class_sessions').select('ordinal, block').eq('deck_id', live.deck_id).maybeSingle().then((r) => r.data),
  ])
  const jornada = cs ? `Jornada ${cs.ordinal}${cs.block ? ` · ${cs.block}` : ''}` : undefined

  return (
    <LiveStudent
      initial={{ ...snap, slides: snap.slides ?? [] }}
      deckTitle={deckTitle}
      contexto={jornada ? { materia: 'AI-Centric Management', jornada } : undefined}
      me={me ? { personId: me.id, name: me.full_name } : null}
      initialMarks={marks}
      initialNotes={notes}
      htmlUrl={deck?.kind === 'html' ? (deck.html_url as string | null) : null}
    />
  )
}
