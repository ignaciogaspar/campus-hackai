// Catálogo de simuladores del campus (puro: sirve en server y en client).
// La seed (scripts/seed/sims.ts) lo copia a sim_definitions. Dos tipos:
// - 'html': archivo estático en public/sims/<id>.html que corre en un iframe y
//   habla con el campus por postMessage (public/sims/campus-sdk.js).
// - 'react': motor puro en lib/sims/engines + UI en components/sims.

export type SimKind = 'html' | 'react'

export interface SimDef {
  id: string
  title: string
  /** Bajada corta para listas. */
  description: string
  kind: SimKind
  /** Lo que se guarda en sim_definitions.url (el iframe para 'html'). */
  url: string
  /** Bloque / jornada sugerida del programa. */
  bloque: string
  /** Cómo se lee el score (null = el sim no puntúa al alumno). */
  scoreLabel: string | null
  /** Caso ficticio que usa (se muestra con badge). */
  ficticio: boolean
  /** Duración estimada en minutos. */
  minutos: number
}

export const SIMS: SimDef[] = [
  {
    id: 'cotizacion',
    title: 'La Cotización · Pampa Sur',
    description: 'Te llega el presupuesto de Distribuidora Pampa Sur: USD 32.000 en 10 renglones. Decidís renglón por renglón si construir, comprar o tercerizar.',
    kind: 'react',
    url: '/campus/sims/cotizacion',
    bloque: 'Build · construir, comprar o tercerizar',
    scoreLabel: 'Puntaje del plan (0 a 100)',
    ficticio: true,
    minutos: 25,
  },
  {
    id: 'triage',
    title: 'Triage modelo↔problema · Grupo Aconcagua',
    description: 'Doce gerentes del Grupo Aconcagua te piden "IA". Diagnosticás enfoque y primer paso para cada caso, con feedback inmediato.',
    kind: 'react',
    url: '/campus/sims/triage',
    bloque: 'Data · qué enfoque calza con qué problema',
    scoreLabel: 'Ojo clínico (0 a 100)',
    ficticio: true,
    minutos: 30,
  },
  {
    id: 'hitl',
    title: 'Checkpoint · reclamos de Conexa',
    description: 'Diseñás el flujo de reclamos de Conexa con humanos en el circuito: qué resuelve el sistema solo, dónde frena y espera una firma, y cuánto cuesta cada frontera.',
    kind: 'react',
    url: '/campus/sims/hitl',
    bloque: 'Agentes y sistemas · human in the loop',
    scoreLabel: 'Diseño del flujo (0 a 100)',
    ficticio: true,
    minutos: 25,
  },
  {
    id: 'adopcion',
    title: 'Piloto de Adopción · Alimentos del Plata',
    description: 'Seis meses y USD 50.000 para que Alimentos del Plata trabaje distinto. El score no premia licencias activas: premia lo que queda vivo y medido al presentar al directorio.',
    kind: 'react',
    url: '/campus/sims/adopcion',
    bloque: 'Dirigir la transformación',
    scoreLabel: 'Resultado del programa (0 a 100)',
    ficticio: true,
    minutos: 30,
  },
  {
    id: 'agrodecide',
    title: 'AgroDecide · negocio agrícola',
    description: 'Simulador de una campaña agrícola: margen, punto de equilibrio, Monte Carlo, riesgos y una recomendación con score según tu perfil de riesgo.',
    kind: 'html',
    url: '/sims/agrodecide.html',
    bloque: 'Decidir con modelos y simulación',
    scoreLabel: 'Score de viabilidad del planteo (0 a 100)',
    ficticio: false,
    minutos: 40,
  },
  {
    id: 'stockdecide',
    title: 'StockDecide · inventario de agroinsumos',
    description: 'Stock, demanda, costo financiero, Monte Carlo, canje y cuentas corrientes de un distribuidor de agroinsumos.',
    kind: 'html',
    url: '/sims/stockdecide.html',
    bloque: 'Decidir con modelos y simulación',
    scoreLabel: null,
    ficticio: false,
    minutos: 30,
  },
  {
    id: 'financesim',
    title: 'FinanceSim Builder · armá tu simulador',
    description: 'Constructor guiado: enmarcás la decisión, definís datos, variables y fórmulas, elegís capacidades y generás tu propio simulador financiero.',
    kind: 'html',
    url: '/sims/financesim.html',
    bloque: 'Construir con IA',
    scoreLabel: null,
    ficticio: false,
    minutos: 45,
  },
]

export const SIM_BY_ID = new Map(SIMS.map((s) => [s.id, s]))

export function getSimDef(id: string): SimDef | undefined {
  return SIM_BY_ID.get(id)
}

/** Ruta del simulador para el alumno (con clase en vivo opcional). */
export function simHref(simId: string, liveSessionId?: string | null): string {
  const base = `/campus/sims/${simId}`
  return liveSessionId ? `${base}?live=${liveSessionId}` : base
}

/** Vista de cohorte para el profesor. */
export function simProfesorHref(simId: string, liveSessionId?: string | null): string {
  const base = `/profesor/sims/${simId}`
  return liveSessionId ? `${base}?live=${liveSessionId}` : base
}
