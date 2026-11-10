// Tipos compartidos de simuladores (server y client).

export type SimRunStatus = 'en-curso' | 'completada' | 'abandonada'

export interface SimRun {
  id: string
  simId: string
  personId: string | null
  liveSessionId: string | null
  status: SimRunStatus
  score: number | null
  summary: Record<string, unknown>
  state: Record<string, unknown>
  startedAt: string
  completedAt: string | null
}

/** Evento que manda un sim (verbo estilo xAPI + payload). */
export interface SimEventInput {
  type: string
  payload?: Record<string, unknown>
  /** epoch ms del cliente (se guarda en payload._at). */
  at?: number
}

/**
 * Convención para que la vista del profesor arme la distribución:
 * `type: 'decision'` con `{key, value, label?, valueLabel?}`.
 * Se toma la última decisión de cada corrida por `key`.
 */
export interface SimDecisionPayload {
  key: string
  value: string
  label?: string
  valueLabel?: string
}

export interface SimRunStartResponse {
  run: SimRun
  /** true si se retomó una corrida en curso (con su `state`). */
  resumed: boolean
}

/** Límites de la API de eventos. */
export const SIM_LIMITS = {
  eventsPerRequest: 50,
  payloadBytes: 16_000,
  stateBytes: 400_000,
  summaryBytes: 32_000,
} as const

/** Resumen agregado para el proyector y la vista del profesor (lib/sims/summary.ts). */
export interface SimSummary {
  simId: string
  title: string
  liveSessionId: string | null
  scoreLabel: string | null
  runs: number
  participants: number
  completed: number
  inProgress: number
  avgScore: number | null
  medianScore: number | null
  /** Histograma 0-100 en 5 tramos (solo corridas completadas con score). */
  scoreBuckets: Array<{ label: string; min: number; max: number; count: number }>
  /** Distribución de la última decisión por corrida, por clave. */
  decisions: Array<{
    key: string
    label: string
    total: number
    options: Array<{ value: string; label: string; count: number }>
  }>
  /** Valores frecuentes de summary.headline (texto corto que manda cada sim al completar). */
  headlines: Array<{ text: string; count: number }>
  updatedAt: string
}
