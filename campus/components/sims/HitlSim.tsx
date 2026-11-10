'use client'

import { useEffect, useState } from 'react'
import {
  COSTO_POR_MODO, DISENO_REFERENCIA, PASOS, SIN_LIMITE, casoById, correr, debriefHitl, nuevoEstado,
  type CaseResult, type ConfianzaMin, type HitlDesign, type HitlState, type Modo, type MontoMax, type Outcome, type PasoId,
} from '@/lib/sims/engines/hitl'
import { CASOS_HITL, MANDATO_HITL, MODO_LABELS, PASO_LABELS, PASOS_INFO } from '@/lib/sims/data/hitl'
import type { SimRun } from '@/lib/sims/types'
import { useSimRun } from './useSimRun'
import { HistorialIntentos, type Intento } from './HistorialIntentos'

/* Checkpoint · reclamos de Conexa (caso ficticio), human in the loop.
   Portado de ../mbt. El diseño se congela al correr el lunes de 20 reclamos. */

const ars = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const montoLabel = (n: number) => (n === SIN_LIMITE ? 'sin límite' : ars(n))
const MODOS: Modo[] = ['regla', 'ia', 'humano']
const MODO_HINTS: Record<Modo, string> = {
  regla: 'determinística, auditable, ciega al contexto',
  ia: 'lee texto libre y matices; probabilística',
  humano: 'criterio pleno, al precio de una nómina',
}
const MONTOS: Array<{ value: MontoMax; label: string }> = [
  { value: 25_000, label: '$25.000' }, { value: 75_000, label: '$75.000' }, { value: 200_000, label: '$200.000' }, { value: SIN_LIMITE, label: 'Sin límite' },
]
const CONFIANZAS: ConfianzaMin[] = [0.5, 0.7, 0.9]
const OUTCOME: Record<Outcome, { label: string; clase: string }> = {
  ok: { label: 'ok', clase: 'badge-ok' },
  leve: { label: 'error leve', clase: 'sim-badge-ambar' },
  abandono: { label: 'abandono', clase: 'sim-badge-rojo' },
  grave: { label: 'error grave', clase: 'sim-badge-rojo' },
}

interface Draft { pasos: Record<PasoId, Modo>; montoMax: MontoMax | null; confianzaMin: ConfianzaMin | null; enojadoAHumano: boolean }
const draftInicial = (): Draft => ({ pasos: Object.fromEntries(PASOS.map((p) => [p, 'humano'])) as Record<PasoId, Modo>, montoMax: null, confianzaMin: null, enojadoAHumano: false })

interface Props { personId: string; liveSessionId?: string | null; initialRun?: SimRun | null; history: Intento[] }

export function HitlSim({ personId, liveSessionId = null, initialRun = null, history }: Props) {
  const sim = useSimRun({ simId: 'hitl', liveSessionId, initialRun })
  const saved = initialRun?.state as { engine?: HitlState; draft?: Draft } | undefined
  const [state, setState] = useState<HitlState | null>(saved?.engine?.orden ? saved.engine : null)
  const [draft, setDraft] = useState<Draft>(saved?.draft ?? draftInicial())
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intentos, setIntentos] = useState<Intento[]>(history)

  useEffect(() => { if (state?.phase === 'diseno') sim.saveState({ engine: state, draft }) }, [state, draft]) // eslint-disable-line react-hooks/exhaustive-deps

  async function empezar() {
    setError(null)
    try {
      await sim.start({ fresh: Boolean(state), meta: { sim: 'hitl' } })
      setState(nuevoEstado(personId, intentos.length + 1))
      setDraft(draftInicial())
      setScore(null)
      sim.emit('mandate.accepted', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar')
    }
  }

  function setModo(paso: PasoId, m: Modo) {
    setDraft((d) => ({ ...d, pasos: { ...d.pasos, [paso]: m } }))
    sim.decision(`paso.${paso}`, m, { label: PASO_LABELS[paso], valueLabel: MODO_LABELS[m] })
  }

  async function correrLunes() {
    if (!state) return
    if (draft.montoMax === null) return setError('Elegí el tope de monto que la IA resuelve sola.')
    if (draft.confianzaMin === null) return setError('Elegí el umbral de confianza de clasificación.')
    setError(null)
    const design: HitlDesign = { pasos: draft.pasos, montoMax: draft.montoMax, confianzaMin: draft.confianzaMin, enojadoAHumano: draft.enojadoAHumano }
    const { resultados, metricas, score: s } = correr(design)
    const next: HitlState = { ...state, phase: 'resultados', design, resultados, metricas }
    setState(next)
    setScore(s)
    sim.decision('montoMax', String(design.montoMax), { label: 'Tope de monto sin humano', valueLabel: montoLabel(design.montoMax) })
    sim.decision('confianzaMin', String(design.confianzaMin), { label: 'Confianza mínima de clasificación', valueLabel: String(design.confianzaMin) })
    sim.decision('enojadoAHumano', design.enojadoAHumano ? 'si' : 'no', { label: 'Enojado → humano', valueLabel: design.enojadoAHumano ? 'Activado' : 'Desactivado' })
    for (const p of PASOS) sim.decision(`paso.${p}`, design.pasos[p], { label: PASO_LABELS[p], valueLabel: MODO_LABELS[design.pasos[p]] })
    const deb = debriefHitl(design, resultados, s)
    try {
      await sim.complete({
        score: s,
        summary: {
          headline: deb.veredicto.split('. ')[0].slice(0, 120),
          costoTotal: metricas.costoTotal,
          reputacion: metricas.reputacion,
          autonomia: Math.round(metricas.autonomia * 100),
          erroresGraves: metricas.erroresGraves,
          erroresLeves: metricas.erroresLeves,
          abandonos: metricas.abandonos,
        },
        state: { engine: next },
      })
      setIntentos((xs) => [{ score: s, completedAt: new Date().toISOString() }, ...xs])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el resultado')
    }
  }

  const finalScore = score ?? (state?.phase === 'resultados' ? sim.run?.score ?? null : null)
  return (
    <div className="sim-react">
      {error ? <div className="alerta alerta-error">{error}</div> : null}
      {!state ? <Mandato onStart={empezar} />
        : state.phase === 'diseno' ? <Diseno draft={draft} setDraft={setDraft} setModo={setModo} onCorrer={correrLunes} intento={state.intento} />
          : <Resultados state={state} score={finalScore ?? 0} onOtra={empezar} />}
      <HistorialIntentos intentos={intentos} />
    </div>
  )
}

function Mandato({ onStart }: { onStart: () => void }) {
  return (
    <div className="card sim-angosto">
      <div className="fila"><span className="badge badge-ficticio">Caso ficticio</span><span className="badge">Gerente de Experiencia de Cliente · Conexa</span></div>
      <h3>Tu mandato</h3>
      {MANDATO_HITL.map((p, i) => <p key={i}>{p}</p>)}
      <button type="button" className="btn btn-primario" onClick={onStart}>Aceptar el mandato · diseñar el flujo</button>
    </div>
  )
}

function Diseno({ draft, setDraft, setModo, onCorrer, intento }: {
  draft: Draft
  setDraft: (fn: (d: Draft) => Draft) => void
  setModo: (p: PasoId, m: Modo) => void
  onCorrer: () => Promise<void>
  intento: number
}) {
  const [corriendo, setCorriendo] = useState(false)
  const porCaso = PASOS.reduce((a, p) => a + COSTO_POR_MODO[draft.pasos[p]], 0)
  return (
    <div className="card" style={{ maxWidth: 880 }}>
      <p className="chico muted">Intento {intento} · el diseño se congela al correr: no hay feedback intermedio.</p>
      <h3>Los 6 pasos del flujo: ¿quién ejecuta cada uno?</h3>
      {PASOS_INFO.map((p) => (
        <div key={p.id} className="sim-item">
          <div className="sim-item-head"><h3>{p.titulo}</h3></div>
          <p className="muted chico">{p.descripcion}</p>
          <div className="sim-opts">
            {MODOS.map((m) => (
              <label key={m} className="sim-opt">
                <input type="radio" name={`paso-${p.id}`} checked={draft.pasos[p.id] === m} onChange={() => setModo(p.id, m)} />
                <span><strong>{MODO_LABELS[m]}</strong> <span className="chico muted">${COSTO_POR_MODO[m].toLocaleString('es-AR')}/caso</span></span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className="chico muted">{MODOS.map((m, i) => <span key={m}>{i > 0 ? ' · ' : ''}<strong>{MODO_LABELS[m]}</strong>: {MODO_HINTS[m]}</span>)}</p>

      <h3>Los umbrales de escalamiento</h3>
      <fieldset className="sim-fieldset">
        <legend>Tope de monto: hasta cuánto resuelve sola la IA o la regla; arriba, escala a una persona</legend>
        <div className="sim-opts">
          {MONTOS.map((o) => (
            <label key={o.value} className="sim-opt">
              <input type="radio" name="montoMax" checked={draft.montoMax === o.value} onChange={() => setDraft((d) => ({ ...d, montoMax: o.value }))} />
              <strong>{o.label}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sim-fieldset">
        <legend>Confianza mínima de clasificación: por debajo, el caso lo etiqueta una persona</legend>
        <div className="sim-opts">
          {CONFIANZAS.map((c) => (
            <label key={c} className="sim-opt">
              <input type="radio" name="confianzaMin" checked={draft.confianzaMin === c} onChange={() => setDraft((d) => ({ ...d, confianzaMin: c }))} />
              <strong>{c}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="sim-opt sim-opt-larga">
        <input type="checkbox" checked={draft.enojadoAHumano} onChange={(e) => setDraft((d) => ({ ...d, enojadoAHumano: e.target.checked }))} />
        <span><strong>Tono enojado o furioso → responde un humano</strong> <span className="chico muted">la respuesta (paso 5) se deriva por temperatura, no por monto</span></span>
      </label>

      <div className="sim-kpis" style={{ margin: '14px 0' }}>
        <div className="sim-kpi"><strong>{ars(CASOS_HITL.length * porCaso)}</strong><span>costo de gestión proyectado ({CASOS_HITL.length} reclamos × {ars(porCaso)}). Sin escalamientos ni errores: eso lo decide el lunes.</span></div>
      </div>
      <button type="button" className="btn btn-accion" disabled={corriendo} onClick={async () => { setCorriendo(true); await onCorrer(); setCorriendo(false) }}>
        {corriendo ? 'Corriendo el lunes…' : `Correr el lunes · ${CASOS_HITL.length} reclamos →`}
      </button>
    </div>
  )
}

function ResumenDiseno({ titulo, design }: { titulo: string; design: HitlDesign }) {
  return (
    <div className="chico">
      <strong>{titulo}</strong>
      <ul className="sim-lista">
        {PASOS.map((p) => <li key={p}>{PASO_LABELS[p]}: <strong>{MODO_LABELS[design.pasos[p]]}</strong></li>)}
        <li>Tope <strong>{montoLabel(design.montoMax)}</strong> · confianza <strong>{design.confianzaMin}</strong> · enojado → humano <strong>{design.enojadoAHumano ? 'sí' : 'no'}</strong></li>
      </ul>
    </div>
  )
}

function CasoRow({ r }: { r: CaseResult }) {
  const caso = casoById.get(r.caseId)
  if (!caso) return null
  const b = OUTCOME[r.resultado]
  return (
    <details className="sim-debrief-item">
      <summary className="fila">
        <strong>{caso.cliente}</strong>
        <span className="chico muted">{caso.titulo}</span>
        <span className="chico muted" style={{ marginLeft: 'auto' }}>{ars(r.costoGestion + r.costoErrores)}</span>
        <span className={`badge ${b.clase}`}>{b.label}</span>
      </summary>
      <p className="muted">{caso.texto}</p>
      <div className="tabla-scroll">
        <table className="tabla">
          <tbody>
            {r.pasos.map((p) => (
              <tr key={p.paso}>
                <td style={{ whiteSpace: 'nowrap' }}>{PASO_LABELS[p.paso]}<div className="chico muted">{MODO_LABELS[p.ejecutor]}{p.escalado ? ' · escalado' : ''}</div></td>
                <td className="chico">{p.nota}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ars(p.costoGestion)}{p.costoError > 0 ? <div style={{ color: 'var(--error)' }}>+{ars(p.costoError)}</div> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Resultados({ state, score, onOtra }: { state: HitlState; score: number; onOtra: () => void }) {
  const { design, resultados, metricas } = state
  if (!design || !resultados || !metricas) return null
  const deb = debriefHitl(design, resultados, score)
  const banda = score >= 85 ? 'alta' : score >= 65 ? 'media' : 'baja'
  const porCaso = new Map(resultados.map((r) => [r.caseId, r]))
  const orden = state.orden.map((id) => porCaso.get(id)).filter((r): r is CaseResult => Boolean(r))
  return (
    <>
      <div className="sim-score-fila">
        <div className="sim-score">{score}<span> / 100</span></div>
        <span className="chico muted">El lunes de los 20 reclamos contra tu diseño · intento {state.intento}</span>
        <button type="button" className="btn btn-sm" onClick={onOtra}>Rediseñar y volver a correr</button>
      </div>
      <div className={`card sim-cierre banda-${banda}`}><h3>El veredicto</h3><p>{deb.veredicto}</p></div>
      <div className="sim-kpis">
        <div className="sim-kpi"><strong>{ars(metricas.costoTotal)}</strong><span>costo total ({ars(metricas.costoGestion)} gestión · {ars(metricas.costoErrores)} errores)</span></div>
        <div className="sim-kpi"><strong>{metricas.reputacion}</strong><span>reputación / 100</span></div>
        <div className="sim-kpi"><strong>{Math.round(metricas.autonomia * 100)}%</strong><span>casos sin tocar un humano</span></div>
        <div className="sim-kpi"><strong>{metricas.erroresGraves}</strong><span>errores graves · {metricas.erroresLeves} leves · {metricas.abandonos} abandonos</span></div>
      </div>
      {deb.momentos.length > 0 ? (
        <div className="card"><h3>Los momentos del lunes</h3>
          {deb.momentos.map((m) => <div key={m.caseId} className="sim-debrief-item"><strong>{m.titulo}</strong><p>{m.texto}</p></div>)}
        </div>
      ) : null}
      <div className="card"><h3>Caso por caso: la cola del lunes</h3>{orden.map((r) => <CasoRow key={r.caseId} r={r} />)}</div>
      <div className="sim-dos">
        <div className="card"><h3>Paso por paso</h3>
          {deb.pasos.map((p) => <div key={p.paso} className="sim-debrief-item"><strong>{p.label}: {p.modoLabel}</strong><p>{p.texto}</p></div>)}
        </div>
        <div className="card"><h3>Tus umbrales</h3>
          {deb.umbrales.map((u) => <div key={u.clave} className="sim-debrief-item"><strong>{u.clave}</strong><p>{u.texto}</p></div>)}
          <details className="sim-debrief-item">
            <summary>Comparar con el diseño de referencia</summary>
            <ResumenDiseno titulo="Tu diseño" design={design} />
            <ResumenDiseno titulo="Diseño de referencia" design={DISENO_REFERENCIA} />
          </details>
        </div>
      </div>
    </>
  )
}
