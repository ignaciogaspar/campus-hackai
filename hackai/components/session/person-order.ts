/* Orden de la lista del ingreso de demo. */
import type { Person } from '@/lib/core/people'

/** Las personas del guion de la demo (hackai/README.md, «Datos y fecha de la
    demo»): Tomás Aguirre, el alumno, y Mariana Ledesma, la docente. Van
    primeras para no tener que buscarlas en vivo. */
export const DEMO_SCRIPT_PEOPLE = ['p-taguirre', 'p-mledesma']

const scriptRank = (p: Person) => {
  const rank = DEMO_SCRIPT_PEOPLE.indexOf(p.id)
  return rank === -1 ? DEMO_SCRIPT_PEOPLE.length : rank
}

const surname = (p: Person) => p.name.split(' ').at(-1) ?? p.name

/** Las del guion primero; después alumnos antes que docentes y, adentro, por apellido. */
export function byScriptRoleAndSurname(a: Person, b: Person): number {
  const byScript = scriptRank(a) - scriptRank(b)
  if (byScript) return byScript
  if (a.role !== b.role) return a.role === 'alumno' ? -1 : 1
  return surname(a).localeCompare(surname(b), 'es') || a.name.localeCompare(b.name, 'es')
}
