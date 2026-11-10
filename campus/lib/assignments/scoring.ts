// Puntajes ponderados, nota final y revisiones discordantes. Puro (sin I/O).
import type { AssignmentSettings, ReviewRow, Rubric, Scores } from './types'

/** Normaliza la rúbrica que viene de la DB (jsonb) y descarta lo inválido. */
export function parseRubric(raw: unknown): Rubric {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      id: String(c.id ?? ''),
      criterion: String(c.criterion ?? c.id ?? ''),
      weight: Number(c.weight ?? 1) || 0,
      levels: (Array.isArray(c.levels) ? c.levels : [])
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map((l) => ({ score: Number(l.score ?? 0), label: String(l.label ?? ''), description: String(l.description ?? '') }))
        .sort((a, b) => a.score - b.score),
    }))
    .filter((c) => c.id && c.levels.length > 0)
}

export function criterionMax(c: Rubric[number]): number {
  return Math.max(...c.levels.map((l) => l.score))
}

/** Escala común de la rúbrica si todos los criterios comparten máximo (p. ej. 4), o null. */
export function commonScale(rubric: Rubric): number | null {
  const maxes = new Set(rubric.map(criterionMax))
  return maxes.size === 1 ? [...maxes][0] : null
}

/** Valida que los puntajes cubran cada criterio con un nivel existente. Devuelve errores. */
export function validateScores(rubric: Rubric, scores: Scores): string[] {
  const errors: string[] = []
  for (const c of rubric) {
    const s = scores[c.id]
    if (s === undefined || s === null || Number.isNaN(s)) errors.push(`Falta elegir un nivel en «${c.criterion}».`)
    else if (!c.levels.some((l) => l.score === s)) errors.push(`El nivel elegido en «${c.criterion}» no existe.`)
  }
  return errors
}

/**
 * Puntaje ponderado de una revisión en porcentaje (0–100):
 * Σ peso × (puntaje / máximo del criterio) / Σ peso. Ignora criterios sin puntaje.
 */
export function weightedPct(rubric: Rubric, scores: Scores): number | null {
  let num = 0
  let den = 0
  for (const c of rubric) {
    const s = scores[c.id]
    if (typeof s !== 'number' || Number.isNaN(s)) continue
    const max = criterionMax(c)
    if (max <= 0) continue
    const w = c.weight > 0 ? c.weight : 0
    num += w * (s / max)
    den += w
  }
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function stdev(xs: number[]): number | null {
  const m = mean(xs)
  if (m === null || xs.length < 2) return null
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10)

/** Promedio por criterio de un conjunto de revisiones (para mostrar al alumno). */
export function criterionMeans(rubric: Rubric, reviews: Pick<ReviewRow, 'scores'>[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const c of rubric) {
    const xs = reviews.map((r) => r.scores?.[c.id]).filter((s): s is number => typeof s === 'number')
    out[c.id] = round1(mean(xs))
  }
  return out
}

export interface ReviewScore {
  reviewId: string
  reviewerId: string
  isTeacher: boolean
  pct: number
  /** Desvío contra la referencia (docente si hay, si no la mediana de los otros pares). */
  deviation: number | null
  discordant: boolean
}

export interface SubmissionGrade {
  submissionId: string
  peerScores: ReviewScore[]
  teacher: ReviewScore | null
  peerMean: number | null
  peerMedian: number | null
  peerStdev: number | null
  /** Nota final (0–100) según el criterio configurado, o null si no hay revisiones enviadas. */
  final: number | null
  finalSource: 'docente' | 'pares' | 'mixta' | null
  /** Hay al menos una revisión discordante o la dispersión entre pares supera el umbral. */
  discordant: boolean
  discordReasons: string[]
}

/**
 * Calcula la nota de una entrega a partir de sus revisiones enviadas.
 * Discordancia: una revisión de par se marca si se aparta más que el umbral de la referencia
 * (la revisión docente si existe; si no, la mediana de los pares cuando hay 3 o más). La entrega se marca
 * si alguna revisión es discordante o si el rango entre pares supera el umbral.
 */
export function gradeSubmission(
  submissionId: string,
  rubric: Rubric,
  reviews: ReviewRow[],
  settings: Pick<AssignmentSettings, 'gradeMode' | 'teacherWeight' | 'discordThreshold'>,
): SubmissionGrade {
  const sent = reviews.filter((r) => r.submission_id === submissionId && r.status === 'enviada')
  const scored = sent
    .map((r) => ({ r, pct: weightedPct(rubric, r.scores ?? {}) }))
    .filter((x): x is { r: ReviewRow; pct: number } => x.pct !== null)
  const teacherRow = scored.find((x) => x.r.is_teacher) ?? null
  const peers = scored.filter((x) => !x.r.is_teacher)
  const peerPcts = peers.map((x) => x.pct)
  const threshold = settings.discordThreshold
  const reasons: string[] = []

  // Referencia: el docente si revisó; si no, la mediana de los pares (con 3 o más; con 2 no se
  // puede saber cuál se aparta y queda solo la marca de rango).
  const peerRef = peerPcts.length >= 3 ? median(peerPcts) : null
  const peerScores: ReviewScore[] = peers.map((x) => {
    const ref = teacherRow ? teacherRow.pct : peerRef
    const deviation = ref === null ? null : round1(x.pct - ref)
    const discordant = deviation !== null && Math.abs(deviation) > threshold
    return { reviewId: x.r.id, reviewerId: x.r.reviewer_id, isTeacher: false, pct: x.pct, deviation, discordant }
  })
  const flagged = peerScores.filter((s) => s.discordant).length
  if (flagged) reasons.push(`${flagged} revisión${flagged > 1 ? 'es' : ''} se aparta${flagged > 1 ? 'n' : ''} más de ${threshold} puntos de ${teacherRow ? 'la del docente' : 'la mediana de pares'}`)
  if (peerPcts.length >= 2) {
    const range = Math.max(...peerPcts) - Math.min(...peerPcts)
    if (range > threshold) reasons.push(`rango entre pares de ${round1(range)} puntos`)
  }

  const peerMean = round1(mean(peerPcts))
  const peerMedian = round1(median(peerPcts))
  const teacher = teacherRow
    ? { reviewId: teacherRow.r.id, reviewerId: teacherRow.r.reviewer_id, isTeacher: true, pct: teacherRow.pct, deviation: null, discordant: false }
    : null

  let final: number | null = null
  let finalSource: SubmissionGrade['finalSource'] = null
  switch (settings.gradeMode) {
    case 'docente-o-pares':
      if (teacher) [final, finalSource] = [teacher.pct, 'docente']
      else if (peerMean !== null) [final, finalSource] = [peerMean, 'pares']
      break
    case 'media-pares':
      if (peerMean !== null) [final, finalSource] = [peerMean, 'pares']
      break
    case 'mediana-pares':
      if (peerMedian !== null) [final, finalSource] = [peerMedian, 'pares']
      break
    case 'mixta': {
      const w = Math.min(1, Math.max(0, settings.teacherWeight))
      if (teacher && peerMean !== null) [final, finalSource] = [round1(w * teacher.pct + (1 - w) * peerMean), 'mixta']
      else if (teacher) [final, finalSource] = [teacher.pct, 'docente']
      else if (peerMean !== null) [final, finalSource] = [peerMean, 'pares']
      break
    }
  }

  return {
    submissionId,
    peerScores,
    teacher,
    peerMean,
    peerMedian,
    peerStdev: round1(stdev(peerPcts)),
    final,
    finalSource,
    discordant: reasons.length > 0,
    discordReasons: reasons,
  }
}

/** Convierte un porcentaje a la escala de la rúbrica (p. ej. 75% de 4 → 3,0). */
export function pctToScale(pct: number | null, scale: number | null): number | null {
  if (pct === null || scale === null) return null
  return Math.round((pct / 100) * scale * 10) / 10
}

export function formatPct(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
}
