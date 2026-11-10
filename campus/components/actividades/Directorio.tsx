'use client'

import { useState } from 'react'
import { BOARD_VOTES } from '@/lib/actividades/catalog'
import type { ActivityView, BoardView } from '@/lib/actividades/service'
import { StatusText, type OpStatus } from './useActivity'

type Op = (body: Record<string, unknown>) => Promise<boolean>

export function Tally({ t }: { t: BoardView['tallies'][string] | undefined }) {
  const total = t?.total ?? 0
  return (
    <div className="ac-barras">
      {BOARD_VOTES.map((v) => {
        const n = t?.[v.id as 'aprobar' | 'cambios' | 'rechazar'] ?? 0
        return (
          <div key={v.id} className="ac-barra">
            <span>{v.label}</span>
            <span className="ac-barra-fondo"><span className={`ac-barra-relleno ac-${v.id}`} style={{ display: 'block', width: `${total ? (n / total) * 100 : 0}%` }} /></span>
            <span>{n}</span>
          </div>
        )
      })}
    </div>
  )
}

export function BoardOrder({ board, me }: { board: BoardView; me?: string }) {
  return (
    <ol className="ac-orden">
      {board.order.map((p, i) => (
        <li key={p.id} className={i === board.current ? 'ac-actual' : i < board.current ? 'ac-hecho' : ''}>
          <span className="ac-num">{i + 1}</span>
          <span className="ac-grow">{p.name}{p.id === me ? ' (vos)' : ''}{p.company ? <span className="chico muted"> · {p.company}</span> : null}</span>
          {i === board.current ? <span className="badge badge-vivo">Presenta</span> : i < board.current ? <span className="chico">✓</span> : null}
        </li>
      ))}
    </ol>
  )
}

function VoteBox({ presenter, mine, op, status }: { presenter: { id: string; name: string }; mine?: { vote: string; line: string }; op: Op; status: OpStatus }) {
  const [vote, setVote] = useState(mine?.vote ?? '')
  const [line, setLine] = useState(mine?.line ?? '')
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div>
        <div className="kicker">Votación abierta</div>
        <h3 style={{ margin: '4px 0 0' }}>Plan de {presenter.name}</h3>
      </div>
      <div className="ac-votos" role="group" aria-label="Tu voto">
        {BOARD_VOTES.map((v) => <button key={v.id} type="button" className="ac-voto" aria-pressed={vote === v.id} onClick={() => setVote(v.id)}>{v.label}</button>)}
      </div>
      <label className="field">
        <span>Por qué (una línea)</span>
        <input className="input" value={line} onChange={(e) => setLine(e.target.value)} maxLength={280} placeholder="Lo apruebo si…, me preocupa…" />
      </label>
      <div className="ac-guardar">
        <button type="button" className="btn btn-primario" disabled={!vote || status.kind === 'busy'} onClick={() => op({ op: 'vote', presenterId: presenter.id, vote, line })}>{mine ? 'Cambiar voto' : 'Votar'}</button>
        <StatusText status={status} />
      </div>
    </section>
  )
}

export function DirectorioTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const [plan, setPlan] = useState(typeof view.entry?.plan === 'string' ? view.entry.plan : '')
  const board = view.board
  const presenter = board && board.votingFor ? board.order.find((p) => p.id === board.votingFor) : null
  const myVote = presenter ? view.items.find((i) => i.target_person_id === presenter.id) : undefined
  const myRole = board?.roles[view.me]
  const myIndex = board ? board.order.findIndex((p) => p.id === view.me) : -1

  return (
    <div className="stack">
      <section className="card stack" style={{ gap: 8 }}>
        <label className="field">
          <span>Tu plan en una línea (lo ve el directorio cuando presentás)</span>
          <input className="input" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Llevar X a Y personas en Z meses con A de presupuesto." />
        </label>
        <div className="ac-guardar">
          <button type="button" className="btn" onClick={() => op({ op: 'entry.save', data: { plan } })}>Guardar</button>
          <StatusText status={status} />
        </div>
      </section>

      {!board ? <div className="alerta">El profesor todavía no armó el directorio. Cuando lo haga, acá vas a ver tu rol y el orden.</div> : (
        <>
          <div className="fila">
            {myRole ? <span className="badge">Tu rol ahora: {myRole}</span> : null}
            {myIndex >= 0 ? <span className="chico">Presentás en el turno {myIndex + 1} de {board.order.length}.</span> : null}
          </div>
          {presenter && presenter.id === view.me ? <div className="alerta alerta-aviso">Estás presentando. Tu votación se abre para los demás.</div> : null}
          {presenter && presenter.id !== view.me ? (
            <VoteBox key={presenter.id} presenter={presenter} mine={myVote ? { vote: String(myVote.data.vote), line: String(myVote.data.line ?? '') } : undefined} op={op} status={status} />
          ) : null}
          {!presenter && board.current >= 0 && board.current < board.order.length ? <div className="alerta">Votación cerrada. Esperá la próxima presentación.</div> : null}
          {view.received && view.received.length ? (
            <section className="card stack" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>Lo que te dejó el directorio</h3>
              <Tally t={{
                aprobar: view.received.filter((r) => r.vote === 'aprobar').length,
                cambios: view.received.filter((r) => r.vote === 'cambios').length,
                rechazar: view.received.filter((r) => r.vote === 'rechazar').length,
                total: view.received.length,
              }} />
              <ul className="ac-lineas">{view.received.filter((r) => r.line).map((r, i) => <li key={i}>{r.line}</li>)}</ul>
            </section>
          ) : null}
          <BoardOrder board={board} me={view.me} />
        </>
      )}
    </div>
  )
}
