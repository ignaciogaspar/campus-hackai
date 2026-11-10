import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePerson } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { loadSimDef } from '@/lib/sims/defs'
import { findOpenRun, listMyRuns, resolveLiveSession } from '@/lib/sims/server'
import { SimPlayer } from '@/components/sims/SimPlayer'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const def = await loadSimDef(id)
  return { title: def?.title ?? 'Simulador' }
}

export default async function SimPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ live?: string }>
}) {
  const { person } = await requirePerson('alumno')
  const { id } = await params
  const sp = await searchParams
  const def = await loadSimDef(id)
  if (!def) notFound()
  const live = await resolveLiveSession(sp.live)
  const [open, runs] = await Promise.all([findOpenRun(def.id, person.id, live), listMyRuns(def.id, person.id)])
  const history = runs.filter((r) => r.status === 'completada').map((r) => ({ score: r.score, completedAt: r.completedAt }))

  return (
    <div className="page">
      <div className="sim-head">
        <div>
          <div className="kicker"><Link href={routes.campus + '#simuladores'}>Simuladores</Link>{def.bloque ? ` · ${def.bloque}` : ''}</div>
          <h1>{def.title}</h1>
          <p className="muted chico">{def.description}</p>
        </div>
        <div className="fila">
          {def.ficticio ? <span className="badge badge-ficticio">Caso ficticio</span> : null}
          {live ? <span className="badge badge-vivo">Clase en vivo</span> : null}
          <span className="badge">~{def.minutos} min</span>
        </div>
      </div>
      <SimPlayer
        def={def}
        personId={person.id}
        firstName={person.full_name.split(' ')[0]}
        liveSessionId={live}
        initialRun={open ?? (def.kind === 'react' ? runs.find((r) => r.status === 'completada' && r.liveSessionId === live) ?? null : null)}
        history={history}
      />
    </div>
  )
}
