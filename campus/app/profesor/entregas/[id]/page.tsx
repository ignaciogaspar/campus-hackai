import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionForm } from '@/components/assignments/ActionForm'
import { Markdown } from '@/components/assignments/Markdown'
import { RubricTable } from '@/components/assignments/RubricTable'
import '@/components/assignments/assignments.css'
import { requireSession } from '@/lib/auth'
import { commonScale, formatPct, mean, pctToScale } from '@/lib/assignments/scoring'
import { buildGradebook, getAssignmentRow, loadBundle } from '@/lib/assignments/store'
import { ASSIGNMENT_STATUSES, GRADE_MODES, GRADE_MODE_LABEL, STATUS_LABEL } from '@/lib/assignments/types'
import { fechaHora } from '@/lib/format'
import { routes } from '@/lib/routes'
import { assignPeers, changeStatus, updateSettings } from './actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await getAssignmentRow((await params).id)
  return { title: a ? `Entrega · ${a.title}` : 'Entrega' }
}

/** ISO → 'YYYY-MM-DDTHH:mm' en hora de Buenos Aires (para datetime-local). */
function toBaInput(iso: string | null): string {
  if (!iso) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`
}

export default async function EntregaProfesor({ params }: { params: Promise<{ id: string }> }) {
  await requireSession('profesor')
  const { id } = await params
  const bundle = await loadBundle(id)
  if (!bundle) notFound()
  const { assignment, settings, submissions, reviews } = bundle
  const book = buildGradebook(bundle)
  const scale = commonScale(assignment.rubric)
  const peer = reviews.filter((r) => !r.is_teacher)
  const sentPeer = peer.filter((r) => r.status === 'enviada').length
  const teacherCount = reviews.filter((r) => r.is_teacher && r.status === 'enviada').length
  const discordant = book.filter((r) => r.grade?.discordant)
  const finals = book.map((r) => r.grade?.final).filter((x): x is number => typeof x === 'number')
  const avg = mean(finals)
  const nameOf = new Map(book.map((r) => [r.student.id, r.student.full_name]))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link href="/profesor/entregas" className="chico">← Entregas</Link>
          <div className="kicker" style={{ marginTop: 8 }}>Entrega · {assignment.class_session_id ?? 'sin jornada'}</div>
          <h1>{assignment.title}</h1>
          <div className="ent-meta" style={{ marginTop: 8 }}>
            <span className="badge">{STATUS_LABEL[assignment.status]}</span>
            <span>Vence {fechaHora(assignment.due_at)}</span>
            <span>{assignment.peer_reviews_per_submission} revisores por entrega</span>
            <span>Nota: {GRADE_MODE_LABEL[settings.gradeMode].toLowerCase()}</span>
          </div>
        </div>
        <div className="fila">
          <a className="btn" href={`/api/assignments/${encodeURIComponent(assignment.id)}/csv`} download>Exportar CSV</a>
        </div>
      </div>

      <section aria-label="Resumen" className="ent-stats">
        <div className="ent-stat"><strong>{submissions.length}/{book.length}</strong><span>entregaron</span></div>
        <div className="ent-stat"><strong>{peer.length ? `${sentPeer}/${peer.length}` : '—'}</strong><span>revisiones de pares enviadas</span></div>
        <div className="ent-stat"><strong>{teacherCount}</strong><span>revisiones docentes</span></div>
        <div className="ent-stat"><strong className={discordant.length ? 'ent-alerta' : ''}>{discordant.length}</strong><span>entregas para mirar</span></div>
        <div className="ent-stat"><strong>{formatPct(avg === null ? null : Math.round(avg * 10) / 10)}</strong><span>nota final promedio</span></div>
      </section>

      <section className="seccion" aria-labelledby="estado-h">
        <h2 id="estado-h">Estado</h2>
        <div className="card stack">
          <div className="ent-estados">
            {ASSIGNMENT_STATUSES.map((s) => (
              <form key={s} action={changeStatus}>
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <input type="hidden" name="status" value={s} />
                <button className="btn btn-sm" type="submit" aria-pressed={assignment.status === s}>{STATUS_LABEL[s]}</button>
              </form>
            ))}
          </div>
          <p className="ayuda" style={{ margin: 0 }}>
            Borrador: el alumno no la ve. Abierta: puede entregar y editar hasta el vencimiento. Revisión entre pares: la entrega se congela
            y cada alumno revisa las que le tocan. Cerrada: todos ven sus devoluciones y no se puede editar nada.
          </p>
        </div>
      </section>

      <div className="ent-grid seccion">
        <section className="card" aria-labelledby="asignar-h">
          <h2 id="asignar-h">Asignar revisión entre pares</h2>
          {assignment.peer_reviews_per_submission === 0 && !peer.length ? (
            <div className="alerta alerta-aviso">Esta entrega está pensada sin revisión entre pares: la corrige el equipo docente. Si igual querés sumarla, elegí los revisores y asigná.</div>
          ) : null}
          <p className="muted chico">
            Cada entrega recibe N revisores distintos entre los alumnos que entregaron. Nadie se revisa a sí mismo, la carga queda pareja
            y se evitan los pares recíprocos cuando se puede. Con la misma semilla el resultado es el mismo.
            {settings.assignedAt ? ` Última asignación: ${fechaHora(settings.assignedAt)} con semilla «${settings.assignmentSeed}».` : ''}
          </p>
          <ActionForm
            action={assignPeers}
            submitLabel={peer.length ? 'Asignar' : 'Asignar revisión entre pares'}
            pendingLabel="Asignando…"
            confirm={assignment.status === 'abierta' ? 'Al asignar, la entrega pasa a revisión entre pares y los alumnos ya no pueden editar. ¿Seguimos?' : undefined}
          >
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <div className="fila">
              <label className="field" style={{ width: 160 }}>
                <span>Revisores por entrega</span>
                <input className="input" name="perSubmission" type="number" min={1} max={6} defaultValue={Math.max(1, assignment.peer_reviews_per_submission)} />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 180 }}>
                <span>Semilla</span>
                <input className="input" name="seed" defaultValue={settings.assignmentSeed ?? assignment.id} />
              </label>
            </div>
            {peer.length ? (
              <fieldset className="ent-fieldset">
                <legend>Ya hay {peer.length} asignaciones</legend>
                <label className="fila chico"><input type="radio" name="mode" value="incremental" defaultChecked /> Completar: conservar lo asignado y sumar las entregas nuevas o tardías</label>
                <label className="fila chico"><input type="radio" name="mode" value="rehacer" /> Rehacer: borrar las pendientes (no las enviadas) y volver a asignar</label>
              </fieldset>
            ) : <input type="hidden" name="mode" value="incremental" />}
          </ActionForm>
        </section>

        <section className="card" aria-labelledby="notas-h">
          <h2 id="notas-h">Nota final y alertas</h2>
          <ActionForm action={updateSettings} submitLabel="Guardar configuración" pendingLabel="Guardando…">
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <label className="field">
              <span>Criterio de nota final</span>
              <select className="select" name="gradeMode" defaultValue={settings.gradeMode}>
                {GRADE_MODES.map((m) => <option key={m} value={m}>{GRADE_MODE_LABEL[m]}</option>)}
              </select>
            </label>
            <div className="fila">
              <label className="field" style={{ width: 170 }}>
                <span>Peso docente (mixta)</span>
                <input className="input" name="teacherWeight" type="number" min={0} max={100} step={5} defaultValue={Math.round(settings.teacherWeight * 100)} />
              </label>
              <label className="field" style={{ width: 190 }}>
                <span>Umbral de discordancia</span>
                <input className="input" name="discordThreshold" type="number" min={1} max={100} step={1} defaultValue={settings.discordThreshold} />
              </label>
            </div>
            <span className="ayuda">El umbral está en puntos del puntaje ponderado (0–100). Una revisión se marca si se aparta más que eso del docente o de la mediana de pares.</span>
            <label className="field">
              <span>Vencimiento (hora de Buenos Aires)</span>
              <input className="input" name="dueAt" type="datetime-local" defaultValue={toBaInput(assignment.due_at)} />
            </label>
          </ActionForm>
        </section>
      </div>

      {discordant.length ? (
        <section className="seccion" aria-labelledby="mirar-h">
          <h2 id="mirar-h">Para mirar: revisiones discordantes</h2>
          <div className="stack">
            {discordant.map((r) => (
              <div key={r.student.id} className="card fila" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{r.student.full_name}</strong>
                  <p className="muted chico" style={{ margin: '4px 0 0' }}>
                    {r.grade!.discordReasons.join(' · ')}. Pares: {r.grade!.peerScores.map((s) => `${nameOf.get(s.reviewerId) ?? 'par'} ${formatPct(s.pct)}`).join(', ')}
                    {r.grade!.teacher ? ` · Docente ${formatPct(r.grade!.teacher.pct)}` : ''}
                  </p>
                </div>
                {r.submission ? <Link className="btn btn-sm" href={`${routes.profesorEntrega(assignment.id)}/revisar/${r.submission.id}`}>Revisar</Link> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="seccion" aria-labelledby="alumnos-h">
        <h2 id="alumnos-h">Por alumno</h2>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Alumno</th><th>Entrega</th><th>Revisó</th><th>Recibió</th><th>Pares</th><th>Docente</th><th>Nota final</th><th />
              </tr>
            </thead>
            <tbody>
              {book.map((r) => (
                <tr key={r.student.id} className={r.grade?.discordant ? 'ent-fila-alerta' : undefined}>
                  <td>
                    <strong>{r.student.full_name}</strong>
                    {r.student.company ? <div className="chico muted">{r.student.company}</div> : null}
                  </td>
                  <td>{r.submission ? fechaHora(r.submission.updated_at) : <span className="muted">Sin entrega</span>}</td>
                  <td>{r.toDo ? `${r.done}/${r.toDo}` : '—'}</td>
                  <td>{r.receivedAssigned ? `${r.receivedSent}/${r.receivedAssigned}` : '—'}</td>
                  <td>{formatPct(r.grade?.peerMean ?? null)}{r.grade?.peerStdev ? <span className="chico muted"> ±{r.grade.peerStdev}</span> : null}</td>
                  <td>{formatPct(r.grade?.teacher?.pct ?? null)}</td>
                  <td>
                    <strong>{formatPct(r.grade?.final ?? null)}</strong>
                    {scale && r.grade?.final !== null && r.grade?.final !== undefined ? <span className="chico muted"> · {pctToScale(r.grade.final, scale)?.toLocaleString('es-AR')}/{scale}</span> : null}
                    {r.grade?.discordant ? <div className="chico ent-alerta">Discordante</div> : null}
                  </td>
                  <td>{r.submission ? <Link className="btn btn-sm" href={`${routes.profesorEntrega(assignment.id)}/revisar/${r.submission.id}`}>{r.grade?.teacher ? 'Ver' : 'Revisar'}</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="seccion">
        <details className="card">
          <summary><strong>Consigna y rúbrica</strong></summary>
          <div className="stack" style={{ marginTop: 14 }}>
            <Markdown>{assignment.brief_md}</Markdown>
            <RubricTable rubric={assignment.rubric} />
          </div>
        </details>
      </section>
    </div>
  )
}
