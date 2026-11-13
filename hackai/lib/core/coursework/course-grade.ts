/* La nota de cursada: el promedio ponderado de las columnas de un alumno. Todo
   puro. Cuenta una columna si tiene peso mayor que cero y el alumno tiene una
   nota con número en ella; una tarea sin nota no es una columna, un ausente o
   una columna sin nota del alumno no cuentan, y el peso se reparte entre las que
   sí cuentan. Las reglas de recuperatorio y de mínimo para regularizar no se
   aplican: son hipótesis (docs/product/preguntas-abiertas.md). */
import type {
  ColumnKind,
  CourseCondition,
  CourseGradeCell,
  CourseGradeSummary,
  PassCounts,
  PassStatus,
  Promotion,
  StoredGrade,
  StoredWeight
} from '@/lib/core/coursework'
import { columnId } from '@/lib/core/coursework/grades'

export const MIN_WEIGHT = 0
export const MAX_WEIGHT = 100

/** El nombre con el que se guarda y se muestra la nota de cursada. */
export const COURSE_GRADE_NAME = 'Nota de cursada'

/** Si el peso sirve: un número de 0 a 100. */
export const isWeight = (weight: number) => Number.isFinite(weight) && weight >= MIN_WEIGHT && weight <= MAX_WEIGHT

const round2 = (value: number) => Math.round(value * 100) / 100

/** Sin configurar, la comisión no promociona; si el docente la marca promocionable, desde 7. Es un supuesto, no una
    regla de la Austral (docs/product/preguntas-abiertas.md). */
export const DEFAULT_PROMOTION: Promotion = { promotable: false, minimum: 7 }

/** La nota mínima para regularizar. La misma del SIU simulado (lib/adapters/siu-grades.ts). */
export const REGULAR_MINIMUM = 4

/** La promoción de la comisión: la que configuró el docente o, si nunca la tocó, la del SIU con el mínimo de 7. */
export const promotionOr = (stored: Promotion | null, section: { promotable: boolean } | undefined): Promotion =>
  stored ?? { ...DEFAULT_PROMOTION, promotable: section?.promotable ?? false }

/** Si la nota mínima de promoción sirve: de 4 a 10. */
export const isPromotionMinimum = (value: number) => Number.isFinite(value) && value >= REGULAR_MINIMUM && value <= 10

/** Cómo queda la cursada con esa nota: promociona, regular o desaprobada. */
export function conditionOf(value: number | null, promotion: Promotion): CourseCondition | null {
  if (value === null) return null
  if (promotion.promotable && value >= promotion.minimum) return 'promociona'
  return value >= REGULAR_MINIMUM ? 'regular' : 'desaprobado'
}

/** El peso de cada columna por id de columna (solo los que cuentan: mayores que cero). */
export function weightsById(weights: StoredWeight[]): Map<string, number> {
  return new Map(weights.filter((w) => w.weight > 0).map((w) => [columnId(w.kind, w.refId), w.weight]))
}

/** El promedio ponderado de las notas del alumno con los pesos, de dos decimales; `null` si ninguna cuenta. Solo
    cuentan las columnas de `validIds` (las que hoy existen en la comisión). */
export function weightedAverage(
  grades: Pick<StoredGrade, 'kind' | 'refId' | 'value'>[],
  weights: Map<string, number>,
  validIds: Set<string>
): number | null {
  let total = 0
  let sum = 0
  for (const g of grades) {
    const id = columnId(g.kind, g.refId)
    const weight = weights.get(id)
    if (g.kind === 'cursada' || g.value === null || weight === undefined || !validIds.has(id)) continue
    total += weight
    sum += weight * g.value
  }
  return total === 0 ? null : round2(sum / total)
}

/** La nota de cursada de un alumno a partir de todas sus notas de la comisión. */
export function courseCellOf(
  mine: StoredGrade[],
  weights: Map<string, number>,
  validIds: Set<string>,
  promotion: Promotion = DEFAULT_PROMOTION
): CourseGradeCell {
  const stored = mine.find((g) => g.kind === 'cursada')
  const calculated = weightedAverage(mine, weights, validIds)
  const edited = stored?.edited === true && stored.value !== null
  const value = edited ? (stored?.value ?? null) : calculated
  return {
    calculated,
    value,
    edited,
    published: stored?.publishedAt ? stored.value : null,
    pass: stored?.pass?.status ?? null,
    condition: conditionOf(value, promotion)
  }
}

/** Si a ese alumno falta publicarle la nota de cursada que vale ahora. */
export const needsPublishing = (cell: CourseGradeCell) => cell.value !== null && cell.published !== cell.value

/** Cuántas notas de cursada pasaron al SIU, esperan pasar o el SIU no permite pasar. */
function coursePassCounts(cells: CourseGradeCell[]): PassCounts {
  const count = (status: PassStatus) => cells.filter((c) => c.pass === status).length
  return { passed: count('pasado'), pending: count('pendiente'), refused: count('no-permitido') }
}

export function courseSummary(
  cells: CourseGradeCell[],
  weights: Map<string, number>,
  validIds: Set<string>,
  promotion: Promotion = DEFAULT_PROMOTION
): CourseGradeSummary {
  const weightTotal = [...weights].filter(([id]) => validIds.has(id)).reduce((sum, [, weight]) => sum + weight, 0)
  return {
    weightTotal: round2(weightTotal),
    promotion,
    graded: cells.filter((c) => c.value !== null).length,
    unpublished: cells.filter(needsPublishing).length,
    pass: coursePassCounts(cells)
  }
}

/** El peso de una columna, o `null` si no tiene. */
export const weightOf = (weights: Map<string, number>, kind: ColumnKind, refId: string): number | null =>
  weights.get(columnId(kind, refId)) ?? null
