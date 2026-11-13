/* Cómo se escriben las notas en Notas, sin componentes: la nota con coma y el
   avance de una materia en curso para su fila. Qué nota tiene cada evaluación
   lo dice Cursada. */
import type { SubjectAssessment } from '@/lib/core/studies'

/** «7» o «8,5». */
export function gradeText(grade: number): string {
  return grade.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

export type AssessmentsProgress = {
  /** Cada evaluación con su nota: «7», «Ausente» o «—» si todavía no está. */
  items: { name: string; result: string }[]
  /** «1 de 2 con nota». */
  count: string
}

/** El avance de una materia en curso: cada parcial y TP con su nota, y cuántos la tienen. Un recuperatorio sin
    rendir no cuenta: solo se rinde si hace falta. Sin evaluaciones, `null`. */
export function assessmentsProgress(assessments: SubjectAssessment[]): AssessmentsProgress | null {
  const counted = assessments.filter((a) => a.kind !== 'recuperatorio' || a.graded || a.grade !== null)
  if (!counted.length) return null
  const items = counted.map((a) => ({
    name: a.name,
    result: a.grade !== null ? gradeText(a.grade) : a.graded ? 'Ausente' : '—'
  }))
  const graded = counted.filter((a) => a.grade !== null).length
  return { items, count: `${graded} de ${counted.length} con nota` }
}
