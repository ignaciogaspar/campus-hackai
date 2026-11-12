'use client'

/* Lista de personas del ingreso de demo. Todas en una sola lista, que se
   filtra en vez de venir partida por rol y por facultad, así sigue siendo
   cómoda con muchas personas de distintas carreras:
   - un riel con Todos, Alumnos y Docentes;
   - un buscador por nombre, carrera o facultad;
   - la facultad y, para los alumnos, la carrera.
   Los filtros quedan pegados arriba al bajar. Cada persona es una fila que
   abre su sesión. Solo muestra lo que le da Personas; filtrar es de la
   pantalla. */
import { Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { signInAsDemoPerson } from '@/app/actions/session'
import { PersonRow } from '@/components/session/person-row'
import { activeProgram } from '@/components/session/person-text'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import type { Person, Role } from '@/lib/core/people'

type RoleFilter = Role | 'todos'

const ROLES: { value: RoleFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'alumno', label: 'Alumnos' },
  { value: 'profesor', label: 'Docentes' }
]

const ALL = ''

const FIELD =
  'min-h-11 w-full min-w-0 rounded-[14px] border border-border bg-card px-3 text-[0.9375rem] text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Para buscar sin que importen mayúsculas ni tildes. */
function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** «Facultad de Ingeniería» → «Ingeniería», para la línea de cada persona. */
function shortSchool(name: string): string {
  return name.replace(/^Facultad de /, '')
}

function detailOf(person: Person): string {
  const school = shortSchool(person.school.name)
  if (person.role === 'profesor') return `Docente · ${school}`
  const program = activeProgram(person)
  return program ? `${program.name} · ${school}` : school
}

/** Alumnos primero y, adentro, por apellido. */
function byRoleAndSurname(a: Person, b: Person): number {
  if (a.role !== b.role) return a.role === 'alumno' ? -1 : 1
  const surname = (p: Person) => p.name.split(' ').at(-1) ?? p.name
  return surname(a).localeCompare(surname(b), 'es') || a.name.localeCompare(b.name, 'es')
}

function options(values: { id: string; name: string }[]): { id: string; name: string }[] {
  const unique = new Map(values.map((v) => [v.id, v]))
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

type Filters = { role: RoleFilter; query: string; school: string; program: string }

function matches(person: Person, { role, query, school, program }: Filters): boolean {
  if (role !== 'todos' && person.role !== role) return false
  if (school && person.school.id !== school) return false
  if (program && activeProgram(person)?.id !== program) return false
  if (!query) return true
  return plain(`${person.name} ${detailOf(person)} ${person.school.name}`).includes(plain(query))
}

/** `returnTo`: la ruta a la que vuelve al entrar, si se llegó al ingreso
    queriendo abrir algo sin sesión; si no, cada persona va a su inicio. */
export function PersonPicker({ people, returnTo }: { people: Person[]; returnTo?: string | null }) {
  const sorted = useMemo(() => [...people].sort(byRoleAndSurname), [people])
  const [filters, setFilters] = useState<Filters>({ role: 'todos', query: '', school: ALL, program: ALL })
  const set = (change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change }))

  const schools = options(people.map((p) => p.school))
  const programs = options(
    people.flatMap((p) => {
      const program = activeProgram(p)
      return p.role === 'alumno' && program && (!filters.school || p.school.id === filters.school) ? [program] : []
    })
  )
  const shown = sorted.filter((p) => matches(p, filters))
  const count = (role: RoleFilter) => people.filter((p) => role === 'todos' || p.role === role).length
  const filtered = filters.query || filters.school || filters.program || filters.role !== 'todos'

  return (
    <div className='flex flex-col gap-3'>
      <div className='sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-background/95 px-4 py-2 backdrop-blur-sm lg:-mx-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_14rem_16rem] lg:items-center lg:gap-3 lg:px-6'>
        <fieldset aria-label='Qué personas ver' className={railTrack({ size: 'sm', className: 'lg:w-80' })}>
          {ROLES.map(({ value, label }) => (
            <button
              key={value}
              type='button'
              aria-pressed={filters.role === value}
              onClick={() => set({ role: value, program: value === 'profesor' ? ALL : filters.program })}
              className={railItem({ size: 'sm' })}
            >
              {label}
              <span className='text-[0.6875rem] font-bold opacity-70'>{count(value)}</span>
            </button>
          ))}
        </fieldset>

        <label className='relative block'>
          <span className='sr-only'>Buscar por nombre, carrera o facultad</span>
          <Search
            aria-hidden='true'
            className='pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground'
            strokeWidth={1.8}
          />
          <input
            type='search'
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder='Buscá por nombre, carrera o facultad'
            className={`${FIELD} pl-10`}
          />
        </label>

        <div className='grid grid-cols-2 gap-2 lg:contents'>
          <label className='block min-w-0'>
            <span className='sr-only'>Facultad</span>
            <select
              value={filters.school}
              onChange={(e) => set({ school: e.target.value, program: ALL })}
              className={FIELD}
            >
              <option value={ALL}>Facultad</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortSchool(s.name)}
                </option>
              ))}
            </select>
          </label>
          <label className='block min-w-0'>
            <span className='sr-only'>Carrera</span>
            <select
              value={filters.program}
              onChange={(e) => set({ program: e.target.value })}
              disabled={filters.role === 'profesor' || !programs.length}
              className={`${FIELD} disabled:opacity-50`}
            >
              <option value={ALL}>Carrera</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p role='status' className='px-1 text-[0.8125rem] text-muted-foreground'>
        {shown.length === people.length ? `${people.length} personas` : `${shown.length} de ${people.length} personas`}
      </p>

      {shown.length ? (
        <Card>
          <ul className='-mb-px grid sm:grid-cols-2 xl:grid-cols-3'>
            {shown.map((person) => (
              <li
                key={person.id}
                className='border-b border-border sm:odd:border-r xl:border-r xl:[&:nth-child(3n)]:border-r-0'
              >
                <form action={signInAsDemoPerson.bind(null, person.id)}>
                  {returnTo && <input type='hidden' name='next' value={returnTo} />}
                  <PersonRow person={person} detail={detailOf(person)} />
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={SearchX} title='Nadie coincide con esos filtros'>
          Probá con otro nombre o sacá algún filtro.
        </EmptyState>
      )}
      {filtered && !shown.length && (
        <Button
          variant='outline'
          className='self-center'
          onClick={() => setFilters({ role: 'todos', query: '', school: ALL, program: ALL })}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
