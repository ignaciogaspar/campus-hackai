/* El texto de las inasistencias de una materia, para su fila: primero cuántas le
   quedan (lo que el alumno quiere saber, sin restar) y abajo cuántas lleva, del
   máximo, con las justificadas, que también cuentan (pregunta 22). Sin máximo,
   solo cuántas lleva. */
import type { MyAbsences } from '@/lib/core/studies'

/** Un número de faltas como se lee: entero, o con coma si es media falta. */
const amount = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

const plural = (n: number, one: string, many: string) => `${amount(n)} ${n === 1 ? one : many}`

export type AbsencesLine = {
  /** Lo que se lee primero: «Te quedan 2 faltas», «Llegaste al máximo» o, sin máximo, «2 faltas». */
  headline: string
  /** Abajo y más chico: «2 de 3 · incluye 1 justificada». Sin máximo ni justificadas, `null`. */
  detail: string | null
}

function headlineOf({ count, max, left }: MyAbsences): string {
  if (max === null || left === null) return count === 0 ? 'Sin faltas' : plural(count, 'falta', 'faltas')
  if (left > 0) return `${left === 1 ? 'Te queda' : 'Te quedan'} ${plural(left, 'falta', 'faltas')}`
  return count > max ? 'Pasaste el máximo' : 'Llegaste al máximo'
}

/** La fila de faltas de una materia: cuántas le quedan y, abajo, cuántas lleva del máximo. */
export function absencesLine(absences: MyAbsences): AbsencesLine {
  const { count, justified, max } = absences
  const parts = [
    max === null ? null : `${amount(count)} de ${max}`,
    justified ? `incluye ${plural(justified, 'justificada', 'justificadas')}` : null
  ].filter((p) => p !== null)
  return { headline: headlineOf(absences), detail: parts.length ? parts.join(' · ') : null }
}
