import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { deleteParticipationAction, drawAction, logParticipationAction, resetRoundAction } from '@/lib/classroom/actions'
import { listCases } from '@/lib/classroom/cases'
import { activeLiveSession } from '@/lib/classroom/live'
import { cleanNote, cohortParticipation, currentRound, recentParticipation } from '@/lib/classroom/participation'
import {
  DRAW_OUTCOME_LABEL, PARTICIPATION_KINDS, PARTICIPATION_KIND_LABEL, QUALITY_LABEL,
} from '@/lib/classroom/types'
import { getClassSessions } from '@/lib/course'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { DrawCard } from '@/components/classroom/DrawCard'
import { Flash } from '@/components/classroom/Flash'
import { SubmitButton } from '@/components/classroom/SubmitButton'
import '@/components/classroom/classroom.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Participación' }

const BACK = routes.participacion

export default async function Participacion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession('profesor')
  const sp = await searchParams
  const [round, cases, sessions, live, cohort, log] = await Promise.all([
    currentRound(),
    listCases(),
    getClassSessions(),
    activeLiveSession(),
    cohortParticipation(),
    recentParticipation(undefined, 40),
  ])
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const liveSession = live?.classSessionId ? sessionById.get(live.classSessionId) : undefined
  // El sorteo a mostrar: el pedido por ?draw= o el último pendiente de la ronda.
  const draw = (sp.draw ? round.drawn.find((d) => d.drawId === sp.draw) : undefined) ?? round.drawn.find((d) => d.outcome === 'pendiente')
  const caseById = new Map(cases.map((c) => [c.id, c]))
  const sorted = [...cohort].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'es'))
  const alumnos = [...cohort].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Aula</div>
          <h1>Randomizador y participación</h1>
          <p className="muted chico">
            {live ? <>Clase en vivo <strong>{live.code}</strong>{liveSession ? ` · J${liveSession.ordinal}` : ''}: los sorteos y registros quedan asociados a esa clase.</> : 'No hay clase en vivo: los sorteos se registran igual, sin clase asociada.'}
          </p>
        </div>
        <a className="btn" href="/api/classroom/participation/csv">Exportar CSV</a>
      </div>

      <div className="stack">
        <Flash aviso={sp.aviso} error={sp.error} />
        {draw ? <DrawCard draw={draw} back={`${BACK}?draw=${draw.drawId}`} canProject={!!live} postureLabel={null} /> : null}
      </div>

      <section className="seccion cl-dos">
        <form action={drawAction} className="card form" aria-labelledby="sortear-h">
          <h2 id="sortear-h" style={{ fontSize: 18, margin: 0 }}>Sortear</h2>
          <input type="hidden" name="back" value={BACK} />
          {live ? <input type="hidden" name="liveSessionId" value={live.id} /> : null}
          <label className="field">
            <span>Entre quienes tomaron postura</span>
            <select className="select" name="casePosture" defaultValue="">
              <option value="">Toda la cohorte</option>
              {cases.map((c) => (
                <optgroup key={c.id} label={c.title}>
                  {c.postures.map((p) => <option key={p.id} value={`${c.id}::${p.id}`}>{p.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="cl-check"><input type="checkbox" name="onlyNew" value="1" /> Solo quienes no participaron todavía</label>
          <label className="field">
            <span>…en la jornada</span>
            <select className="select" name="classSessionId" defaultValue={live?.classSessionId ?? ''}>
              <option value="">Todo el curso</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>J{s.ordinal} · {s.title}</option>)}
            </select>
            <span className="ayuda">La jornada solo se usa con el filtro de "no participaron".</span>
          </label>
          {live ? <label className="cl-check"><input type="checkbox" name="showOnLive" value="1" defaultChecked /> Mostrarlo en el proyector</label> : null}
          <div><SubmitButton className="btn btn-accion" pending="Sorteando…">Sortear sin repetir</SubmitButton></div>
        </form>

        <div className="card stack" aria-labelledby="ronda-h">
          <div>
            <h2 id="ronda-h" style={{ fontSize: 18, margin: 0 }}>Ronda vigente</h2>
            <p className="muted chico" style={{ margin: 0 }}>
              Desde el {fechaHora(round.round.startedAt)}{round.round.reason ? ` · ${round.round.reason}` : ''} · salieron {round.total - round.pending.length} de {round.total}
            </p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Ya salieron</div>
            {round.drawn.length === 0 ? <p className="muted chico">Nadie todavía.</p> : (
              <div className="cl-chips">
                {round.drawn.map((d) => (
                  <span key={d.drawId} className={`cl-chip${d.outcome === 'participo' ? ' cl-chip--hecho' : d.outcome === 'paso' ? ' cl-chip--paso' : d.outcome === 'ausente' ? ' cl-chip--ausente' : ''}`} title={`${DRAW_OUTCOME_LABEL[d.outcome]} · ${fechaHora(d.createdAt)}${d.caseId ? ` · ${caseById.get(d.caseId)?.title ?? d.caseId}` : ''}${d.drawnBy === 'agent' ? ' · lo sorteó el agente' : ''}`}>
                    {d.name} · {DRAW_OUTCOME_LABEL[d.outcome]}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Todavía no salieron · {round.pending.length}</div>
            {round.pending.length === 0 ? <p className="muted chico">Salieron todos. Reiniciá la ronda para volver a empezar.</p> : (
              <div className="cl-chips">{round.pending.map((p) => <span key={p.personId} className="cl-chip">{p.name}</span>)}</div>
            )}
          </div>
          <form action={resetRoundAction} className="fila">
            <input type="hidden" name="back" value={BACK} />
            <input className="input" name="reason" placeholder="Motivo (ej.: empieza la J3)" maxLength={200} style={{ flex: '1 1 200px', width: 'auto' }} aria-label="Motivo del reinicio" />
            <SubmitButton className="btn" pending="Reiniciando…">Reiniciar ronda</SubmitButton>
          </form>
        </div>
      </section>

      <section className="seccion">
        <form action={logParticipationAction} className="card form" aria-labelledby="registrar-h">
          <h2 id="registrar-h" style={{ fontSize: 18, margin: 0 }}>Registrar participación</h2>
          <input type="hidden" name="back" value={BACK} />
          {live ? <input type="hidden" name="liveSessionId" value={live.id} /> : null}
          <div className="cl-dos">
            <label className="field">
              <span>Alumno</span>
              <select className="select" name="personId" required defaultValue="">
                <option value="" disabled>Elegí…</option>
                {alumnos.map((a) => <option key={a.personId} value={a.personId}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Jornada</span>
              <select className="select" name="classSessionId" defaultValue={live?.classSessionId ?? ''}>
                <option value="">Sin jornada</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>J{s.ordinal} · {s.title}</option>)}
              </select>
            </label>
          </div>
          <div className="cl-dos">
            <label className="field">
              <span>Tipo</span>
              <select className="select" name="kind" defaultValue="intervencion">
                {PARTICIPATION_KINDS.map((k) => <option key={k} value={k}>{PARTICIPATION_KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Calidad</span>
              <select className="select" name="quality" defaultValue="2">
                <option value="">Sin calificar</option>
                {[1, 2, 3].map((q) => <option key={q} value={q}>{q} · {QUALITY_LABEL[q]}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Nota</span>
            <input className="input" name="note" maxLength={500} placeholder="Qué aportó (opcional)" />
          </label>
          <div><SubmitButton pending="Guardando…">Registrar</SubmitButton></div>
        </form>
      </section>

      <section className="seccion" aria-labelledby="cohorte-h">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2 id="cohorte-h" style={{ fontSize: 18, margin: 0 }}>Cohorte · base para la nota de participación</h2>
          <a className="btn btn-sm" href="/api/classroom/participation/csv">Exportar CSV</a>
        </div>
        <p className="muted chico">Puntos = suma de calidades (un registro sin calidad vale 1). Las columnas J1…J8 cuentan registros por jornada.</p>
        <div className="tabla-scroll">
          <table className="tabla cl-tabla-compacta">
            <thead>
              <tr>
                <th>Alumno</th>
                <th className="cl-num">Puntos</th>
                <th className="cl-num">Total</th>
                <th className="cl-num">Calidad</th>
                {PARTICIPATION_KINDS.map((k) => <th key={k} className="cl-num">{PARTICIPATION_KIND_LABEL[k]}</th>)}
                {sessions.map((s) => <th key={s.id} className="cl-num" title={s.title}>J{s.ordinal}</th>)}
                <th className="cl-num" title="Sorteos: participó / pasó / ausente">Sorteos P/Pa/A</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.personId}>
                  <td><strong>{r.name}</strong>{r.company ? <div className="muted chico">{r.company}</div> : null}</td>
                  <td className="cl-num"><strong>{r.points}</strong></td>
                  <td className="cl-num">{r.total}</td>
                  <td className="cl-num">{r.avgQuality ?? '—'}</td>
                  {PARTICIPATION_KINDS.map((k) => <td key={k} className="cl-num">{r.byKind[k] || ''}</td>)}
                  {sessions.map((s) => <td key={s.id} className="cl-num">{r.bySession[s.id] || ''}</td>)}
                  <td className="cl-num">{r.draws.participo}/{r.draws.paso}/{r.draws.ausente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="seccion" aria-labelledby="registro-h">
        <h2 id="registro-h">Últimos registros</h2>
        {log.length === 0 ? <div className="vacio">Todavía no hay participaciones registradas.</div> : (
          <div className="tabla-scroll">
            <table className="tabla cl-tabla-compacta">
              <thead>
                <tr><th>Cuándo</th><th>Alumno</th><th>Jornada</th><th>Tipo</th><th>Calidad</th><th>Nota</th><th>Origen</th><th /></tr>
              </thead>
              <tbody>
                {log.map((p) => {
                  const s = p.class_session_id ? sessionById.get(p.class_session_id) : undefined
                  return (
                    <tr key={p.id}>
                      <td className="chico">{fechaHora(p.created_at)}</td>
                      <td>{p.name}</td>
                      <td>{s ? `J${s.ordinal}` : '—'}</td>
                      <td>{PARTICIPATION_KIND_LABEL[p.kind] ?? p.kind}</td>
                      <td>{p.quality ? `${p.quality} · ${QUALITY_LABEL[p.quality]}` : '—'}</td>
                      <td className="chico">{cleanNote(p.note) || '—'}</td>
                      <td className="chico muted">{p.source === 'randomizer' ? 'Sorteo' : p.source === 'agent' ? 'Agente' : 'Manual'}</td>
                      <td>
                        <form action={deleteParticipationAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value={BACK} />
                          <SubmitButton className="btn btn-ghost btn-sm" title="Borrar este registro">Borrar</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="chico" style={{ marginTop: 12 }}><Link href={routes.profesorCasos}>Sortear dentro de la postura de un caso →</Link></p>
      </section>
    </div>
  )
}
