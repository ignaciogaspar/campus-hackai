/* Cómo se nombra a una persona en las pantallas: su propuesta en curso. */
import type { Person } from '@/lib/core/people'

/** La propuesta que la persona cursa hoy, si tiene una. Un docente no tiene. */
export function activeProgram(person: Person): Person['programs'][number] | undefined {
  return person.programs.find((p) => p.status === 'activa')
}
