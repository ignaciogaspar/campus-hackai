/* Mis materias: las del período lectivo actual arriba y las archivadas aparte,
   leídas del SIU y de Moodle por Cursada, con el enlace al aula y las tareas
   con fecha. Sirve al alumno y al docente. Si el SIU o Moodle no responden,
   muestra lo último que leyó Cursada con el aviso de desactualizado y su hora.
   Sin reglas de negocio: qué es actual, qué se archiva, qué facultad ve cada
   uno, qué tarea venció y cuándo algo está desactualizado lo decide Cursada. */
import { BookOpen, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { ArchivedSubjects, CurrentSubjects } from '@/components/subjects/subject-list'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
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
  const [person, result] = await Promise.all([
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId)
  ])

  return (
    <>
      <PageHeader title='Mis materias' school={person.ok ? person.value.school.name : undefined}>
        {session.role === 'alumno' && (
          <Link
            href='/inscripciones'
            className='inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-white/90 focus-ring'
          >
            <Plus aria-hidden='true' className='size-4' strokeWidth={2.4} />
            Inscribirme a una materia
          </Link>
        )}
      </PageHeader>

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus materias.'}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} />}

            <section aria-labelledby='actuales' className='flex flex-col gap-3'>
              <h2 id='actuales' className='text-sm font-semibold text-muted-foreground'>
                Actuales
              </h2>
              {result.value.data.current.length ? (
                <CurrentSubjects subjects={result.value.data.current} />
              ) : (
                <EmptyState icon={BookOpen} title='Sin materias en curso'>
                  No tenés materias en curso ni del próximo período.
                </EmptyState>
              )}
            </section>

            <ArchivedSubjects subjects={result.value.data.archived} />
          </>
        )}
      </main>
    </>
  )
}
