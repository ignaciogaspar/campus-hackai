'use client'

import { useEffect, useState } from 'react'
import {
  ahorroMensual, applyMonth, debriefOf, desgloseScore, initialState, promedioPonderado, seedFor, validarElecciones,
  type ActionChoice, type ActionId, type AdopcionState, type AreaId,
} from '@/lib/sims/engines/adopcion'
import { ACCIONES, AREAS, MANDATO_ADOPCION, NOTA_SIN_EQUIPO_IA } from '@/lib/sims/data/adopcion'
import type { SimRun } from '@/lib/sims/types'
import { useSimRun } from './useSimRun'
import { HistorialIntentos, type Intento } from './HistorialIntentos'

/* Piloto de Adopción · Alimentos del Plata (caso ficticio). Portado de ../mbt.
   Seis meses, dos jugadas por mes; cada jugada se registra como decisión. */

const usd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
const ACCION_BY_ID = new Map(ACCIONES.map((a) => [a.id, a]))
const AREA_BY_ID = new Map(AREAS.map((a) => [a.id, a]))
const ENDING = {
  real: { label: 'Transformación real', banda: 'alta', badge: 'badge-ok' },
  papel: { label: 'Adopción de papel', banda: 'media', badge: 'sim-badge-ambar' },
  rechazo: { label: 'El programa se archivó', banda: 'baja', badge: 'sim-badge-rojo' },
} as const

interface Props { personId: string; liveSessionId?: string | null; initialRun?: SimRun | null; history: Intento[] }

function readState(run: SimRun | null | undefined): AdopcionState | null {
  const s = run?.state?.engine as AdopcionState | undefined
  return s && typeof s === 'object' && s.areas ? s : null
}

export function AdopcionSim({ personId, liveSessionId = null, initialRun = null, history }: Props) {
  const sim = useSimRun({ simId: 'adopcion', liveSessionId, initialRun })
  const [state, setState] = useState<AdopcionState | null>(() => readState(initialRun))
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState<Intento[]>(history)

  useEffect(() => { if (state && !state.finished) sim.saveState({ engine: state }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function empezar() {
    setError(null)
    try {
      await sim.start({ fresh: Boolean(state), meta: { sim: 'adopcion' } })
      const attempt = intentos.length + 1
      setState(initialState(seedFor(personId, attempt), attempt))
      sim.emit('mandate.accepted', { attempt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar')
    }
  }

  async function cerrarMes(elecciones: ActionChoice[]) {
    if (!state) return
    const motivo = validarElecciones(state, elecciones)
    if (motivo) return setError(motivo)
    setError(null)
    let next: AdopcionState
    try {
      next = applyMonth(state, elecciones)
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Jugada inválida')
    }
    const mes = next.month
    elecciones.forEach((e, i) => {
      const def = ACCION_BY_ID.get(e.action)
      const area = e.area ? AREA_BY_ID.get(e.area)?.nombre : null
      sim.decision(`mes${mes}.jugada${i + 1}`, e.area ? `${e.action}:${e.area}` : e.action, {
        label: `Mes ${mes} · jugada ${i + 1}`, valueLabel: `${def?.nombre ?? e.action}${area ? ` · ${area}` : ''}`,
      })
    })
    const log = next.history[next.history.length - 1]
    sim.emit('month.closed', { mes, moral: next.moral, adopcion: log?.adopcionPromedio, roiVerificado: next.roiVerificado, eventos: log?.events.length ?? 0 })
    setState(next)
    if (next.finished) {
      const deb = debriefOf(next)
      sim.decision('final', deb.final.ending, { label: 'Final de la partida', valueLabel: ENDING[deb.final.ending].label })
      try {
        await sim.complete({
          score: next.score ?? 0,
          summary: {
            headline: ENDING[deb.final.ending].label,
            ending: deb.final.ending,
            moral: next.moral,
            adopcion: Math.round(promedioPonderado(next) * 10) / 10,
            roiVerificado: next.roiVerificado,
            gastado: next.gastado,
            practicas: deb.checklist.filter((c) => c.ok).map((c) => c.id),
          },
          state: { engine: next },
        })
        setIntentos((xs) => [{ score: next.score ?? 0, completedAt: new Date().toISOString() }, ...xs])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo registrar el resultado')
      }
    }
  }

  return (
    <div className="sim-react">
      {error ? <div className="alerta alerta-error">{error}</div> : null}
      {!state ? <Mandato onStart={empezar} />
        : state.finished ? <Final state={state} onOtra={empezar} />
          : <FaseMes key={state.month} state={state} onCerrar={cerrarMes} />}
      <HistorialIntentos intentos={intentos} />
    </div>
  )
}

function Mandato({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className="card sim-angosto">
        <div className="fila"><span className="badge badge-ficticio">Caso ficticio</span><span className="badge">Responsable del programa de adopción de IA</span></div>
        <h3>Tu mandato</h3>
        {MANDATO_ADOPCION.map((p, i) => <p key={i}>{p}</p>)}
        <button type="button" className="btn btn-primario" onClick={onStart}>Aceptar el programa · mes 1</button>
        <p className="chico muted">{NOTA_SIN_EQUIPO_IA}</p>
      </div>
      <div className="sim-dos">
        {AREAS.map((a) => (
          <div key={a.id} className="card">
            <div className="fila"><strong>{a.nombre}</strong><span className="chico muted">{a.personas} personas</span></div>
            <p className="chico"><strong>{a.referente}</strong>: {a.perfil}</p>
          </div>
        ))}
      </div>
    </>
  )
}

function Barra({ label, value, rojo }: { label: string; value: number; rojo?: boolean }) {
  return (
    <div className="sim-barra-fila">
      <span>{label}</span>
      <div className="pista"><div className="relleno" style={{ width: `${value}%`, background: rojo ? 'var(--naranja)' : undefined }} /></div>
      <span className="num">{Math.round(value)}</span>
    </div>
  )
}

function Feed({ state, limite }: { state: AdopcionState; limite?: number }) {
  return (
    <div className="stack">
      {[...state.history].reverse().slice(0, limite).map((m) => (
        <div key={m.month} className="sim-debrief-item">
          <strong>Mes {m.month}</strong>
          <ul className="sim-lista">
            {m.actions.map((a, i) => <li key={`a${i}`} style={a.ok ? undefined : { color: 'var(--error)' }}>{a.texto}</li>)}
            {m.events.map((e, i) => <li key={`e${i}`} className="muted"><em>{e}</em></li>)}
          </ul>
          <div className="chico muted">moral {m.moral} · adopción promedio {m.adopcionPromedio} · ROI verificado {usd(m.roiVerificado)}</div>
        </div>
      ))}
    </div>
  )
}

function Jugada({ n, accion, area, onAccion, onArea, state }: {
  n: number; accion: ActionId | ''; area: AreaId | ''; onAccion: (v: ActionId | '') => void; onArea: (v: AreaId | '') => void; state: AdopcionState
}) {
  const def = accion ? ACCION_BY_ID.get(accion) : undefined
  return (
    <div className="sim-item">
      <div className="sim-item-head"><h3>Jugada {n}</h3></div>
      <div className="fila">
        <select className="select" value={accion} onChange={(e) => { onAccion(e.target.value as ActionId | ''); onArea('') }} aria-label={`Acción de la jugada ${n}`}>
          <option value="">Ninguna</option>
          {ACCIONES.map((a) => {
            const off = (a.id === 'sindicato' && state.flags.sindicato) || (a.id === 'herramienta' && state.flags.herramienta)
            return <option key={a.id} value={a.id} disabled={off}>{a.nombre} · {usd(a.costo)}{off ? ' (ya hecho)' : ''}</option>
          })}
        </select>
        {def?.requiereArea ? (
          <select className="select" value={area} onChange={(e) => onArea(e.target.value as AreaId | '')} aria-label={`Área de la jugada ${n}`}>
            <option value="">Elegí el área</option>
            {AREAS.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        ) : null}
      </div>
      {def ? <p className="chico muted">{def.descripcion}{def.nota ? <> <em>{def.nota}</em></> : null}</p> : null}
    </div>
  )
}

function FaseMes({ state, onCerrar }: { state: AdopcionState; onCerrar: (e: ActionChoice[]) => Promise<void> }) {
  const mes = state.month + 1
  const disponible = state.budget + (mes >= 2 ? state.mensualidad : 0)
  const [a1, setA1] = useState<ActionId | ''>('')
  const [a1area, setA1area] = useState<AreaId | ''>('')
  const [a2, setA2] = useState<ActionId | ''>('')
  const [a2area, setA2area] = useState<AreaId | ''>('')
  const [cerrando, setCerrando] = useState(false)
  const costo = [a1, a2].reduce((acc, id) => acc + (id ? ACCION_BY_ID.get(id)?.costo ?? 0 : 0), 0)
  const elecciones: ActionChoice[] = []
  if (a1) elecciones.push({ action: a1, area: a1area || undefined })
  if (a2) elecciones.push({ action: a2, area: a2area || undefined })

  return (
    <>
      <div className="fila sim-progreso">
        <div className="sim-barra"><div style={{ width: `${(state.month / 6) * 100}%` }} /></div>
        <span className="chico muted">Mes {mes} de 6</span>
      </div>
      <div className="sim-kpis">
        <div className="sim-kpi"><strong>{usd(disponible)}</strong><span>disponible este mes{mes >= 2 ? ` (incluye ${usd(state.mensualidad)})` : ' · mensualidad desde el mes 2'}</span></div>
        <div className="sim-kpi"><strong style={state.moral < 40 ? { color: 'var(--error)' } : undefined}>{state.moral}</strong><span>moral / 100 · credibilidad {state.credibilidad}</span></div>
        <div className="sim-kpi"><strong>{Math.round(promedioPonderado(state) * 10) / 10}</strong><span>adopción promedio (ponderada)</span></div>
        <div className="sim-kpi"><strong>{usd(state.roiVerificado)}</strong><span>ROI verificado · estimado {usd(state.roiEstimado)} · ahorro {usd(ahorroMensual(state))}/mes</span></div>
      </div>
      <div className="sim-dos">
        {AREAS.map((def) => {
          const a = state.areas[def.id]
          return (
            <div key={def.id} className="card">
              <div className="fila"><strong>{def.nombre}</strong><span className="chico muted">{def.personas} personas · {def.referente}</span></div>
              <div className="sim-barras" style={{ marginTop: 8 }}>
                <Barra label="Adopción" value={a.adopcion} />
                <Barra label="Resistencia" value={a.resistencia} rojo />
              </div>
              <div className="fila" style={{ marginTop: 6 }}>
                {a.capacitacion > 0 ? <span className="badge">capacitación ×{a.capacitacion}</span> : null}
                {a.champion ? <span className="badge badge-ok">champion</span> : null}
                {a.quickWinDisponible ? <span className="badge sim-badge-ambar">win sin comunicar</span> : null}
              </div>
            </div>
          )
        })}
      </div>
      <div className="sim-dos">
        <div className="card">
          <h3>Tus jugadas del mes {mes}</h3>
          <Jugada n={1} accion={a1} area={a1area} onAccion={setA1} onArea={setA1area} state={state} />
          <Jugada n={2} accion={a2} area={a2area} onAccion={setA2} onArea={setA2area} state={state} />
          <p className="chico">Costo del mes: <strong style={costo > disponible ? { color: 'var(--error)' } : undefined}>{usd(costo)}</strong> <span className="muted">· disponible {usd(disponible)}</span></p>
          <button type="button" className="btn btn-accion" disabled={cerrando || costo > disponible}
            onClick={async () => { setCerrando(true); await onCerrar(elecciones); setCerrando(false) }}>
            {cerrando ? 'Cerrando el mes…' : `Cerrar el mes ${mes} →`}
          </button>
          {!a1 && !a2 ? <p className="chico muted">Podés cerrar el mes sin jugadas, pero el drift corre igual y no perdona.</p> : null}
        </div>
        <div className="card">
          <h3>Lo que pasó hasta ahora</h3>
          {state.history.length === 0 ? <p className="chico muted">Todavía no pasó nada: la empresa está mirando qué hacés primero.</p> : <Feed state={state} limite={3} />}
        </div>
      </div>
    </>
  )
}

function Final({ state, onOtra }: { state: AdopcionState; onOtra: () => void }) {
  const deb = debriefOf(state)
  const meta = ENDING[deb.final.ending]
  const d = desgloseScore(state)
  return (
    <>
      <div className="sim-score-fila">
        <div className="sim-score">{state.score ?? 0}<span> / 100</span></div>
        <span className={`badge ${meta.badge}`}>{meta.label}</span>
        <span className="chico muted">intento {state.attempt} · seis meses jugados</span>
        <button type="button" className="btn btn-sm" onClick={onOtra}>Jugar de nuevo</button>
      </div>
      <div className={`card sim-cierre banda-${meta.banda}`}><h3>La presentación al directorio</h3><p>{deb.final.texto}</p></div>
      <div className="sim-kpis">
        <div className="sim-kpi"><strong>{Math.round(promedioPonderado(state) * 10) / 10}</strong><span>adopción · {d.a}/40</span></div>
        <div className="sim-kpi"><strong>{state.moral}</strong><span>moral · {d.b}/15</span></div>
        <div className="sim-kpi"><strong>{usd(state.roiVerificado)}</strong><span>ROI verificado · {d.c}/20 (contra {usd(state.gastado)} gastados)</span></div>
        <div className="sim-kpi"><strong>{deb.checklist.filter((c) => c.ok).length}/5</strong><span>prácticas de dirección · {d.d}/25</span></div>
      </div>
      <div className="sim-dos">
        <div className="card"><h3>Las 3 decisiones que más movieron la aguja</h3>
          {deb.top3.map((t, i) => <div key={i} className={`sim-feedback ${t.ok ? 'ok' : 'mal'}`}><strong>{t.titulo}</strong><br />{t.texto}</div>)}
        </div>
        <div className="card"><h3>El checklist del director</h3>
          {deb.checklist.map((c) => <p key={c.id} className="chico"><strong style={{ color: c.ok ? 'var(--ok)' : 'var(--error)' }}>{c.ok ? '✓' : '✗'} {c.label}.</strong> {c.texto}</p>)}
        </div>
      </div>
      <div className="card"><h3>El cierre</h3><p>{deb.cierre}</p></div>
      <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Los seis meses, mes a mes</summary><Feed state={state} /></details>
    </>
  )
}
