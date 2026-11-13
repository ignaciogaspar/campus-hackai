/* Lo que comparten el SIU en memoria y el simulado al cargar notas: qué nota
   sirve y con qué resultado queda la cursada. */
import type { SiuHistoryResult } from '@/lib/ports/siu'

/** Una nota del SIU va de 1 a 10. */
export const validGrade = (grade: number) => Number.isFinite(grade) && grade >= 1 && grade <= 10

/** Con qué resultado queda la cursada: regular desde 4. Es un supuesto, no una regla de la Austral
    (docs/product/preguntas-abiertas.md). */
export const courseResult = (grade: number, promoted = false): SiuHistoryResult => {
  if (promoted) return 'promocionado'
  return grade >= 4 ? 'regular' : 'desaprobado'
}
