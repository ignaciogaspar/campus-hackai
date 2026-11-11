/* Cómo se nombra a una persona en las pantallas: su propuesta en curso, su
   nombre de pila y sus iniciales. */
import type { Person } from '@/lib/core/people'

/** La propuesta que la persona cursa hoy, si tiene una. Un docente no tiene. */
export function activeProgram(person: Person): Person['programs'][number] | undefined {
  return person.programs.find((p) => p.status === 'activa')
}

/** El nombre con el que se la saluda: la primera palabra de su nombre. */
export function firstName(person: Person): string {
  return person.name.trim().split(/\s+/)[0] ?? person.name
}

/** Dos letras para el avatar: la del nombre y la del apellido. */
export function initials(person: Person): string {
  const words = person.name.trim().split(/\s+/)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
}
