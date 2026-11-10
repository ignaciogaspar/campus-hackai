'use client'

import { useState } from 'react'
import { ACTIVITIES, ATTACK_RESULTS, ATTACK_TYPES, BUG_STATUS, SEVERITIES, type ActivityDef } from '@/lib/actividades/catalog'
import type { ActivityView, PersonRef } from '@/lib/actividades/service'
import { SQL_EXERCISES } from '@/lib/actividades/sql-lab'
import type { ActivityItem } from '@/lib/actividades/types'
import { BoardOrder, Tally } from './Directorio'
import { Gallery } from './EntryTools'
import { KnnBoard } from './KnnBoard'
import { Timer } from './Timer'
import { StatusText, useActivity } from './useActivity'
import './actividades.css'

type Op = (body: Record<string, unknown>) => Promise<boolean>
const s = (v: unknown) => (typeof v === 'string' ? v : '')
const label = (list: ReadonlyArray<{ id: string; label: string }>, id: unknown) => list.find((x) => x.id === id)?.label ?? String(id ?? '')

function nameOf(view: ActivityView, id: string | null): string {
  if (!id) return '—'
  return view.roster?.find((p) => p.id === id)?.name ?? 'Alguien'
}

function TimerControls({ def, op }: { def: ActivityDef; op: Op }) {
  const sugerido = def.pasos.reduce((max, p) => Math.max(max, p.minutes), 0)
  const [min, setMin] = useState(String(sugerido || 10))
  const [lbl, setLbl] = useState(def.pasos.find((p) => p.minutes === sugerido)?.title ?? def.title)
  return (
    <div className="fila">
      <input className="input" style={{ width: 80 }} type="number" min={1} max={180} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minutos" />
      <input className="input" style={{ flex: '1 1 160px' }} value={lbl} onChange={(e) => setLbl(e.target.value)} aria-label="Etiqueta" />
      <button type="button" className="btn btn-accion" onClick={() => op({ op: 'timer.start', minutes: Number(min), label: lbl })}>Arrancar</button>
      <button type="button" className="btn btn-ghost" onClick={() => op({ op: 'timer.stop' })}>Detener</button>
    </div>
  )
}

function PairControls({ def, view, op }: { def: ActivityDef; view: ActivityView; op: Op }) {
  const others = ACTIVITIES.filter((a) => a.pairs && a.id !== def.id)
  const [from, setFrom] = useState(others[0]?.id ?? '')
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="fila">
        <button type="button" className="btn btn-primario" onClick={() => { if (!view.groups?.length || confirm('¿Rearmar las parejas? Las actuales se reemplazan.')) void op({ op: 'pairs.generate' }) }}>
          {view.groups?.length ? 'Rearmar parejas' : 'Armar parejas'}
        </button>
        {others.length ? (
          <>
            <select className="select" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Copiar de">
              {others.map((a) => <option key={a.id} value={a.id}>J{a.jornada} · {a.title}</option>)}
            </select>
            <button type="button" className="btn" onClick={() => op({ op: 'pairs.copy', from })}>Copiar parejas</button>
          </>
        ) : null}
        {view.groups?.length ? <button type="button" className="btn btn-ghost" onClick={() => { if (confirm('¿Borrar las parejas?')) void op({ op: 'pairs.clear' }) }}>Borrar</button> : null}
      </div>
      <p className="chico muted" style={{ margin: 0 }}>Al rearmar se evitan las parejas que ya trabajaron juntas en la actividad anterior. Con número impar queda un trío en ronda (A→B→C→A).</p>
      {view.groups?.length ? (
        <ol className="ac-orden">
          {view.groups.map((g, i) => (
            <li key={i}><span className="ac-num">{i + 1}</span><span className="ac-grow">{g.map((p: PersonRef) => p.name).join(' → ')}{g.length > 1 ? ` → ${g[0].name}` : ''}</span></li>
          ))}
        </ol>
      ) : <div className="vacio">Sin parejas todavía.</div>}
    </div>
  )
}

function Missing({ view }: { view: ActivityView }) {
  const done = new Set((view.entries ?? []).map((e) => e.person_id))
  const missing = (view.roster ?? []).filter((p) => !done.has(p.id))
  return (
    <p className="chico muted" style={{ margin: 0 }}>
      {done.size} de {view.roster?.length ?? 0} guardaron algo.{missing.length ? ` Faltan: ${missing.map((p) => p.name).join(', ')}.` : ''}
    </p>
  )
}

function Entries({ view, render }: { view: ActivityView; render: (data: Record<string, unknown>) => React.ReactNode }) {
  const entries = view.entries ?? []
  if (!entries.length) return <div className="vacio">Todavía nadie guardó nada.</div>
  return (
    <div className="ac-items">
      {entries.map((e) => (
        <details key={e.person_id} className="ac-item">
          <summary><strong>{e.person.name}</strong>{e.person.company ? <span className="chico muted"> · {e.person.company}</span> : null}</summary>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>{render(e.data)}</div>
        </details>
      ))}
    </div>
  )
}

function Field({ k, v }: { k: string; v: unknown }) {
  if (!s(v)) return null
  return <p className="chico" style={{ margin: 0, whiteSpace: 'pre-wrap' }}><strong>{k}:</strong> {s(v)}</p>
}

function Counts({ items, field, list }: { items: ActivityItem[]; field: string; list: ReadonlyArray<{ id: string; label: string }> }) {
  return (
    <div className="fila">
      {list.map((x) => <span key={x.id} className="badge">{x.label}: {items.filter((i) => i.data[field] === x.id).length}</span>)}
    </div>
  )
}

function Outputs({ def, view }: { def: ActivityDef; view: ActivityView }) {
  switch (def.kind) {
    case 'autopsia':
      return <Entries view={view} render={(d) => <>
        <Field k="App" v={`${s(d.app)} ${s(d.url)}`} /><Field k="Pantalla" v={d.pantalla} /><Field k="Servidor" v={d.servidor} />
        <Field k="Base" v={d.base} /><Field k="APIs" v={d.apis} /><Field k="Click" v={d.click} /><Field k="Dudas" v={d.dudas} />
      </>} />
    case 'request':
      return (
        <div className="tabla-scroll">
          <table className="ac-tabla">
            <thead><tr><th>Alumno</th><th>Prueba</th><th>App</th><th>Método</th><th>Endpoint</th><th>Status</th><th>ms</th><th>Sorpresa</th></tr></thead>
            <tbody>{(view.entries ?? []).map((e) => {
              const probe = e.data.probe as { ms?: number; status?: number } | null
              return (
                <tr key={e.person_id}>
                  <td>{e.person.name}</td><td>{probe ? `${probe.status} · ${probe.ms} ms` : '—'}</td><td>{s(e.data.app)}</td><td>{s(e.data.metodo)}</td>
                  <td style={{ wordBreak: 'break-all' }}>{s(e.data.endpoint)}</td><td>{s(e.data.status)}</td><td>{s(e.data.ms)}</td><td>{s(e.data.sorpresa)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )
    case 'galeria':
      return <Gallery cards={view.gallery} />
    case 'rompe':
      return (
        <div className="stack" style={{ gap: 10 }}>
          <Counts items={view.items} field="severidad" list={SEVERITIES} />
          <Counts items={view.items} field="status" list={BUG_STATUS} />
          <div className="tabla-scroll">
            <table className="ac-tabla">
              <thead><tr><th>Encontró</th><th>App de</th><th>Bug</th><th>Gravedad</th><th>Estado</th></tr></thead>
              <tbody>{view.items.map((i) => (
                <tr key={i.id}><td>{nameOf(view, i.person_id)}</td><td>{nameOf(view, i.target_person_id)}</td><td>{s(i.data.titulo)}</td><td>{label(SEVERITIES, i.data.severidad)}</td><td>{label(BUG_STATUS, i.data.status)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )
    case 'inventario':
      return <Entries view={view} render={(d) => {
        const rows = Array.isArray(d.rows) ? (d.rows as Array<Record<string, unknown>>) : []
        return <>
          <Field k="Decisión" v={d.decision} />
          <p className="chico" style={{ margin: 0 }}>{rows.length} datos · {rows.filter((r) => r.acceso === 'si').length} accesibles · {rows.filter((r) => r.acceso === 'pedido').length} a pedir · {rows.filter((r) => r.acceso === 'no').length} no existen · {rows.filter((r) => r.sensible).length} sensibles</p>
          <ul className="ac-lineas">{rows.map((r, i) => <li key={i}>{s(r.dato)} — {s(r.sistema)} ({s(r.dueno) || 'sin dueño'}, {s(r.frecuencia) || '¿?'}, calidad {String(r.calidad)})</li>)}</ul>
          <Field k="Hueco" v={d.hueco} /><Field k="Conclusión" v={d.conclusion} />
        </>
      }} />
    case 'sql':
      return (
        <div className="tabla-scroll">
          <table className="ac-tabla">
            <thead><tr><th>Alumno</th>{SQL_EXERCISES.map((e, i) => <th key={e.id} title={e.title}>{i + 1}</th>)}<th>Total</th><th>Su pregunta</th></tr></thead>
            <tbody>{(view.entries ?? []).map((e) => {
              const solved = (e.data.solved ?? {}) as Record<string, unknown>
              const attempts = (e.data.attempts ?? {}) as Record<string, number>
              return (
                <tr key={e.person_id}>
                  <td>{e.person.name}</td>
                  {SQL_EXERCISES.map((x) => <td key={x.id} title={`${attempts[x.id] ?? 0} intentos`}>{solved[x.id] ? '✓' : attempts[x.id] ? `✗${attempts[x.id]}` : ''}</td>)}
                  <td><strong>{Object.keys(solved).length}</strong></td>
                  <td>{s(e.data.propia)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )
    case 'knn':
      return <KnnBoard />
    case 'clon':
      return <Entries view={view} render={(d) => <><Field k="Copió" v={d.copie} /><Field k="No pudo copiar" v={d.noCopie} /><Field k="Con" v={d.herramientas} /><Field k="Aprendió" v={d.aprendizaje} /></>} />
    case 'redteam':
      return (
        <div className="stack" style={{ gap: 10 }}>
          <div className="tabla-scroll">
            <table className="ac-tabla">
              <thead><tr><th>Tipo</th>{ATTACK_RESULTS.map((r) => <th key={r.id}>{r.label}</th>)}<th>Con defensa</th></tr></thead>
              <tbody>{ATTACK_TYPES.map((t) => {
                const of = view.items.filter((i) => i.data.tipo === t.id)
                if (!of.length) return null
                return <tr key={t.id}><td>{t.label}</td>{ATTACK_RESULTS.map((r) => <td key={r.id}>{of.filter((i) => i.data.resultado === r.id).length}</td>)}<td>{of.filter((i) => s(i.data.defensa)).length}</td></tr>
              })}</tbody>
            </table>
          </div>
          <div className="ac-items">{view.items.map((i) => (
            <div key={i.id} className={`ac-item ac-res-${s(i.data.reintento) || s(i.data.resultado)}`}>
              <span className="chico"><strong>{nameOf(view, i.person_id)}</strong> atacó a <strong>{nameOf(view, i.target_person_id)}</strong> · {label(ATTACK_TYPES, i.data.tipo)} · {label(ATTACK_RESULTS, i.data.resultado)}{s(i.data.reintento) ? ` → ${label(ATTACK_RESULTS, i.data.reintento)}` : ''}</span>
              <p className="chico">{s(i.data.intento)}</p>
              {s(i.data.defensa) ? <p className="chico"><strong>Defensa:</strong> {s(i.data.defensa)}</p> : null}
            </div>
          ))}</div>
        </div>
      )
    case 'directorio':
      return null
  }
}

function BoardControls({ view, op }: { view: ActivityView; op: Op }) {
  const board = view.board
  const [min, setMin] = useState('4')
  if (!board) return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="chico" style={{ margin: 0 }}>Sortea el orden de presentaciones entre los {view.roster?.length ?? 0} alumnos y reparte los roles en rotación.</p>
      <div><button type="button" className="btn btn-primario" onClick={() => op({ op: 'board.setup' })}>Armar directorio</button></div>
    </div>
  )
  const current = board.current >= 0 && board.current < board.order.length ? board.order[board.current] : null
  const votesFor = (id: string) => view.items.filter((i) => i.target_person_id === id)
  const plans = new Map((view.entries ?? []).map((e) => [e.person_id, s(e.data.plan)]))
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="fila">
        <button type="button" className="btn" onClick={() => op({ op: 'board.prev', minutes: Number(min) })} disabled={board.current < 0}>← Anterior</button>
        <button type="button" className="btn btn-primario" onClick={() => op({ op: 'board.next', minutes: Number(min) })} disabled={board.current >= board.order.length}>
          {board.current < 0 ? 'Empezar' : 'Siguiente →'}
        </button>
        <label className="chico" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Minutos por presentación
          <input className="input" style={{ width: 70 }} type="number" min={1} max={30} value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        {board.votingFor ? <button type="button" className="btn btn-ghost" onClick={() => op({ op: 'board.close' })}>Cerrar votación</button> : null}
        <button type="button" className="btn btn-ghost" onClick={() => { if (confirm('¿Volver a sortear el directorio? Los votos quedan guardados.')) void op({ op: 'board.setup' }) }}>Volver a sortear</button>
      </div>
      {current ? (
        <section className="card stack" style={{ gap: 8 }}>
          <div className="kicker">Presenta ahora · {board.votingFor ? 'votación abierta' : 'votación cerrada'}</div>
          <h3 style={{ margin: 0 }}>{current.name}{current.company ? ` · ${current.company}` : ''}</h3>
          {plans.get(current.id) ? <p style={{ margin: 0 }}>{plans.get(current.id)}</p> : null}
          <Tally t={board.tallies[current.id]} />
          <p className="chico muted" style={{ margin: 0 }}>{votesFor(current.id).length} votos de {(view.roster?.length ?? 1) - 1}.</p>
          <div className="fila">{Object.entries(board.roles).filter(([id]) => id !== current.id).slice(0, 40).map(([id, role]) => <span key={id} className="badge">{nameOf(view, id)}: {role}</span>)}</div>
        </section>
      ) : board.current >= board.order.length ? <div className="alerta alerta-ok">Terminaron todas las presentaciones.</div> : null}
      <div className="ac-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div>
          <h3>Orden</h3>
          <BoardOrder board={board} />
          <details style={{ marginTop: 8 }}>
            <summary className="chico">Cambiar el orden</summary>
            <ol className="ac-orden" style={{ marginTop: 8 }}>
              {board.order.map((p, i) => (
                <li key={p.id}><span className="ac-num">{i + 1}</span><span className="ac-grow">{p.name}</span>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="Subir" onClick={() => op({ op: 'board.move', personId: p.id, dir: -1 })} disabled={i === 0}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="Bajar" onClick={() => op({ op: 'board.move', personId: p.id, dir: 1 })} disabled={i === board.order.length - 1}>↓</button>
                </li>
              ))}
            </ol>
          </details>
        </div>
        <div>
          <h3>Resultados</h3>
          <div className="ac-items">
            {board.order.filter((p) => board.tallies[p.id]).map((p) => (
              <details key={p.id} className="ac-item">
                <summary><strong>{p.name}</strong> · {board.tallies[p.id].aprobar} aprueban · {board.tallies[p.id].cambios} con cambios · {board.tallies[p.id].rechazar} rechazan</summary>
                <ul className="ac-lineas" style={{ marginTop: 6 }}>{votesFor(p.id).map((v) => <li key={v.id}><strong>{nameOf(view, v.person_id)}</strong> ({String(v.data.vote)}): {s(v.data.line)}</li>)}</ul>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Panel del profesor: controles en vivo (parejas, cronómetro, directorio) y lo que produjo la cohorte. */
export function TeacherPanel({ def, initial }: { def: ActivityDef; initial: ActivityView }) {
  const { view, status, op } = useActivity(def.id, initial, def.kind === 'knn' ? 0 : 5000)
  return (
    <div className="stack">
      {def.timer || def.pairs || def.kind === 'directorio' ? (
        <section className="card stack" style={{ gap: 12 }}>
          <div className="fila" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>En clase</h2>
            <StatusText status={status} />
          </div>
          <Timer timer={view.timer} serverNow={view.now} />
          {def.timer ? <TimerControls def={def} op={op} /> : null}
          {def.pairs ? <PairControls def={def} view={view} op={op} /> : null}
          {def.kind === 'directorio' ? <BoardControls view={view} op={op} /> : null}
        </section>
      ) : null}
      {def.kind !== 'directorio' ? (
        <section className="stack" style={{ gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{def.kind === 'knn' ? 'Tablero para proyectar' : 'Lo que produjo la cohorte'}</h2>
          {def.kind !== 'knn' && def.kind !== 'rompe' && def.kind !== 'redteam' ? <Missing view={view} /> : null}
          <Outputs def={def} view={view} />
        </section>
      ) : null}
    </div>
  )
}
