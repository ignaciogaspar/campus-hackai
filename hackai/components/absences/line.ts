/* El texto de las inasistencias de una materia, para su fila: cuántas lleva y,
   si hay máximo, de cuántas. Lo de quedar libre va como sugerencia abajo de la
   lista, no en cada materia. */
import type { MyAbsences } from '@/lib/core/studies'

/** Un número de faltas como se lee: entero, o con coma si es media falta. */
const amount = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

const plural = (n: number, one: string, many: string) => `${amount(n)} ${n === 1 ? one : many}`

/** «2 de 3 faltas (1 justificada)», o sin máximo, «2 faltas». Sin ninguna, «Sin faltas». */
export function absencesLine({ count, justified, max }: MyAbsences): string {
  const counted =
    count === 0 ? 'Sin faltas' : max === null ? plural(count, 'falta', 'faltas') : `${amount(count)} de ${max} faltas`
  return justified ? `${counted} (${plural(justified, 'justificada', 'justificadas')})` : counted
}
