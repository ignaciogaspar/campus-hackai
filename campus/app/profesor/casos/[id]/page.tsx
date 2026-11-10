import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requireSession } from '@/lib/auth'
import { drawAction, projectPosturesAction } from '@/lib/classroom/actions'
import { getCaseTeacherView } from '@/lib/classroom/cases'
import { activeLiveSession } from '@/lib/classroom/live'
import { currentRound } from '@/lib/classroom/participation'
import { CASE_STATUS_LABEL, CONFIDENCE_LABEL, caseStatus } from '@/lib/classroom/types'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { DrawCard } from '@/components/classroom/DrawCard'
import { Flash } from '@/components/classroom/Flash'
import { PostureBars } from '@/components/classroom/PostureBars'
import { SubmitButton } from '@/components/classroom/SubmitButton'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const view = await getCaseTeacherView((await params).id)
  return { title: view ? `Caso · ${view.caso.title}` : 'Caso' }
}

export default async function CasoProfesor({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireSession('profesor')
  const { id } = await params
  const sp = await searchParams
  const view = await getCaseTeacherView(id)
  if (!view) notFound()
  const { caso, distribution, byPosture, missing } = view
  const [live, round] = await Promise.all([activeLiveSession(caso.class_session_id), currentRound()])
  const draw = sp.draw ? round.drawn.find((d) => d.drawId === sp.draw) : undefined
  const back = routes.profesorCaso(caso.id)
  const st = caseStatus(caso)
  const projecting = live?.overlay?.type === 'postures' && live.overlay.caseId === caso.id

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href={routes.profesorCasos} className="chico">← Casos</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Caso{caso.protagonist ? ` · ${caso.protagonist}` : ''}</div>
          <h1>{caso.title}</h1>
          <div className="fila" style={{ marginTop: 8 }}>
            <span className={`badge${st === 'abierto' ? ' badge-ok' : ''}`}>{CASE_STATUS_LABEL[st]}</span>
            {caso.is_fictional ? <span className="badge badge-ficticio">Caso ficticio</span> : null}
            {live ? <span className="badge badge-vivo">Clase en vivo · {live.code}</span> : null}
            <Link className="chico" href={routes.campusCaso(caso.id)}>Ver como alumno</Link>
          </div>
        </div>
        <form action={projectPosturesAction}>
          <input type="hidden" name="caseId" value={caso.id} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton className={`btn ${live ? 'btn-accion' : ''}`} pending="Proyectando…" title={live ? `Clase ${live.code}` : 'No hay clase en vivo'}>
            {projecting ? 'Se está proyectando · volver a enviar' : 'Proyectar en la clase en vivo'}
          </SubmitButton>
        </form>
      </div>

      <div className="stack">
        <Flash aviso={sp.aviso} error={sp.error} />
        {draw ? <DrawCard draw={draw} back={`${back}?draw=${draw.drawId}`} canProject={!!live} postureLabel={byPosture.find((b) => b.entries.some((e) => e.personId === draw.personId))?.posture.label} /> : null}
      </div>

      <section className="seccion cl-dos">
        <div className="card stack">
          <div>
            <h2 style={{ fontSize: 18 }}>Distribución</h2>
            <p className="cl-pregunta" style={{ margin: 0 }}>{caso.question}</p>
          </div>
          <PostureBars counts={distribution.counts} total={distribution.total} showConfidence />
          <p className="muted chico" style={{ margin: 0 }}>{distribution.total} de {distribution.roster} tomaron postura.</p>
        </div>
        <div className="card stack">
          <h2 style={{ fontSize: 18, margin: 0 }}>Sortear dentro de una postura</h2>
          <p className="muted chico" style={{ margin: 0 }}>Sin repetir dentro de la ronda vigente ({round.drawn.length} sorteados de {round.total}). El resultado se registra en participación.</p>
          <div className="stack" style={{ gap: 8 }}>
            {byPosture.map(({ posture, entries }) => (
              <form key={posture.id} action={drawAction} className="fila" style={{ justifyContent: 'space-between' }}>
                <input type="hidden" name="caseId" value={caso.id} />
                <input type="hidden" name="postureId" value={posture.id} />
                <input type="hidden" name="back" value={back} />
                {live ? <input type="hidden" name="liveSessionId" value={live.id} /> : null}
                <span className="chico"><strong>{posture.label}</strong> · {entries.length}</span>
                <span className="fila">
                  {live ? <label className="cl-check chico"><input type="checkbox" name="showOnLive" value="1" defaultChecked /> proyectar</label> : null}
                  <SubmitButton className="btn btn-sm" pending="Sorteando…">Sortear</SubmitButton>
                </span>
              </form>
            ))}
          </div>
          <Link href={routes.participacion} className="chico">Ver la ronda completa →</Link>
        </div>
      </section>

      <section className="seccion">
        <h2>Justificaciones por postura</h2>
        <div className="grid">
          {byPosture.map(({ posture, entries }) => (
            <div key={posture.id} className="card cl-postura-col">
              <div>
                <h3 style={{ fontSize: 16 }}>{posture.label} <span className="muted chico">· {entries.length}</span></h3>
                {posture.description ? <p className="muted chico" style={{ margin: 0 }}>{posture.description}</p> : null}
              </div>
              {entries.length === 0 ? <p className="muted chico">Nadie eligió esta postura.</p> : entries.map((e) => (
                <div key={e.personId} className="cl-just">
                  <div className="cl-just-meta"><strong>{e.name}</strong>{e.company ? ` · ${e.company}` : ''} · confianza {e.confidence ?? '—'}{e.confidence ? ` (${CONFIDENCE_LABEL[e.confidence]})` : ''} · {fechaHora(e.updatedAt)}</div>
                  <p>{e.justification}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="seccion">
        <h2>Quién no tomó postura · {missing.length}</h2>
        {missing.length === 0 ? <div className="vacio">Toda la cohorte tomó postura.</div> : (
          <div className="cl-chips">
            {missing.map((m) => <span key={m.personId} className="cl-chip" title={m.company ?? undefined}>{m.name}</span>)}
          </div>
        )}
      </section>

      {caso.teacher_notes ? (
        <section className="seccion">
          <h2>Notas del docente</h2>
          <div className="card cl-caso-cuerpo"><ReactMarkdown remarkPlugins={[remarkGfm]}>{caso.teacher_notes}</ReactMarkdown></div>
        </section>
      ) : null}

      <section className="seccion">
        <details className="card cl-detalle">
          <summary>Texto del caso</summary>
          <div className="cl-caso-cuerpo">
            {caso.summary ? <p><strong>{caso.summary}</strong></p> : null}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{caso.body_md}</ReactMarkdown>
          </div>
        </details>
      </section>
    </div>
  )
}
