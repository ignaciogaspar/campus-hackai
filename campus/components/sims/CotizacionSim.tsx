'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CONSULTAS, MAX_CONSULTAS, RENGLONES, cambiarEnRevision, confirmar, decidir, enviarDecisiones,
  estadoInicial, usarConsulta, type CotizacionOpcion, type CotizacionResultado, type CotizacionState,
} from '@/lib/sims/engines/cotizacion'
import { CASO_COTIZACION, TOTAL_COTIZACION_USD } from '@/lib/sims/data/cotizacion'
import type { SimRun } from '@/lib/sims/types'
import { useSimRun } from './useSimRun'
import { HistorialIntentos, type Intento } from './HistorialIntentos'

/* La Cotización · Distribuidora Pampa Sur (caso ficticio). Portado de
   ../mbt (motor puro en lib/sims/engines/cotizacion.ts). Cada decisión se
   registra como evento `decision` (r01…r10) y el estado se guarda para retomar. */

const usd = (v: number) => `USD ${Math.round(v).toLocaleString('es-AR')}`
const OPCIONES: { value: CotizacionOpcion; label: string }[] = [
  { value: 'construir', label: 'Construir' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'tercerizar', label: 'Tercerizar' },
]
const OPCION_LABEL: Record<CotizacionOpcion, string> = { construir: 'Construir', comprar: 'Comprar', tercerizar: 'Tercerizar' }
const NIVEL: Record<string, { clase: string; label: string }> = {
  optima: { clase: 'badge-ok', label: 'óptima' },
  aceptable: { clase: 'sim-badge-ambar', label: 'aceptable' },
  mala: { clase: 'sim-badge-rojo', label: 'a repensar' },
}

interface Props {
  liveSessionId?: string | null
  initialRun?: SimRun | null
  history: Intento[]
}

function readState(run: SimRun | null | undefined): CotizacionState | null {
  const s = run?.state?.engine as CotizacionState | undefined
  return s && typeof s === 'object' && s.fase ? s : null
}

export function CotizacionSim({ liveSessionId = null, initialRun = null, history }: Props) {
  const sim = useSimRun({ simId: 'cotizacion', liveSessionId, initialRun })
  const [state, setState] = useState<CotizacionState | null>(() => readState(initialRun))
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState<Intento[]>(history)

  useEffect(() => { if (state && state.fase !== 'resultado') sim.saveState({ engine: state }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function empezar() {
    setError(null)
    try {
      await sim.start({ fresh: Boolean(state), meta: { sim: 'cotizacion' } })
      setState(estadoInicial())
      sim.emit('mandate.accepted', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar')
    }
  }

  function elegir(renglonId: string, opcion: CotizacionOpcion) {
    if (!state) return
    try {
      const next = decidir(state, renglonId, opcion)
      setState(next)
      const r = RENGLONES.find((x) => x.id === renglonId)
      sim.decision(renglonId, opcion, { label: r?.titulo ?? renglonId, valueLabel: OPCION_LABEL[opcion], fase: 'decision' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Movimiento inválido')
    }
  }

  function consultar(id: string) {
    if (!state) return
    try {
      setState(usarConsulta(state, id))
      const q = CONSULTAS.find((x) => x.id === id)
      sim.emit('consulted', { consultaId: id, renglonId: q?.renglonId, quien: q?.quien })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    }
  }

  function enviar() {
    if (!state) return
    try {
      setState(enviarDecisiones(state))
      sim.emit('plan.submitted', { decisiones: state.decisiones, consultas: state.consultasUsadas.length })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Faltan renglones')
    }
  }

  function cambiar(renglonId: string, opcion: CotizacionOpcion) {
    if (!state) return
    const de = state.decisiones[renglonId]
    try {
      const next = cambiarEnRevision(state, renglonId, opcion)
      if (next === state) return
      setState(next)
      const r = RENGLONES.find((x) => x.id === renglonId)
      sim.emit('plan.revised', { renglonId, de, a: opcion })
      sim.decision(renglonId, opcion, { label: r?.titulo ?? renglonId, valueLabel: OPCION_LABEL[opcion], fase: 'revision' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar')
    }
  }

  async function confirmarPlan() {
    if (!state) return
    try {
      const res = confirmar(state)
      setState(res.state)
      const resultado = res.state.resultado!
      await sim.complete({
        score: res.score,
        summary: {
          headline: resultado.cierre.titulo,
          aciertos: resultado.aciertos,
          coherencia: resultado.coherencia,
          proceso: resultado.proceso,
          reglasVioladas: resultado.reglasVioladas.map((r) => r.id),
          consultas: res.state.consultasUsadas.length,
          cambiosRevision: res.state.cambiosRevision.length,
        },
        state: { engine: res.state },
      })
      setIntentos((xs) => [{ score: res.score, completedAt: new Date().toISOString() }, ...xs])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar')
    }
  }

  const resultado = state?.resultado
  return (
    <div className="sim-react">
      {error ? <div className="alerta alerta-error">{error}</div> : null}
      {sim.status === 'error' ? <div className="alerta alerta-aviso">No pudimos registrar en el campus: {sim.error}. Podés seguir jugando.</div> : null}
      {!state ? <Mandato onStart={empezar} jugado={intentos.length > 0} />
        : state.fase === 'decision' ? <FaseDecision state={state} onElegir={elegir} onConsultar={consultar} onEnviar={enviar} />
          : state.fase === 'revision' ? <FaseRevision state={state} onCambiar={cambiar} onConfirmar={confirmarPlan} />
            : resultado ? <Debrief resultado={resultado} onOtra={empezar} /> : null}
      <HistorialIntentos intentos={intentos} />
    </div>
  )
}

function Mandato({ onStart, jugado }: { onStart: () => void; jugado: boolean }) {
  return (
    <div className="card sim-angosto">
      <div className="fila"><span className="badge badge-ficticio">Caso ficticio</span><span className="badge">{CASO_COTIZACION.bajada}</span></div>
      <h3>Tu encargo</h3>
      {CASO_COTIZACION.mandato.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      <ul className="sim-lista muted">{CASO_COTIZACION.contexto.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <button type="button" className="btn btn-primario" onClick={onStart}>
        {jugado ? 'Jugar de nuevo · desarmar la cotización' : 'Aceptar el encargo · desarmar la cotización'}
      </button>
    </div>
  )
}

function FaseDecision({ state, onElegir, onConsultar, onEnviar }: {
  state: CotizacionState
  onElegir: (id: string, o: CotizacionOpcion) => void
  onConsultar: (id: string) => void
  onEnviar: () => void
}) {
  const decididos = RENGLONES.filter((r) => state.decisiones[r.id]).length
  const agotadas = state.consultasUsadas.length >= MAX_CONSULTAS
  return (
    <>
      <div className="sim-statusbar">
        <span>Renglones decididos: <strong>{decididos}/{RENGLONES.length}</strong></span>
        <span>Cotizado como desarrollo a medida: <strong>{usd(TOTAL_COTIZACION_USD)}</strong></span>
        <span>Consultas: <strong>{state.consultasUsadas.length}/{MAX_CONSULTAS}</strong></span>
      </div>
      <div className="sim-layout">
        <div>
          <details className="card sim-releer">
            <summary>Releer el encargo de {CASO_COTIZACION.empresa}</summary>
            {CASO_COTIZACION.mandato.split('\n\n').map((p, i) => <p key={i} className="muted chico">{p}</p>)}
          </details>
          {RENGLONES.map((r, idx) => (
            <div key={r.id} className="sim-item">
              <div className="sim-item-head">
                <h3>{idx + 1}. {r.titulo}</h3>
                <span className="sim-monto">{usd(r.montoUsd)} · {r.semanas} sem</span>
              </div>
              <p className="muted chico">{r.detalle}</p>
              <div className="sim-opts" role="radiogroup" aria-label={r.titulo}>
                {OPCIONES.map((o) => (
                  <label key={o.value} className="sim-opt">
                    <input type="radio" name={`dec-${r.id}`} value={o.value} checked={state.decisiones[r.id] === o.value} onChange={() => onElegir(r.id, o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="fila" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primario" onClick={onEnviar} disabled={decididos < RENGLONES.length}>Enviar el plan a revisión →</button>
            {decididos < RENGLONES.length ? <span className="chico muted">Faltan {RENGLONES.length - decididos} renglones.</span> : null}
          </div>
          <p className="chico muted">Al enviar, vas a poder revisar el plan una vez antes de confirmarlo al directorio.</p>
        </div>
        <aside className="card sim-aside">
          <h3>Consultas al equipo · {state.consultasUsadas.length}/{MAX_CONSULTAS}</h3>
          <p className="chico muted">Tenés hasta {MAX_CONSULTAS} consultas por partida.</p>
          {CONSULTAS.map((q) => {
            const usada = state.consultasUsadas.includes(q.id)
            return (
              <div key={q.id} className={`sim-consulta${usada ? ' usada' : ''}`}>
                <div className="sim-consulta-quien">{q.quien}</div>
                <p className="sim-consulta-pregunta">{q.pregunta}</p>
                {usada ? <p className="sim-consulta-respuesta">{q.respuesta}</p> : (
                  <button type="button" className="btn btn-sm" disabled={agotadas} onClick={() => onConsultar(q.id)}>
                    {agotadas ? 'Sin consultas disponibles' : 'Consultar'}
                  </button>
                )}
              </div>
            )
          })}
        </aside>
      </div>
    </>
  )
}

function FaseRevision({ state, onCambiar, onConfirmar }: {
  state: CotizacionState
  onCambiar: (id: string, o: CotizacionOpcion) => void
  onConfirmar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  return (
    <div className="sim-layout">
      <div className="card">
        <h3>Revisión del plan: última pasada</h3>
        <p className="chico muted">Podés corregir renglones antes de confirmar. Cada cambio queda registrado: corregir a mejor no cuesta nada; los cambios a peor restan puntos de proceso.</p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Renglón</th><th style={{ textAlign: 'right' }}>Monto</th><th>Tu decisión</th></tr></thead>
            <tbody>
              {RENGLONES.map((r) => (
                <tr key={r.id}>
                  <td>{r.titulo}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{usd(r.montoUsd)}</td>
                  <td>
                    <select className="select" value={state.decisiones[r.id]} onChange={(e) => onCambiar(r.id, e.target.value as CotizacionOpcion)} aria-label={`Decisión para ${r.titulo}`}>
                      {OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.cambiosRevision.length > 0 ? <p className="chico muted">Cambios registrados en esta revisión: {state.cambiosRevision.length}.</p> : null}
        <button type="button" className="btn btn-accion" disabled={enviando} onClick={async () => { setEnviando(true); await onConfirmar(); setEnviando(false) }}>
          {enviando ? 'Confirmando…' : 'Confirmar el plan al directorio'}
        </button>
      </div>
      <aside className="card sim-aside">
        <h3>Lo que te dijo el equipo</h3>
        {state.consultasUsadas.length === 0 ? <p className="chico muted">No usaste consultas en esta partida.</p>
          : CONSULTAS.filter((q) => state.consultasUsadas.includes(q.id)).map((q) => (
            <div key={q.id} className="sim-consulta usada">
              <div className="sim-consulta-quien">{q.quien}</div>
              <p className="sim-consulta-pregunta">{q.pregunta}</p>
              <p className="sim-consulta-respuesta">{q.respuesta}</p>
            </div>
          ))}
      </aside>
    </div>
  )
}

function Debrief({ resultado, onOtra }: { resultado: CotizacionResultado; onOtra: () => void }) {
  const banda = resultado.score >= 70 ? 'alta' : resultado.score >= 50 ? 'media' : 'baja'
  const ordenados = useMemo(() => resultado.renglones, [resultado])
  return (
    <>
      <div className="sim-score-fila">
        <div className="sim-score">{resultado.score}<span> / 100</span></div>
        <div className="chico muted">
          Aciertos <strong>{resultado.aciertos}/70</strong> · Coherencia <strong>{resultado.coherencia}/20</strong> · Proceso <strong>{resultado.proceso}/10</strong>
        </div>
        <button type="button" className="btn btn-sm" onClick={onOtra}>Jugar de nuevo</button>
      </div>
      <div className={`card sim-cierre banda-${banda}`}>
        <h3>{resultado.cierre.titulo}</h3>
        <p>{resultado.cierre.texto}</p>
      </div>
      {resultado.reglasVioladas.length > 0 ? (
        <div className="card">
          <h3>Incoherencias del plan</h3>
          {resultado.reglasVioladas.map((r) => (
            <div key={r.id} className="sim-debrief-item">
              <span className="badge sim-badge-rojo">{r.id}</span> <strong>{r.titulo}</strong>
              <p>{r.texto}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="card">
        <h3>Renglón por renglón</h3>
        {ordenados.map((r) => (
          <div key={r.renglonId} className="sim-debrief-item">
            <div className="fila">
              <strong>{r.titulo}</strong>
              <span className="chico muted">{usd(r.montoUsd)} · elegiste {OPCION_LABEL[r.eleccion].toLowerCase()}</span>
              <span className={`badge ${NIVEL[r.nivel].clase}`}>{NIVEL[r.nivel].label}</span>
              <span className="chico muted" style={{ marginLeft: 'auto' }}>{r.puntos}/7 pts</span>
            </div>
            <p>{r.texto}</p>
          </div>
        ))}
      </div>
    </>
  )
}
