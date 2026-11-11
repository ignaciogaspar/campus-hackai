'use client'

/* Lista de personas del ingreso de demo, agrupadas por rol y, adentro, por
   facultad. Cada persona es una fila que abre su sesión. Solo muestra lo que
   le da Personas.

   En el celular se ve un rol por vez, y se cambia con las pastillas de arriba.
   En pantallas anchas entran los dos: alumnos a la izquierda, en dos columnas,
   y docentes a la derecha. */
import { useState } from 'react'
import { signInAsDemoPerson } from '@/app/actions/session'
import { PersonRow } from '@/components/session/person-row'
import { activeProgram } from '@/components/session/person-text'
import type { Person, Role } from '@/lib/core/people'
import { cn } from '@/lib/utils'

const GROUPS: { role: Role; title: string; wide: boolean }[] = [
  { role: 'alumno', title: 'Alumnos', wide: true },
  { role: 'profesor', title: 'Docentes', wide: false },
]

type School = Person['school'] & { members: Person[] }

/** Las personas de un rol, por facultad, en el orden en que aparecen. */
function bySchool(people: Person[]): School[] {
  const schools = new Map<string, School>()
  for (const person of people) {
    const school = schools.get(person.school.id) ?? { ...person.school, members: [] }
    school.members.push(person)
    schools.set(person.school.id, school)
  }
  return [...schools.values()]
}

export function PersonPicker({ people }: { people: Person[] }) {
  const groups = GROUPS
    .map((g) => ({ ...g, schools: bySchool(people.filter((p) => p.role === g.role)), count: people.filter((p) => p.role === g.role).length }))
    .filter((g) => g.count)
  const [shown, setShown] = useState<Role | undefined>(groups[0]?.role)

  return (
    <div className='flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-6'>
      {groups.length > 1 && (
        <div role='group' aria-label='Qué personas ver' className='flex gap-2 lg:hidden'>
          {groups.map(({ role, title, count }) => (
            <button
              key={role}
              type='button'
              aria-pressed={shown === role}
              onClick={() => setShown(role)}
              className='inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-card px-4 text-[0.8125rem] font-semibold text-muted-foreground shadow-[0_1px_2px_rgba(11,17,80,.08)] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-azul-claro focus-visible:ring-offset-2 aria-pressed:bg-azul aria-pressed:text-white'
            >
              {title}
              <span className={cn('text-[11px] font-bold', shown === role ? 'text-header-sub' : 'text-gris-claro')}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {groups.map(({ role, title, wide, schools, count }) => (
        <section
          key={role}
          aria-labelledby={`grupo-${role}`}
          className={cn('flex-col gap-4 lg:flex', shown === role ? 'flex' : 'hidden', wide ? 'lg:col-span-2' : 'lg:col-span-1')}
        >
          <h2 id={`grupo-${role}`} className='sr-only text-lg leading-tight font-extrabold lg:not-sr-only'>
            {title} <span className='text-[0.8125rem] font-semibold text-muted-foreground'>{count}</span>
          </h2>
          <div className={cn('grid gap-5', wide && 'sm:grid-cols-2 sm:gap-x-6')}>
            {schools.map((school) => (
              <div key={school.id} className='flex flex-col gap-2'>
                <h3 className='px-1 text-xs font-bold tracking-[.08em] text-muted-foreground uppercase lg:flex lg:min-h-8 lg:items-end'>{school.name}</h3>
                <ul className='divide-y divide-border overflow-hidden rounded-card bg-card shadow-card'>
                  {school.members.map((person) => (
                    <li key={person.id}>
                      <form action={signInAsDemoPerson.bind(null, person.id)}>
                        <PersonRow person={person} detail={activeProgram(person)?.name} />
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
