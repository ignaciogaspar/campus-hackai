'use client'

import { useState } from 'react'
import { ATTACK_RESULTS, ATTACK_TYPES, BUG_STATUS, SEVERITIES } from '@/lib/actividades/catalog'
import type { ActivityView } from '@/lib/actividades/service'
import type { ActivityItem } from '@/lib/actividades/types'
import { StatusText, type OpStatus } from './useActivity'

type Op = (body: Record<string, unknown>) => Promise<boolean>

const label = (list: ReadonlyArray<{ id: string; label: string }>, id: unknown) => list.find((x) => x.id === id)?.label ?? String(id ?? '')
const s = (v: unknown) => (typeof v === 'string' ? v : '')

/** Cabecera con la pareja asignada. */
export function PairHeader({ view, verb, verbBack }: { view: ActivityView; verb: string; verbBack: string }) {
  if (!view.target) return <div className="alerta">Todavía no tenés pareja. Cuando el profesor arme las parejas, aparece acá (la página se actualiza sola).</div>
  return (
    <div className="ac-pareja">
      <span className="chico muted">{verb}</span>
      <strong>{view.target.name}{view.target.company ? ` · ${view.target.company}` : ''}</strong>
      {view.target.appUrl
        ? <a href={view.target.appUrl} target="_blank" rel="noopener noreferrer">{view.target.appUrl}</a>
        : view.kind !== 'redteam' ? <span className="chico muted">Todavía no publicó su URL en la Galería de apps: pedísela.</span> : null}
      {view.target.appLine ? <span className="chico">{view.target.appLine}</span> : null}
      {view.workedBy && view.workedBy.id !== view.target.id ? <span className="chico muted">{verbBack}: {view.workedBy.name}</span> : null}
    </div>
  )
}

// ---------------------------------------------------------------- rompé la del otro

function BugForm({ initial, onSubmit, status, submitLabel }: { initial?: Record<string, unknown>; onSubmit: (d: Record<string, string>) => Promise<boolean>; status: OpStatus; submitLabel: string }) {
  const empty = { titulo: '', pasos: '', esperado: '', obtenido: '', severidad: 'molesta' }
  const [d, setD] = useState<Record<string, string>>(() => ({ ...empty, ...Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, s(v)])) }))
  const set = (k: string, v: string) => setD((p) => ({ ...p, [k]: v }))
  return (
    <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await onSubmit(d) && !initial) setD(empty) }}>
      <label className="field"><span>Título</span><input className="input" value={d.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Se guarda dos veces si apreto rápido" required /></label>
      <label className="field"><span>Pasos para reproducirlo</span><textarea className="textarea" rows={3} value={d.pasos} onChange={(e) => set('pasos', e.target.value)} placeholder={'1. Entro a…\n2. Apreto…'} /></label>
      <div className="ac-campos">
        <label className="field"><span>Qué esperabas</span><textarea className="textarea" rows={2} value={d.esperado} onChange={(e) => set('esperado', e.target.value)} /></label>
        <label className="field"><span>Qué pasó</span><textarea className="textarea" rows={2} value={d.obtenido} onChange={(e) => set('obtenido', e.target.value)} /></label>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Gravedad</legend>
        <div className="fila">
          {SEVERITIES.map((x) => (
            <label key={x.id} className="chico" title={x.help} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="radio" name="sev" checked={d.severidad === x.id} onChange={() => set('severidad', x.id)} /> {x.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="ac-guardar"><button type="submit" className="btn btn-primario" disabled={status.kind === 'busy'}>{submitLabel}</button><StatusText status={status} /></div>
    </form>
  )
}

function BugCard({ item, children }: { item: ActivityItem; children?: React.ReactNode }) {
  const d = item.data
  return (
    <article className={`ac-item ac-sev-${s(d.severidad)}`}>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <strong>{s(d.titulo)}</strong>
        <span className="fila"><span className="badge">{label(SEVERITIES, d.severidad)}</span><span className="badge">{label(BUG_STATUS, d.status)}</span></span>
      </div>
      {s(d.pasos) ? <p>{s(d.pasos)}</p> : null}
      {s(d.esperado) || s(d.obtenido) ? <p className="chico"><strong>Esperado:</strong> {s(d.esperado) || '—'} · <strong>Pasó:</strong> {s(d.obtenido) || '—'}</p> : null}
      {s(d.respuesta) ? <p className="chico muted">Respuesta del dueño: {s(d.respuesta)}</p> : null}
      {children}
    </article>
  )
}

function OwnerControls({ item, op }: { item: ActivityItem; op: Op }) {
  const [respuesta, setRespuesta] = useState(s(item.data.respuesta))
  return (
    <div className="fila" style={{ marginTop: 4 }}>
      {BUG_STATUS.map((st) => (
        <button key={st.id} type="button" className={`btn btn-sm${item.data.status === st.id ? ' btn-primario' : ''}`}
          onClick={() => op({ op: 'item.update', itemId: item.id, data: { status: st.id, respuesta } })}>{st.label}</button>
      ))}
      <input className="input" style={{ flex: '1 1 180px' }} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Comentario (opcional)" aria-label="Comentario"
        onBlur={() => { if (respuesta !== s(item.data.respuesta)) void op({ op: 'item.update', itemId: item.id, data: { status: item.data.status, respuesta } }) }} />
    </div>
  )
}

export function RompeTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const mine = view.items.filter((i) => i.person_id === view.me)
  const received = view.items.filter((i) => i.target_person_id === view.me)
  return (
    <div className="stack">
      <PairHeader view={view} verb="Probás la app de" verbBack="Tu app la prueba" />
      {view.target ? (
        <section className="card stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Registrar un bug</h3>
          <BugForm onSubmit={(d) => op({ op: 'item.add', data: d })} status={status} submitLabel="Registrar" />
        </section>
      ) : null}
      <section className="stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Lo que encontraste ({mine.length})</h3>
        {mine.length ? <div className="ac-items">{mine.map((i) => (
          <BugCard key={i.id} item={i}>
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('¿Borrar este bug?')) void op({ op: 'item.delete', itemId: i.id }) }}>Borrar</button></div>
          </BugCard>
        ))}</div> : <div className="vacio">Todavía no registraste bugs.</div>}
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Lo que le encontraron a tu app ({received.length})</h3>
        {received.length ? <div className="ac-items">{received.map((i) => <BugCard key={i.id} item={i}><OwnerControls item={i} op={op} /></BugCard>)}</div>
          : <div className="vacio">Nadie te reportó bugs todavía.</div>}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- red team

function AttackForm({ onSubmit, status }: { onSubmit: (d: Record<string, string>) => Promise<boolean>; status: OpStatus }) {
  const empty = { tipo: 'inyeccion', intento: '', resultado: 'resistio', evidencia: '' }
  const [d, setD] = useState<Record<string, string>>(empty)
  const set = (k: string, v: string) => setD((p) => ({ ...p, [k]: v }))
  return (
    <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await onSubmit(d)) setD(empty) }}>
      <label className="field"><span>Tipo de ataque</span>
        <select className="select" value={d.tipo} onChange={(e) => set('tipo', e.target.value)}>
          {ATTACK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Qué intentaste</span><textarea className="textarea" rows={3} value={d.intento} onChange={(e) => set('intento', e.target.value)} placeholder="El mensaje o la acción exacta." required /></label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Resultado</legend>
        <div className="fila">
          {ATTACK_RESULTS.map((r) => (
            <label key={r.id} className="chico" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="radio" name="res" checked={d.resultado === r.id} onChange={() => set('resultado', r.id)} /> {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>Evidencia</span><textarea className="textarea" rows={2} value={d.evidencia} onChange={(e) => set('evidencia', e.target.value)} placeholder="Qué respondió o hizo el agente." /></label>
      <div className="ac-guardar"><button type="submit" className="btn btn-primario" disabled={status.kind === 'busy'}>Registrar ataque</button><StatusText status={status} /></div>
    </form>
  )
}

function AttackCard({ item, children }: { item: ActivityItem; children?: React.ReactNode }) {
  const d = item.data
  const final = s(d.reintento) || s(d.resultado)
  return (
    <article className={`ac-item ac-res-${final}`}>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <strong>{label(ATTACK_TYPES, d.tipo)}</strong>
        <span className="fila">
          <span className="badge">{label(ATTACK_RESULTS, d.resultado)}</span>
          {s(d.reintento) ? <span className="badge">2.ª vuelta: {label(ATTACK_RESULTS, d.reintento)}</span> : null}
        </span>
      </div>
      <p>{s(d.intento)}</p>
      {s(d.evidencia) ? <p className="chico muted">{s(d.evidencia)}</p> : null}
      {s(d.defensa) ? <p className="chico"><strong>Defensa:</strong> {s(d.defensa)}</p> : null}
      {children}
    </article>
  )
}

function DefenseControl({ item, op }: { item: ActivityItem; op: Op }) {
  const [defensa, setDefensa] = useState(s(item.data.defensa))
  return (
    <div className="fila" style={{ marginTop: 4 }}>
      <input className="input" style={{ flex: '1 1 220px' }} value={defensa} onChange={(e) => setDefensa(e.target.value)} placeholder="Qué cambiaste para que no vuelva a pasar" aria-label="Defensa" />
      <button type="button" className="btn btn-sm btn-primario" onClick={() => op({ op: 'item.update', itemId: item.id, data: { defensa } })}>Guardar defensa</button>
    </div>
  )
}

function RetryControl({ item, op }: { item: ActivityItem; op: Op }) {
  return (
    <div className="fila" style={{ marginTop: 4 }}>
      <span className="chico muted">Segunda vuelta:</span>
      {ATTACK_RESULTS.map((r) => (
        <button key={r.id} type="button" className={`btn btn-sm${item.data.reintento === r.id ? ' btn-primario' : ''}`}
          onClick={() => op({ op: 'item.update', itemId: item.id, data: { ...item.data, reintento: r.id } })}>{r.label}</button>
      ))}
    </div>
  )
}

export function RedTeamTool({ view, op, status }: { view: ActivityView; op: Op; status: OpStatus }) {
  const mine = view.items.filter((i) => i.person_id === view.me)
  const received = view.items.filter((i) => i.target_person_id === view.me)
  return (
    <div className="stack">
      <PairHeader view={view} verb="Atacás el agente de" verbBack="Tu agente lo ataca" />
      {view.target ? (
        <section className="card stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Registrar un ataque</h3>
          <AttackForm onSubmit={(d) => op({ op: 'item.add', data: d })} status={status} />
        </section>
      ) : null}
      <section className="stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Tus ataques ({mine.length})</h3>
        {mine.length ? <div className="ac-items">{mine.map((i) => <AttackCard key={i.id} item={i}><RetryControl item={i} op={op} /></AttackCard>)}</div>
          : <div className="vacio">Todavía no registraste ataques.</div>}
      </section>
      <section className="stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Ataques a tu agente ({received.length})</h3>
        {received.length ? <div className="ac-items">{received.map((i) => <AttackCard key={i.id} item={i}><DefenseControl item={i} op={op} /></AttackCard>)}</div>
          : <div className="vacio">Nadie atacó tu agente todavía.</div>}
      </section>
    </div>
  )
}
