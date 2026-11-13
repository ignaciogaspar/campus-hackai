/* El texto de las inasistencias de una materia, para su fila. Solo arma
   el texto: cuántas quedan y cuándo avisar lo decide Cursada. */
import type { MyAbsences } from '@/lib/core/studies'

/** Un número de faltas como se lee: entero, o con coma si es media falta. */
const amount = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

const plural = (n: number, one: string, many: string) => `${amount(n)} ${n === 1 ? one : many}`

/** «2 de 3 faltas (1 justificada) · te queda 1 antes de quedar libre», o sin máximo, «2 faltas». Al llegar al
    máximo, que una más lo deja libre; si lo pasó, que quedó libre. */
export function absencesLine({ count, justified, max, left }: MyAbsences): string {
  const none = count === 0
  const counted = none
    ? 'Sin faltas'
    : max === null
      ? plural(count, 'falta', 'faltas')
      : `${amount(count)} de ${max} faltas`
  const parts = [justified ? `${counted} (${plural(justified, 'justificada', 'justificadas')})` : counted]
  if (max !== null && count > max) parts.push('superaste el máximo: quedás libre')
  else if (left === 0) parts.push('llegaste al máximo: una falta más y quedás libre')
  else if (left !== null) parts.push(`${left === 1 ? 'te queda 1' : `te quedan ${amount(left)}`} antes de quedar libre`)
  return parts.join(' · ')
}
