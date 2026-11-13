/* Inasistencias, por materia: solo las que el alumno cursa y en las que tiene
   faltas, cada una con el máximo si lo hay y cuántas le quedan antes de quedar
   libre, y al tocarla, cada falta con su fecha y si está justificada. Sin
   reglas de negocio: la cuenta, el máximo y el aviso los decide Cursada. */
import { CalendarCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { AbsencesList } from '@/components/absences/absences-list'
import { PageHeader } from '@/components/shell/page-header'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Inasistencias · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus inasistencias del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus inasistencias en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

export default async function InasistenciasPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.absencesOf(session.personId)

  return (
    <>
      <PageHeader title='Inasistencias' subtitle='Tus faltas por materia' art='academico' />
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus inasistencias.'}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} now={system().now()} />}
            {result.value.data.subjects.length === 0 ? (
              <EmptyState icon={CalendarCheck} title='No tenés faltas'>
                En tus materias de este período no hay inasistencias cargadas en el SIU.
              </EmptyState>
            ) : (
              <>
                <AbsencesList subjects={result.value.data.subjects} />
                {result.value.data.subjects.some((s) => s.classes !== null) && (
                  <p className='px-1 text-[0.8125rem] text-pretty text-muted-foreground'>
                    La facultad pide el 75% de asistencia: quedás libre si faltás a más del 25% de las clases. Las
                    clases salen del calendario de cada comisión en el SIU, sin descontar feriados.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
