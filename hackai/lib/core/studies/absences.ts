/* Inasistencias de una comisión, contadas para el alumno: cuántas tiene, el
   máximo si el SIU lo da y cuántas le quedan, con un aviso cuando se acerca.

   Dos hipótesis, sin confirmar (docs/product/preguntas-abiertas.md, pregunta 22):
   que el SIU de la Austral dé el máximo por comisión, y que las justificadas
   cuenten para el máximo como las otras. Contarlas es lo prudente: si no
   cuentan, el alumno tiene más margen del que ve, no menos. */
import type { SiuAbsences } from '@/lib/ports/siu'

/** A partir de cuántas faltas restantes se avisa que se acerca al máximo. */
const NEAR_LIMIT = 1

/** `cerca`: le queda `NEAR_LIMIT` o menos (con el máximo de 3, una); `limite`: no le queda ninguna. */
export type AbsenceWarning = 'cerca' | 'limite'

export type MyAbsences = {
  count: number
  /** Cuántas de `count` están justificadas. */
  justified: number
  /** Máximo de la comisión, solo si el SIU lo da. */
  max: number | null
  /** Cuántas le quedan antes del máximo; nunca menos de cero. Sin máximo, `null`. */
  left: number | null
  warning: AbsenceWarning | null
}

export function absencesIn(report: SiuAbsences, sectionId: string): MyAbsences {
  const mine = report.absences.filter((a) => a.sectionId === sectionId)
  const max = report.limits.find((l) => l.sectionId === sectionId)?.max ?? null
  const left = max === null ? null : Math.max(0, max - mine.length)
  let warning: AbsenceWarning | null = null
  if (left !== null) warning = left === 0 ? 'limite' : left <= NEAR_LIMIT ? 'cerca' : null
  return { count: mine.length, justified: mine.filter((a) => a.justified).length, max, left, warning }
}
