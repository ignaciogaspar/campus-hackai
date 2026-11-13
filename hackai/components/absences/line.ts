/* El texto de las inasistencias de una materia, para su fila. Solo arma
   el texto: cuántas quedan y cuándo avisar lo decide Cursada. */
import type { MyAbsences } from '@/lib/core/studies'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** «3 de 8 faltas (1 justificada) · te quedan 5», o sin máximo, «2 faltas». */
export function absencesLine({ count, justified, max, left }: MyAbsences): string {
  const counted = max === null ? plural(count, 'falta', 'faltas') : `${count} de ${max} faltas`
  const parts = [justified ? `${counted} (${plural(justified, 'justificada', 'justificadas')})` : counted]
  if (left === 0) parts.push('llegaste al máximo')
  else if (left !== null) parts.push(left === 1 ? 'te queda 1' : `te quedan ${left}`)
  return max === null && count === 0 ? 'Sin faltas' : parts.join(' · ')
}
