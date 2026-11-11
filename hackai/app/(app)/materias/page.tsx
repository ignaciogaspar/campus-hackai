/* Mis materias: las del período lectivo actual arriba y las archivadas aparte,
   leídas del SIU y de Moodle por Cursada, con el enlace al aula y las tareas
   con fecha. Sirve al alumno y al docente. Sin reglas de negocio: qué es
   actual, qué se archiva, qué facultad ve cada uno y qué tarea venció lo
   decide Cursada. */
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArchivedSubjects, CurrentSubjects } from '@/components/subjects/subject-list'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Mis materias · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus materias del SIU o del Campus Virtual. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

function readTime(readAt: string): string {
  return new Date(readAt).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default async function MateriasPage() {
  const session = await requireSession()
  const result = await system().studies.subjectsOf(session.personId)

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16'>
      <header>
        <p className='text-xs font-bold tracking-widest text-primary uppercase'>Campus HackAI</p>
        <h1 className='mt-1 text-2xl leading-tight font-bold'>Mis materias</h1>
        {session.role === 'alumno' && (
          <Link
            href='/inscripciones'
            className='mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline'
          >
            Inscribirme a una materia
          </Link>
        )}
      </header>

      {!result.ok ? (
        <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
          {ERRORS[result.error] ?? 'Algo salió mal al traer tus materias.'}
        </p>
      ) : (
        <>
          {result.value.stale && (
            <p role='status' className='rounded-lg border border-warning bg-warning-background p-3 text-sm'>
              El SIU o el Campus Virtual no responden. Te mostramos lo que trajimos el {readTime(result.value.readAt)}:
              puede estar desactualizado.
            </p>
          )}

          <section aria-labelledby='actuales' className='flex flex-col gap-3'>
            <h2 id='actuales' className='text-sm font-semibold text-muted-foreground'>
              Actuales
            </h2>
            <CurrentSubjects subjects={result.value.data.current} />
          </section>

          <ArchivedSubjects subjects={result.value.data.archived} />
        </>
      )}
    </main>
  )
}
