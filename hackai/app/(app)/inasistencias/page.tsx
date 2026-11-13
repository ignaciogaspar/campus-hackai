/* Inasistencias, por materia: solo las que el alumno cursa y en las que tiene
   faltas, cada una con cuántas le quedan («Te queda 1 falta») y cuántas lleva
   del máximo, con la regla de asistencia plegada abajo, y al tocarla, cada falta
   con su fecha y si está justificada. Sin reglas de negocio: la cuenta, el
   máximo y el aviso los decide Cursada. */
import { CalendarCheck, ChevronDown } from 'lucide-react'
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

/** La regla de las faltas, plegada: se abre si el alumno quiere saber de dónde sale el máximo. */
function HowItCounts({ withClasses }: { withClasses: boolean }) {
  return (
    <details className='group rounded-[14px] bg-card px-4 text-[0.8125rem] shadow-card'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 font-bold text-blue focus-ring [&::-webkit-details-marker]:hidden'>
        <span className='min-w-0 flex-1'>¿Cómo se cuenta?</span>
        <ChevronDown
          aria-hidden='true'
          className='size-4 flex-none text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none'
        />
      </summary>
      <p className='pb-3 text-pretty text-muted-foreground'>
        La facultad pide el 75% de asistencia, así que el máximo de cada materia es el 25% de sus clases. Cuentan todas
        las faltas, también las justificadas y las de las listas que toma tu docente en HackAI. Pasarlo puede dejarte
        libre.
        {withClasses && ' Las clases salen del calendario de cada comisión en el SIU, sin descontar feriados.'}
      </p>
    </details>
  )
}

export default async function InasistenciasPage() {
  const session = await requireSession('alumno')
  const result = await system().studies.absencesOf(session.personId)

  return (
    <>
      <PageHeader title='Inasistencias' subtitle='Tus faltas por materia' art='academico' desktopBell={false} />
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus inasistencias.'}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} now={system().now()} />}
            {result.value.data.subjects.length === 0 ? (
              <EmptyState icon={CalendarCheck} title='No tenés faltas'>
                Todavía no tenés faltas en tus materias.
              </EmptyState>
            ) : (
              <>
                <AbsencesList subjects={result.value.data.subjects} />
                <p className='px-1 text-[0.8125rem] font-semibold text-ink/80'>
                  Las justificadas también cuentan para el máximo.
                </p>
                <HowItCounts withClasses={result.value.data.subjects.some((s) => s.classes !== null)} />
              </>
            )}
          </>
        )}
      </main>
    </>
  )
}
