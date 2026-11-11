/* Mis materias: las del período lectivo actual arriba y las archivadas aparte,
   leídas del SIU y de Moodle por Cursada, con el enlace al aula y las tareas
   con fecha. Sirve al alumno y al docente. Si el SIU o Moodle no responden,
   muestra lo último que leyó Cursada con el aviso de desactualizado y su hora.
   Sin reglas de negocio: qué es actual, qué se archiva, qué facultad ve cada
   uno, qué tarea venció y cuándo algo está desactualizado lo decide Cursada. */
import type { Metadata } from 'next'
import { ArchivedSubjects, CurrentSubjects } from '@/components/subjects/subject-list'
import { StaleBanner } from '@/components/ui/stale-banner'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Mis materias · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus materias del SIU o del Campus Virtual. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

export default async function MateriasPage() {
  const session = await requireSession()
  const result = await system().studies.subjectsOf(session.personId)

  return (
    <main className='mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-6 pb-16'>
      <header>
        <p className='text-xs font-bold tracking-widest text-primary uppercase'>Campus HackAI</p>
        <h1 className='mt-1 text-2xl leading-tight font-bold'>Mis materias</h1>
      </header>

      {!result.ok ? (
        <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
          {ERRORS[result.error] ?? 'Algo salió mal al traer tus materias.'}
        </p>
      ) : (
        <>
          {result.value.stale && <StaleBanner since={result.value.readAt} />}

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
