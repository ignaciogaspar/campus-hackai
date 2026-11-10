// Sim "Triage modelo↔problema" (Bloque 03 · Data) — motor puro determinístico.
// El único RNG es el orden de los casos: rngFor(userId, 'triage', 'v1').
// Sin Date.now, sin store: el estado serializable viaja opaco en
// ProgramSimSession.state.
//
// Dificultad (escalera de los 4 sims del programa): SEGUNDO escalón —
// 12 casos × 2 decisiones con feedback inmediato tras cada caso. Antes viene
// cotizacion (single-shot); después hitl (diseño de sistema) y adopcion
// (dinámico secuencial).
//
// Escenario: el alumno es CTO de Grupo Aconcagua, un holding diversificado de
// 12 empresas. Cada gerente le trae un problema y pide "IA". Por caso decide:
//   1) el enfoque (reglas · ML clásico · LLM · red neuronal a medida · no
//      automatizar todavía) — hasta 6 pts
//   2) el primer paso (auditar datos · piloto medido · desarrollo completo ya ·
//      esperar) — hasta 4 pts
// Fórmula 60/40 por caso (6 + 4 = 10 pts). Regla global: enfoque ml|red + paso
// con tag 'sin-datos' → pts del caso = min(pts, 5). Score = suma/120 × 100.

import { rngFor } from '@/lib/sims/rng'
import {
  TRIAGE_CASES,
  caseById,
  TRIAGE_MANDATO,
  TRIAGE_CIERRES,
  TRIAGE_ERROR_LABELS,
} from '@/lib/sims/data/triage'

// ─── Tipos (data/sims/triage.ts los importa con `import type`) ───

export type TriageEnfoque = 'reglas' | 'ml' | 'llm' | 'red' | 'no-auto'
export type TriagePaso = 'datos' | 'piloto' | 'full' | 'esperar'
export type TriageFase = 'mandato' | 'caso' | 'feedback' | 'final'

export type TriageErrorTag =
  | 'sobre-ingenieria'
  | 'hype'
  | 'rigidez'
  | 'timidez'
  | 'sin-datos'
  | 'riesgo'

export interface TriageOpcion {
  pts: number
  tags: TriageErrorTag[]
  feedback: string
}

export interface TriageCaseSpec {
  id: string
  empresa: string
  titulo: string
  pedido: string // lo que pide el gerente, en una línea
  brief: string
  enfoques: Record<TriageEnfoque, TriageOpcion> // máx. exacto: 6 pts en una opción
  pasos: Record<TriagePaso, TriageOpcion> // máx. exacto: 4 pts en una opción
  debrief: string // cierre del caso: qué era lo óptimo y por qué
}

export interface TriageCierreSpec {
  min: number
  titulo: string
  texto: string
}

export interface TriageRespuesta {
  caseId: string
  enfoque: TriageEnfoque
  paso: TriagePaso
  ptsEnfoque: number
  ptsPaso: number
  /** Puntos del caso ya con la regla global aplicada. */
  pts: number
  capAplicado: boolean
}

export interface TriageState {
  fase: TriageFase
  orden: string[] // 12 caseIds barajados por usuario
  actual: number // índice en orden del caso en juego (o del último respondido, en feedback)
  respuestas: TriageRespuesta[]
}

export interface TriageDebrief {
  porCaso: {
    caseId: string
    empresa: string
    titulo: string
    enfoque: TriageEnfoque
    paso: TriagePaso
    pts: number
    capAplicado: boolean
    feedbackEnfoque: string
    feedbackPaso: string
    debrief: string
  }[]
  breakdown: { tag: TriageErrorTag; label: string; count: number }[]
  cierre: { titulo: string; texto: string }
}

// ─── Constantes ───

export const PTS_MAX_ENFOQUE = 6
export const PTS_MAX_PASO = 4
export const PTS_MAX_CASO = PTS_MAX_ENFOQUE + PTS_MAX_PASO
export const PTS_MAX_TOTAL = PTS_MAX_CASO * 12 // 120
export const CAP_SIN_DATOS = 5

// ─── Transiciones ───

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function newTriageState(userId: string): TriageState {
  const rng = rngFor(userId, 'triage', 'v1')
  return {
    fase: 'mandato',
    orden: shuffle(
      TRIAGE_CASES.map((c) => c.id),
      rng
    ),
    actual: 0,
    respuestas: [],
  }
}

export function currentCase(state: TriageState): TriageCaseSpec | undefined {
  const id = state.orden[state.actual]
  return id ? caseById.get(id) : undefined
}

export function answerCase(
  state: TriageState,
  enfoque: TriageEnfoque,
  paso: TriagePaso
): TriageState {
  if (state.fase !== 'caso') throw new Error('No hay un caso en juego para diagnosticar.')
  const caso = currentCase(state)
  if (!caso) throw new Error('Caso inexistente.')
  const opcionEnfoque = caso.enfoques[enfoque]
  const opcionPaso = caso.pasos[paso]
  if (!opcionEnfoque || !opcionPaso) throw new Error('Diagnóstico incompleto.')

  const bruto = opcionEnfoque.pts + opcionPaso.pts
  const capa =
    (enfoque === 'ml' || enfoque === 'red') && opcionPaso.tags.includes('sin-datos')
  const pts = capa ? Math.min(bruto, CAP_SIN_DATOS) : bruto

  const respuesta: TriageRespuesta = {
    caseId: caso.id,
    enfoque,
    paso,
    ptsEnfoque: opcionEnfoque.pts,
    ptsPaso: opcionPaso.pts,
    pts,
    capAplicado: capa && bruto > CAP_SIN_DATOS,
  }
  return { ...state, fase: 'feedback', respuestas: [...state.respuestas, respuesta] }
}

/** mandato → primer caso; feedback → siguiente caso o final. */
export function advance(state: TriageState): TriageState {
  if (state.fase === 'mandato') return { ...state, fase: 'caso', actual: 0 }
  if (state.fase === 'feedback') {
    const next = state.actual + 1
    if (next >= state.orden.length) return { ...state, fase: 'final' }
    return { ...state, fase: 'caso', actual: next }
  }
  throw new Error('No hay a dónde avanzar desde esta pantalla.')
}

// ─── Scoring ───

export function scoreGlobal(state: TriageState): number {
  const total = state.respuestas.reduce((acc, r) => acc + r.pts, 0)
  return Math.round((total / PTS_MAX_TOTAL) * 100)
}

export function errorBreakdown(state: TriageState): Partial<Record<TriageErrorTag, number>> {
  const out: Partial<Record<TriageErrorTag, number>> = {}
  const add = (tags: TriageErrorTag[]) => {
    for (const tag of tags) out[tag] = (out[tag] ?? 0) + 1
  }
  for (const r of state.respuestas) {
    const caso = caseById.get(r.caseId)
    if (!caso) continue
    if (r.ptsEnfoque < PTS_MAX_ENFOQUE) add(caso.enfoques[r.enfoque].tags)
    if (r.ptsPaso < PTS_MAX_PASO) add(caso.pasos[r.paso].tags)
  }
  return out
}

function cierreParaScore(score: number): TriageCierreSpec {
  const orden = [...TRIAGE_CIERRES].sort((a, b) => b.min - a.min)
  return orden.find((c) => score >= c.min) ?? orden[orden.length - 1]
}

/** Finish: solo con los 12 casos respondidos. Devuelve score 0..100 + debrief. */
export function finishTriage(state: TriageState): {
  state: TriageState
  score: number
  debrief: TriageDebrief
} {
  if (state.respuestas.length < TRIAGE_CASES.length)
    throw new Error('Todavía quedan casos sin diagnosticar.')
  const final: TriageState = { ...state, fase: 'final' }
  const score = scoreGlobal(final)
  const breakdownRaw = errorBreakdown(final)
  const breakdown = (Object.entries(breakdownRaw) as [TriageErrorTag, number][])
    .map(([tag, count]) => ({ tag, label: TRIAGE_ERROR_LABELS[tag], count }))
    .sort((a, b) => b.count - a.count)
  const cierre = cierreParaScore(score)

  return {
    state: final,
    score,
    debrief: {
      porCaso: final.respuestas.map((r) => {
        const caso = caseById.get(r.caseId)!
        return {
          caseId: r.caseId,
          empresa: caso.empresa,
          titulo: caso.titulo,
          enfoque: r.enfoque,
          paso: r.paso,
          pts: r.pts,
          capAplicado: r.capAplicado,
          feedbackEnfoque: caso.enfoques[r.enfoque].feedback,
          feedbackPaso: caso.pasos[r.paso].feedback,
          debrief: caso.debrief,
        }
      }),
      breakdown,
      cierre: { titulo: cierre.titulo, texto: cierre.texto },
    },
  }
}

// Re-export del contenido para que la UI importe todo desde el motor.
export { TRIAGE_CASES, caseById, TRIAGE_MANDATO, TRIAGE_CIERRES, TRIAGE_ERROR_LABELS }
