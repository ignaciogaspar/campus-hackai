/* Hoy: la pantalla de inicio de quien entra, alumno o docente. Por ahora
   saluda, dice desde qué facultad entra y lleva a Mis materias; lo demás
   (parciales, novedades, inscripciones abiertas) llega con el ticket de Hoy
   (#18). Sin reglas de negocio: quién es la persona lo dice Personas. */
import type { Metadata } from 'next'
import Link from 'next/link'
import { SignOutButton } from '@/components/session/sign-out-button'
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
  const program = person.programs.find((p) => p.status === 'activa')
  return program ? `Cursás ${program.name} en la ${person.school.name}` : `Cursás en la ${person.school.name}`
}

export default async function HoyPage() {
  const session = await requireSession()
  const person = await system().people.get(session.personId)

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16'>
      <header className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-xs font-bold tracking-widest text-primary uppercase'>Campus HackAI</p>
          <h1 className='mt-1 text-2xl leading-tight font-bold'>{person.ok ? `Hola, ${person.value.name}` : 'Hoy'}</h1>
          {person.ok && <p className='mt-1 text-sm text-muted-foreground'>{belonging(person.value)}</p>}
        </div>
        <SignOutButton />
      </header>

      {!person.ok ? (
        <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
          {ERRORS[person.error]}
        </p>
      ) : (
        <>
          <Link
            href='/materias'
            className='rounded-xl border border-border bg-card p-4 shadow-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            <span className='block text-base leading-snug font-semibold'>Mis materias</span>
            <span className='mt-1 block text-sm text-muted-foreground'>
              {person.value.role === 'profesor'
                ? 'Las comisiones que dictás este cuatrimestre y las anteriores, archivadas.'
                : 'Las de este cuatrimestre arriba y las anteriores, archivadas.'}
            </span>
          </Link>

          <p className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
            Acá vas a ver tus próximos parciales y finales, las novedades de tus materias y las inscripciones abiertas.
            Todavía lo estamos armando.
          </p>
        </>
      )}
    </main>
  )
}
