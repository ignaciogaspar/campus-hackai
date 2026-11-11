/* Hoy: la pantalla de inicio de quien entra, alumno o docente. Por ahora
   saluda, dice desde qué facultad entra y lleva a Mis materias; lo demás
   (parciales, novedades, inscripciones abiertas) llega con el ticket de Hoy
   (#18). Sin reglas de negocio: quién es la persona lo dice Personas.

   En el celular es una columna. En pantallas anchas, los accesos van a la
   izquierda y lo del día a la derecha. */
import { CalendarDays, ChevronRight, LibraryBig } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyNotice, ErrorNotice } from '@/components/notices'
import { activeProgram, firstName } from '@/components/session/person-text'
import { SignOutButton } from '@/components/session/sign-out-button'
import { Avatar } from '@/components/shell/avatar'
import { PageHeader } from '@/components/shell/page-header'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PeopleError, Person } from '@/lib/core/people'

export const metadata: Metadata = { title: 'Hoy · Campus HackAI' }

const ERRORS: Record<PeopleError, string> = {
  'falla-externa': 'No pudimos traer tus datos porque el SIU no responde. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.',
}

/** Desde dónde entra: qué cursa el alumno o dónde dicta el docente. */
function belonging(person: Person): string {
  if (person.role === 'profesor') return `Dictás en la ${person.school.name}`
  const program = activeProgram(person)
  return program ? `Cursás ${program.name}` : `Cursás en la ${person.school.name}`
}

export default async function HoyPage() {
  const session = await requireSession()
  const found = await system().people.get(session.personId)
  const person = found.ok ? found.value : null

  return (
    <>
      <PageHeader
        title={person ? `Hola, ${firstName(person)}` : 'Hoy'}
        sub={person ? belonging(person) : undefined}
        brandSub={person?.school.name ?? 'HackAI'}
        actions={
          <>
            <SignOutButton />
            {person && <Avatar person={person} className='ring-2 ring-white/25' />}
          </>
        }
      />

      <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-5 pb-16 lg:px-10 lg:pt-8'>
        {!found.ok ? (
          <ErrorNotice>{ERRORS[found.error]}</ErrorNotice>
        ) : (
          <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:items-start'>
            <nav aria-label='Tus accesos' className='overflow-hidden rounded-card bg-card shadow-card'>
              <Link
                href='/materias'
                className='group flex items-center gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 outline-none hover:bg-azul/[0.04] focus-visible:bg-azul-suave focus-visible:inset-ring-2 focus-visible:inset-ring-azul-claro'
              >
                <span className='grid size-10 flex-none place-items-center rounded-full bg-azul-suave text-azul-claro'>
                  <LibraryBig aria-hidden='true' className='size-5' strokeWidth={1.8} />
                </span>
                <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                  <span className='leading-snug font-semibold text-foreground'>Mis materias</span>
                  <span className='text-[0.8125rem] leading-snug text-muted-foreground'>
                    {found.value.role === 'profesor'
                      ? 'Las comisiones que dictás y las anteriores, archivadas'
                      : 'Las de este cuatrimestre y las anteriores, archivadas'}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden='true'
                  className='size-5 flex-none text-gris-claro transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-azul motion-reduce:transition-none'
                  strokeWidth={1.8}
                />
              </Link>
            </nav>

            <EmptyNotice icon={CalendarDays} title='Acá va a estar tu día'>
              Tus próximos parciales y finales, las novedades de tus materias y las inscripciones abiertas. Todavía lo
              estamos armando.
            </EmptyNotice>
          </div>
        )}
      </main>
    </>
  )
}
