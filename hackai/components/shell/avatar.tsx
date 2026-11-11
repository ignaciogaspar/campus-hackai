/* Avatar con las iniciales de una persona. El del docente va lleno, en azul;
   el del alumno, en azul suave. */
import { initials } from '@/components/session/person-text'
import type { Person } from '@/lib/core/people'
import { cn } from '@/lib/utils'

export function Avatar({ person, className }: { person: Person; className?: string }) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'grid size-10 flex-none place-items-center rounded-full text-[0.8125rem] font-bold',
        person.role === 'profesor' ? 'bg-blue text-white' : 'bg-accent text-blue',
        className
      )}
    >
      {initials(person)}
    </span>
  )
}
