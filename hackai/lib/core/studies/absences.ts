/* Inasistencias de una comisión, contadas para el alumno: cuántas tiene, el
   máximo si el SIU lo da y cuántas le quedan, con un aviso cuando se acerca.

   Dos hipótesis, sin confirmar (docs/product/preguntas-abiertas.md, pregunta 22):
   que el SIU de la Austral dé el máximo por comisión, y que las justificadas
   cuenten para el máximo como las otras. Contarlas es lo prudente: si no
   cuentan, el alumno tiene más margen del que ve, no menos. */
/** A partir de cuántas faltas restantes se avisa que se acerca al máximo. */
const NEAR_LIMIT = 1

/** `cerca`: tiene alguna falta y le queda `NEAR_LIMIT` o menos (con el máximo de 3, una); `limite`: no le queda ninguna. */
export type AbsenceWarning = 'cerca' | 'limite'

export type MyAbsences = {
  /** Faltas, sumando lo que vale cada una: puede tener decimales (media falta). */
  count: number
  /** Cuántas de `count` están justificadas. */
  justified: number
  /** Máximo de la comisión: el que da el SIU o, si no, el que sale de la asistencia requerida y sus clases. */
  max: number | null
  /** Cuántas le quedan antes del máximo; nunca menos de cero. Sin máximo, `null`. */
  left: number | null
  /** Las clases de la comisión con las que se calculó el máximo, si salió de la asistencia requerida. */
  classes: number | null
  warning: AbsenceWarning | null
}

/** De dónde sale una falta. Hoy solo del SIU; la toma de lista (#108) suma `hackai`. */
export type AbsenceSource = 'siu' | 'hackai'

/** Una falta, venga de donde venga. */
export type AbsenceRecord = {
  /** Id de la falta en su fuente: dos faltas pueden tener el mismo instante (una clase doble). */
  id: string
  sectionId: string
  /** Instante ISO de la clase. */
  date: string
  justified: boolean
  /** Cuántas faltas vale (el SIU puede cargar media o doble). */
  amount: number
  source: AbsenceSource
}

/** El máximo de faltas de una comisión con tantas clases, si se pide esa asistencia: lo que se puede faltar sin
    bajar del mínimo, redondeado hacia abajo (16 clases con 75% de asistencia: 4 faltas). */
export function maxAbsences(classes: number, attendanceRequired: number): number {
  return Math.floor(classes * (1 - attendanceRequired) + 1e-9)
}

/** Cuenta las faltas de una comisión contra su máximo (`null` si no se sabe). `classes`: las clases con las que se
    calculó el máximo, si salió de la asistencia requerida. */
export function absencesFrom(records: AbsenceRecord[], max: number | null, classes: number | null = null): MyAbsences {
  const count = Math.round(records.reduce((sum, a) => sum + a.amount, 0) * 100) / 100
  const left = max === null ? null : Math.max(0, Math.round((max - count) * 100) / 100)
  let warning: AbsenceWarning | null = null
  // «Se acerca» pide alguna falta: con máximo 1 y ninguna, no hay aviso.
  if (left !== null) warning = left === 0 ? 'limite' : left <= NEAR_LIMIT && count > 0 ? 'cerca' : null
  return { count, justified: records.filter((a) => a.justified).length, max, left, classes, warning }
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
