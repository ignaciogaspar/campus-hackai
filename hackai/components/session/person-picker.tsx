/* Lista de personas del ingreso de demo, agrupadas por rol y con su facultad.
   Cada persona es un botón que abre su sesión. Solo muestra lo que le da
   Personas.

   En el celular es una columna, con atajos para saltar a cada grupo. En
   pantallas anchas las tarjetas van en grilla y los dos grupos entran juntos,
   así que los atajos se esconden. */
import { signInAsDemoPerson } from '@/app/actions/session'
import { PersonButton } from '@/components/session/person-button'
import type { Person, Role } from '@/lib/core/people'

const GROUPS: { role: Role; title: string }[] = [
  { role: 'alumno', title: 'Alumnos' },
  { role: 'profesor', title: 'Docentes' },
]

/** La facultad y, si es alumno, la propuesta que cursa. */
function detail(person: Person): string {
  const program = person.programs.find((p) => p.status === 'activa')
  return program ? `${person.school.name} · ${program.name}` : person.school.name
}

export function PersonPicker({ people }: { people: Person[] }) {
  if (!people.length) {
    return (
      <p className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
        No hay personas cargadas para la demo.
      </p>
    )
  }

  const groups = GROUPS
    .map((g) => ({ ...g, members: people.filter((p) => p.role === g.role) }))
    .filter((g) => g.members.length)

  return (
    <div className='flex flex-col gap-8'>
      {groups.length > 1 && (
        <nav aria-label='Ir a un grupo' className='flex gap-2 lg:hidden'>
          {groups.map(({ role, title }) => (
            <a
              key={role}
              href={`#grupo-${role}`}
              className='inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              {title}
            </a>
          ))}
        </nav>
      )}

      {groups.map(({ role, title, members }) => (
        <section key={role} aria-labelledby={`grupo-${role}`} className='flex scroll-mt-4 flex-col gap-3'>
          <h2 id={`grupo-${role}`} className='text-sm font-semibold text-muted-foreground'>
            {title} <span className='font-normal'>({members.length})</span>
          </h2>
          <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            {members.map((person) => (
              <li key={person.id} className='flex'>
                <form className='flex w-full' action={signInAsDemoPerson.bind(null, person.id)}>
                  <PersonButton>
                    <span className='text-base leading-snug font-semibold text-foreground'>{person.name}</span>
                    <span className='text-sm font-normal text-muted-foreground'>{detail(person)}</span>
                  </PersonButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
