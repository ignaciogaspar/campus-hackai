// Sim "La Cotización" (Bloque 02 · Build) — motor puro determinístico.
// Mismo estado + mismas decisiones → mismo resultado. Sin RNG, sin Date.now
// (el TTL recibe `now` por parámetro), sin store: el estado serializable viaja
// opaco en ProgramSimSession.state.
//
// Dificultad (escalera de los 4 sims del programa): este es el PRIMER escalón —
// single-shot, 10 decisiones + una pasada de revisión, resultado recién al
// confirmar. Le siguen triage (feedback inmediato), hitl (diseño de sistema)
// y adopcion (dinámico secuencial).
//
// Escenario: Distribuidora Pampa Sur S.A. (Rosario) recibió una cotización de
// USD 32.000 · 10 renglones · 16 semanas. El alumno, como gerente general,
// decide renglón por renglón: construir, comprar o tercerizar.
//
// Scoring 70/20/10:
//   70 — aciertos por renglón (óptima 7 · aceptable 3 · mala 0)
//   20 — coherencia del plan (7 reglas R1–R7; cada violación resta 4, piso 0)
//   10 — proceso (consultar al equipo al menos una vez: 4; revisión que no
//        empeora renglones: 6, cada cambio a peor resta 3)

import {
  RENGLONES,
  CONSULTAS,
  REGLAS_COHERENCIA,
  CIERRES_COTIZACION,
  renglonById,
  consultaById,
} from '@/lib/sims/data/cotizacion'

// ─── Tipos (data/sims/cotizacion.ts los importa con `import type`) ───

export type CotizacionOpcion = 'construir' | 'comprar' | 'tercerizar'
export type CotizacionFase = 'decision' | 'revision' | 'resultado'
export type CotizacionNivel = 'optima' | 'aceptable' | 'mala'

export interface RenglonSpec {
  id: string
  titulo: string
  /** Qué cotizó el proveedor, tal cual el presupuesto. */
  detalle: string
  montoUsd: number
  semanas: number
  optima: CotizacionOpcion
  aceptable: CotizacionOpcion
  /** Un texto de debrief por opción (30 en total). */
  debrief: Record<CotizacionOpcion, string>
}

export interface ConsultaSpec {
  id: string
  renglonId: string
  /** Quién responde en Pampa Sur (o afuera). */
  quien: string
  pregunta: string
  respuesta: string
}

export interface ReglaCoherencia {
  id: string // 'R1'..'R7'
  titulo: string
  texto: string
  /** Predicado sobre el plan completo (solo decisiones, sin estado). */
  aplica: (decisiones: Record<string, CotizacionOpcion>) => boolean
}

export interface CierreSpec {
  /** Score mínimo (inclusive) de la banda. */
  min: number
  titulo: string
  texto: string
}

export interface CambioRevision {
  renglonId: string
  de: CotizacionOpcion
  a: CotizacionOpcion
}

export interface CotizacionRenglonResultado {
  renglonId: string
  titulo: string
  montoUsd: number
  eleccion: CotizacionOpcion
  nivel: CotizacionNivel
  puntos: number
  texto: string
}

export interface CotizacionDebrief {
  renglones: CotizacionRenglonResultado[]
  reglasVioladas: { id: string; titulo: string; texto: string }[]
  cierre: { titulo: string; texto: string }
}

export interface CotizacionResultado extends CotizacionDebrief {
  score: number // 0..100
  aciertos: number // 0..70
  coherencia: number // 0..20
  proceso: number // 0..10
}

export interface CotizacionState {
  fase: CotizacionFase
  /** renglonId → opción elegida (parcial hasta enviar). */
  decisiones: Partial<Record<string, CotizacionOpcion>>
  consultasUsadas: string[]
  cambiosRevision: CambioRevision[]
  resultado?: CotizacionResultado
}

// ─── Constantes ───

export const MAX_CONSULTAS = 3
/** TTL de la sesión activa: pasado esto, la UI ofrece descartar y arrancar de nuevo. */
export const COTIZACION_TTL_MS = 45 * 60 * 1000

export const PUNTOS_OPTIMA = 7
export const PUNTOS_ACEPTABLE = 3
export const PUNTOS_MALA = 0

// ─── Transiciones ───

export function estadoInicial(): CotizacionState {
  return { fase: 'decision', decisiones: {}, consultasUsadas: [], cambiosRevision: [] }
}

/** ¿La sesión activa venció? (now llega de afuera: el motor no mira el reloj). */
export function sesionVencida(startedAt: number, now: number): boolean {
  return now - startedAt > COTIZACION_TTL_MS
}

export function usarConsulta(state: CotizacionState, consultaId: string): CotizacionState {
  if (state.fase !== 'decision') throw new Error('Las consultas al equipo son antes de enviar el plan.')
  if (!consultaById.has(consultaId)) throw new Error('Consulta inexistente.')
  if (state.consultasUsadas.includes(consultaId)) return state
  if (state.consultasUsadas.length >= MAX_CONSULTAS)
    throw new Error(`Ya usaste tus ${MAX_CONSULTAS} consultas al equipo.`)
  return { ...state, consultasUsadas: [...state.consultasUsadas, consultaId] }
}

export function decidir(
  state: CotizacionState,
  renglonId: string,
  opcion: CotizacionOpcion
): CotizacionState {
  if (state.fase !== 'decision')
    throw new Error('El plan ya fue enviado — los cambios van por la revisión.')
  if (!renglonById.has(renglonId)) throw new Error('Renglón inexistente.')
  return { ...state, decisiones: { ...state.decisiones, [renglonId]: opcion } }
}

export function enviarDecisiones(state: CotizacionState): CotizacionState {
  if (state.fase !== 'decision') throw new Error('El plan ya fue enviado.')
  const faltan = RENGLONES.filter((r) => !state.decisiones[r.id])
  if (faltan.length > 0)
    throw new Error(`Faltan decidir ${faltan.length} renglones antes de enviar el plan.`)
  return { ...state, fase: 'revision' }
}

export function cambiarEnRevision(
  state: CotizacionState,
  renglonId: string,
  opcion: CotizacionOpcion
): CotizacionState {
  if (state.fase !== 'revision') throw new Error('Los cambios de renglón son en la revisión.')
  const renglon = renglonById.get(renglonId)
  if (!renglon) throw new Error('Renglón inexistente.')
  const anterior = state.decisiones[renglonId]
  if (!anterior || anterior === opcion) return state
  return {
    ...state,
    decisiones: { ...state.decisiones, [renglonId]: opcion },
    cambiosRevision: [...state.cambiosRevision, { renglonId, de: anterior, a: opcion }],
  }
}

// ─── Scoring ───

export function puntosDe(renglon: RenglonSpec, opcion: CotizacionOpcion): number {
  if (opcion === renglon.optima) return PUNTOS_OPTIMA
  if (opcion === renglon.aceptable) return PUNTOS_ACEPTABLE
  return PUNTOS_MALA
}

export function nivelDe(renglon: RenglonSpec, opcion: CotizacionOpcion): CotizacionNivel {
  if (opcion === renglon.optima) return 'optima'
  if (opcion === renglon.aceptable) return 'aceptable'
  return 'mala'
}

function cierreParaScore(score: number): CierreSpec {
  const orden = [...CIERRES_COTIZACION].sort((a, b) => b.min - a.min)
  return orden.find((c) => score >= c.min) ?? orden[orden.length - 1]
}

export function scoreCotizacion(state: CotizacionState): CotizacionResultado {
  const decisiones = state.decisiones as Record<string, CotizacionOpcion>

  // 70 — aciertos
  const renglones: CotizacionRenglonResultado[] = RENGLONES.map((r) => {
    const eleccion = decisiones[r.id]
    const puntos = puntosDe(r, eleccion)
    return {
      renglonId: r.id,
      titulo: r.titulo,
      montoUsd: r.montoUsd,
      eleccion,
      nivel: nivelDe(r, eleccion),
      puntos,
      texto: r.debrief[eleccion],
    }
  })
  const aciertos = renglones.reduce((acc, r) => acc + r.puntos, 0)

  // 20 — coherencia
  const violadas = REGLAS_COHERENCIA.filter((regla) => regla.aplica(decisiones))
  const coherencia = Math.max(0, 20 - 4 * violadas.length)

  // 10 — proceso
  const empeoraron = state.cambiosRevision.filter((c) => {
    const r = renglonById.get(c.renglonId)
    return r ? puntosDe(r, c.a) < puntosDe(r, c.de) : false
  }).length
  const proceso =
    (state.consultasUsadas.length > 0 ? 4 : 0) + Math.max(0, 6 - 3 * empeoraron)

  const score = aciertos + coherencia + proceso
  const cierre = cierreParaScore(score)

  return {
    score,
    aciertos,
    coherencia,
    proceso,
    renglones,
    reglasVioladas: violadas.map(({ id, titulo, texto }) => ({ id, titulo, texto })),
    cierre: { titulo: cierre.titulo, texto: cierre.texto },
  }
}

/** Finish: congela el resultado en el estado y lo devuelve con el score 0..100. */
export function confirmar(state: CotizacionState): {
  state: CotizacionState
  score: number
  debrief: CotizacionDebrief
} {
  if (state.fase !== 'revision')
    throw new Error('Confirmá el plan desde la revisión, con los 10 renglones decididos.')
  const resultado = scoreCotizacion(state)
  const next: CotizacionState = { ...state, fase: 'resultado', resultado }
  return {
    state: next,
    score: resultado.score,
    debrief: {
      renglones: resultado.renglones,
      reglasVioladas: resultado.reglasVioladas,
      cierre: resultado.cierre,
    },
  }
}

// Re-export del contenido para que la UI importe todo desde el motor.
export { RENGLONES, CONSULTAS, REGLAS_COHERENCIA, CIERRES_COTIZACION, renglonById, consultaById }
