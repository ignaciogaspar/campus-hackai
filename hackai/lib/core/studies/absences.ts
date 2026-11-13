/* Inasistencias de una comisión, contadas para el alumno: cuántas tiene, el
   máximo si el SIU lo da y cuántas le quedan, con un aviso cuando se acerca.

   Dos hipótesis, sin confirmar (docs/product/preguntas-abiertas.md, pregunta 22):
   que el SIU de la Austral dé el máximo por comisión, y que las justificadas
   cuenten para el máximo como las otras. Contarlas es lo prudente: si no
   cuentan, el alumno tiene más margen del que ve, no menos. */
import { dayKey } from '@/lib/dates'
import type { SiuAbsences } from '@/lib/ports/siu'

/** A partir de cuántas faltas restantes se avisa que se acerca al máximo. */
const NEAR_LIMIT = 1

/** `cerca`: tiene alguna falta y le queda `NEAR_LIMIT` o menos (con el máximo de 3, una); `limite`: no le queda ninguna. */
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

/** Una falta, venga de donde venga: del SIU o de una clase que tomó HackAI. */
export type AbsenceRecord = {
  sectionId: string
  /** Instante ISO de la clase. */
  date: string
  justified: boolean
  source: 'siu' | 'hackai'
}

/** Junta las faltas del SIU y las de HackAI. Una clase que tomó HackAI manda: si
    HackAI tiene faltas de una comisión en un día, las del SIU de ese día y esa
    comisión no se cuentan (son la misma clase, pasada o cargada a mano). Quedan
    por fecha. A3 completa la regla con las clases tomadas sin ausentes. */
export function mergeAbsences(siu: AbsenceRecord[], hackai: AbsenceRecord[]): AbsenceRecord[] {
  const taken = new Set(hackai.map((a) => `${a.sectionId}|${dayKey(a.date)}`))
  const kept = siu.filter((a) => !taken.has(`${a.sectionId}|${dayKey(a.date)}`))
  return [...kept, ...hackai].sort((a, b) => a.date.localeCompare(b.date))
}

/** Cuenta las faltas de una comisión contra su máximo (`null` si el SIU no lo da). */
export function absencesFrom(records: AbsenceRecord[], max: number | null): MyAbsences {
  const left = max === null ? null : Math.max(0, max - records.length)
  let warning: AbsenceWarning | null = null
  // «Se acerca» pide alguna falta: con máximo 1 y ninguna, no hay aviso.
  if (left !== null) warning = left === 0 ? 'limite' : left <= NEAR_LIMIT && records.length > 0 ? 'cerca' : null
  return { count: records.length, justified: records.filter((a) => a.justified).length, max, left, warning }
}

export function absencesIn(report: SiuAbsences, sectionId: string): MyAbsences {
  const max = report.limits.find((l) => l.sectionId === sectionId)?.max ?? null
  return absencesFrom(
    report.absences.filter((a) => a.sectionId === sectionId).map((a) => ({ ...a, source: 'siu' as const })),
    max
  )
}

/** El detalle de una materia actual del alumno: la cuenta y cada falta. */
export type SubjectAbsences = MyAbsences & {
  subjectId: string
  subjectCode: string
  subjectName: string
  sectionId: string
  sectionName: string
  absences: AbsenceRecord[]
}

/** Las inasistencias del alumno, una entrada por materia actual. */
export type MyAbsencesDetail = { subjects: SubjectAbsences[] }
