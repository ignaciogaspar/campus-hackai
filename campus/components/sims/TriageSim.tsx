'use client'

import { useEffect, useState } from 'react'
import {
  CAP_SIN_DATOS, PTS_MAX_CASO, PTS_MAX_ENFOQUE, PTS_MAX_PASO, TRIAGE_CASES, TRIAGE_MANDATO,
  advance, answerCase, caseById, currentCase, finishTriage, newTriageState,
  type TriageEnfoque, type TriagePaso, type TriageState,
} from '@/lib/sims/engines/triage'
import type { SimRun } from '@/lib/sims/types'
import { useSimRun } from './useSimRun'
import { HistorialIntentos, type Intento } from './HistorialIntentos'

/* Triage modelo↔problema · Grupo Aconcagua (caso ficticio). Portado de ../mbt.
   Cada caso registra dos decisiones (<caso>.enfoque y <caso>.paso). */

const ENFOQUES: { value: TriageEnfoque; label: string; hint: string }[] = [
  { value: 'reglas', label: 'Reglas explícitas', hint: 'lógica programada a mano: determinística, auditable' },
  { value: 'ml', label: 'ML clásico', hint: 'aprende patrones de datos tabulares con etiquetas' },
  { value: 'llm', label: 'Modelo de lenguaje (LLM)', hint: 'entiende y produce texto; se paga por uso' },
  { value: 'red', label: 'Red neuronal a medida', hint: 'modelo propio entrenado desde cero para el problema' },
  { value: 'no-auto', label: 'No automatizar todavía', hint: 'el problema, los datos o el riesgo piden otra cosa antes' },
]
const PASOS: { value: TriagePaso; label: string; hint: string }[] = [
  { value: 'datos', label: 'Auditar los datos', hint: 'qué hay, qué falta, qué tan limpio está' },
  { value: 'piloto', label: 'Piloto medido', hint: 'chico, con grupo control y métrica de negocio' },
  { value: 'full', label: 'Desarrollo completo ya', hint: 'contratar la solución entera de entrada' },
  { value: 'esperar', label: 'Esperar', hint: 'no mover nada por ahora' },
]
const ENFOQUE_LABEL = Object.fromEntries(ENFOQUES.map((e) => [e.value, e.label])) as Record<TriageEnfoque, string>
const PASO_LABEL = Object.fromEntries(PASOS.map((p) => [p.value, p.label])) as Record<TriagePaso, string>

interface Props {
  personId: string
  liveSessionId?: string | null
  initialRun?: SimRun | null
  history: Intento[]
}

function readState(run: SimRun | null | undefined): TriageState | null {
  const s = run?.state?.engine as TriageState | undefined
  return s && typeof s === 'object' && Array.isArray(s.orden) ? s : null
}

export function TriageSim({ personId, liveSessionId = null, initialRun = null, history }: Props) {
  const sim = useSimRun({ simId: 'triage', liveSessionId, initialRun })
  const [state, setState] = useState<TriageState | null>(() => readState(initialRun))
  const [final, setFinal] = useState<{ score: number; state: TriageState } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState<Intento[]>(history)

  useEffect(() => { if (state && !final) sim.saveState({ engine: state }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function empezar() {
    setError(null)
    try {
      await sim.start({ fresh: Boolean(state), meta: { sim: 'triage' } })
      setFinal(null)
      setState(newTriageState(`${personId}:${intentos.length}`))
      sim.emit('mandate.viewed', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar')
    }
  }

  function avanzar() {
    if (!state) return
    try {
      const next = advance(state)
      setState(next)
      if (next.fase === 'caso') sim.emit('case.opened', { caseId: next.orden[next.actual], n: next.actual + 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo avanzar')
    }
  }

  function diagnosticar(enfoque: TriageEnfoque, paso: TriagePaso) {
    if (!state) return
    try {
      const caso = currentCase(state)!
      const next = answerCase(state, enfoque, paso)
      setState(next)
      const r = next.respuestas[next.respuestas.length - 1]
      sim.decision(`${caso.id}.enfoque`, enfoque, { label: `${caso.empresa} · enfoque`, valueLabel: ENFOQUE_LABEL[enfoque], pts: r.ptsEnfoque })
      sim.decision(`${caso.id}.paso`, paso, { label: `${caso.empresa} · primer paso`, valueLabel: PASO_LABEL[paso], pts: r.ptsPaso })
      sim.emit('case.answered', { caseId: caso.id, pts: r.pts, capAplicado: r.capAplicado })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnóstico incompleto')
    }
  }

  async function cerrar() {
    if (!state) return
    try {
      const res = finishTriage(state)
      setFinal({ score: res.score, state: res.state })
      setState(res.state)
      await sim.complete({
        score: res.score,
        summary: {
          headline: res.debrief.cierre.titulo,
          errores: res.debrief.breakdown.map((b) => ({ tag: b.tag, count: b.count })),
          puntos: res.state.respuestas.reduce((a, r) => a + r.pts, 0),
          capados: res.state.respuestas.filter((r) => r.capAplicado).length,
        },
        state: { engine: res.state },
      })
      setIntentos((xs) => [{ score: res.score, completedAt: new Date().toISOString() }, ...xs])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar')
    }
  }

  const terminado = final ?? (state?.fase === 'final' && sim.run?.status === 'completada' ? { score: sim.run.score ?? 0, state } : null)

  return (
    <div className="sim-react">
      {error ? <div className="alerta alerta-error">{error}</div> : null}
      {sim.status === 'error' ? <div className="alerta alerta-aviso">No pudimos registrar en el campus: {sim.error}. Podés seguir jugando.</div> : null}
      {terminado ? <InformeFinal state={terminado.state} score={terminado.score} onOtra={empezar} />
        : !state ? <Mandato onClick={empezar} boton={intentos.length ? 'Jugar de nuevo · empezar la semana' : 'Aceptar el rol · empezar la semana'} />
          : state.fase === 'mandato' ? <Mandato onClick={avanzar} boton="Empezar el triage · caso 1" />
            : state.fase === 'caso' ? <FaseCaso key={state.actual} state={state} onDiagnosticar={diagnosticar} />
              : state.fase === 'feedback' ? <FaseFeedback state={state} onSiguiente={avanzar} onCerrar={cerrar} />
                : <div className="card"><p>Ya diagnosticaste los 12 casos.</p><button type="button" className="btn btn-primario" onClick={cerrar}>Ver el informe final →</button></div>}
      <HistorialIntentos intentos={intentos} />
    </div>
  )
}

function Mandato({ onClick, boton }: { onClick: () => void; boton: string }) {
  return (
    <div className="card sim-angosto">
      <div className="fila"><span className="badge badge-ficticio">Caso ficticio</span><span className="badge">{TRIAGE_MANDATO.rol}</span></div>
      <h3>Tu semana de triage</h3>
      {TRIAGE_MANDATO.texto.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      <button type="button" className="btn btn-primario" onClick={onClick}>{boton}</button>
    </div>
  )
}

function FaseCaso({ state, onDiagnosticar }: { state: TriageState; onDiagnosticar: (e: TriageEnfoque, p: TriagePaso) => void }) {
  const caso = currentCase(state)
  const [enfoque, setEnfoque] = useState<TriageEnfoque | null>(null)
  const [paso, setPaso] = useState<TriagePaso | null>(null)
  if (!caso) return null
  return (
    <>
      <div className="fila sim-progreso">
        <div className="sim-barra"><div style={{ width: `${(state.actual / TRIAGE_CASES.length) * 100}%` }} /></div>
        <span className="chico muted">Caso {state.actual + 1} de {TRIAGE_CASES.length}</span>
      </div>
      <div className="sim-dos">
        <div className="card">
          <span className="badge">{caso.empresa}</span>
          <h3>{caso.titulo}</h3>
          <p className="sim-pedido">{caso.pedido}</p>
          <p>{caso.brief}</p>
        </div>
        <form className="card" onSubmit={(e) => { e.preventDefault(); if (enfoque && paso) onDiagnosticar(enfoque, paso) }}>
          <h3>Tu diagnóstico</h3>
          <fieldset className="sim-fieldset">
            <legend>1 · ¿Qué enfoque calza con el problema?</legend>
            {ENFOQUES.map((o) => (
              <label key={o.value} className="sim-opt sim-opt-larga">
                <input type="radio" name="enfoque" value={o.value} checked={enfoque === o.value} onChange={() => setEnfoque(o.value)} required />
                <span><strong>{o.label}</strong> <span className="muted">· {o.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <fieldset className="sim-fieldset">
            <legend>2 · ¿Cuál es el primer paso sensato?</legend>
            {PASOS.map((o) => (
              <label key={o.value} className="sim-opt sim-opt-larga">
                <input type="radio" name="paso" value={o.value} checked={paso === o.value} onChange={() => setPaso(o.value)} required />
                <span><strong>{o.label}</strong> <span className="muted">· {o.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-primario" disabled={!enfoque || !paso}>Diagnosticar</button>
        </form>
      </div>
    </>
  )
}

function FaseFeedback({ state, onSiguiente, onCerrar }: { state: TriageState; onSiguiente: () => void; onCerrar: () => void }) {
  const r = state.respuestas[state.respuestas.length - 1]
  const caso = r ? caseById.get(r.caseId) : undefined
  if (!r || !caso) return null
  const ultimo = state.respuestas.length >= TRIAGE_CASES.length
  const acumulado = state.respuestas.reduce((a, x) => a + x.pts, 0)
  const claseE = r.ptsEnfoque >= PTS_MAX_ENFOQUE ? 'ok' : r.ptsEnfoque <= 2 ? 'mal' : ''
  const claseP = r.ptsPaso >= PTS_MAX_PASO ? 'ok' : r.ptsPaso <= 1 ? 'mal' : ''
  return (
    <div className="card sim-angosto">
      <span className="badge">{caso.empresa}</span>
      <h3>{caso.titulo} · caso {state.respuestas.length} de {TRIAGE_CASES.length}</h3>
      <div className="sim-pts">
        <div className="sim-pts-num">{r.pts}<span> / {PTS_MAX_CASO} pts</span></div>
        <span className="chico muted">Acumulado: {acumulado} pts en {state.respuestas.length} casos</span>
      </div>
      <div className={`sim-feedback ${claseE}`}>
        <strong>Enfoque: {ENFOQUE_LABEL[r.enfoque]} · {r.ptsEnfoque}/{PTS_MAX_ENFOQUE}</strong><br />
        {caso.enfoques[r.enfoque].feedback}
      </div>
      <div className={`sim-feedback ${claseP}`}>
        <strong>Primer paso: {PASO_LABEL[r.paso]} · {r.ptsPaso}/{PTS_MAX_PASO}</strong><br />
        {caso.pasos[r.paso].feedback}
      </div>
      {r.capAplicado ? (
        <div className="alerta alerta-aviso">
          Regla de oro violada: elegiste un enfoque que aprende de datos y un primer paso que no los mira. Un modelo sin datos auditados es una promesa, no un plan: el caso queda capado en {CAP_SIN_DATOS} pts.
        </div>
      ) : null}
      <p className="sim-lectura"><strong>La lectura del caso:</strong> {caso.debrief}</p>
      <button type="button" className="btn btn-primario" onClick={ultimo ? onCerrar : onSiguiente}>
        {ultimo ? 'Ver el informe final →' : 'Siguiente caso →'}
      </button>
    </div>
  )
}

function InformeFinal({ state, score, onOtra }: { state: TriageState; score: number; onOtra: () => void }) {
  const { debrief } = finishTriage(state)
  const banda = score >= 70 ? 'alta' : score >= 50 ? 'media' : 'baja'
  return (
    <>
      <div className="sim-score-fila">
        <div className="sim-score">{score}<span> / 100</span></div>
        <span className="chico muted">{TRIAGE_CASES.length} casos diagnosticados como CTO de Grupo Aconcagua</span>
        <button type="button" className="btn btn-sm" onClick={onOtra}>Jugar de nuevo</button>
      </div>
      <div className={`card sim-cierre banda-${banda}`}>
        <h3>{debrief.cierre.titulo}</h3>
        <p>{debrief.cierre.texto}</p>
      </div>
      {debrief.breakdown.length > 0 ? (
        <div className="card">
          <h3>Tu patrón de errores</h3>
          <table className="tabla"><tbody>
            {debrief.breakdown.map((b) => <tr key={b.tag}><td>{b.label}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>×{b.count}</td></tr>)}
          </tbody></table>
        </div>
      ) : null}
      <div className="card">
        <h3>Caso por caso</h3>
        {debrief.porCaso.map((c) => (
          <details key={c.caseId} className="sim-debrief-item">
            <summary className="fila">
              <strong>{c.empresa}</strong>
              <span className="chico muted">{ENFOQUE_LABEL[c.enfoque]} + {PASO_LABEL[c.paso].toLowerCase()}</span>
              <span className={`badge ${c.pts >= 9 ? 'badge-ok' : c.pts >= 6 ? 'sim-badge-ambar' : 'sim-badge-rojo'}`} style={{ marginLeft: 'auto' }}>
                {c.pts}/{PTS_MAX_CASO}{c.capAplicado ? ' · capado' : ''}
              </span>
            </summary>
            <p>{c.feedbackEnfoque}</p>
            <p>{c.feedbackPaso}</p>
            <p className="muted"><strong>La lectura:</strong> {c.debrief}</p>
          </details>
        ))}
      </div>
    </>
  )
}
