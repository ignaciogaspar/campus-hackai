/* Notas, por materia: las que el alumno cursó o está cursando, cada una con su
   estado (promocionada, aprobada, en curso, regular) y, al tocarla, sus
   parciales, la nota de cursada y la del final. Se filtran por año lectivo,
   tipo de materia, año de la carrera y estado, y se agrupan por año lectivo o
   por año de la carrera. El promedio va en el encabezado. Reemplaza a
   Académico: las constancias pasaron a Trámites y reportes, y el avance, al
   Plan de estudios. Sin reglas de negocio: el estado y las notas los decide
   Cursada. */
import { BookOpenCheck, ChartPie } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { filtersFrom, groupingFrom } from '@/components/grades/filters'
import { GradesBoard } from '@/components/grades/grades-board'
import { gradeText } from '@/components/grades/status'
import { PageHeader } from '@/components/shell/page-header'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { StudiesReadError } from '@/lib/core/studies'

export const metadata: Metadata = { title: 'Notas · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus notas del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus notas en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

export default async function NotasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession('alumno')
  const [result, params] = await Promise.all([system().studies.career(session.personId), searchParams])
  const career = result.ok ? result.value.data : null
  const taken = career?.subjects.filter((s) => s.status !== 'pendiente') ?? []

  return (
    <>
      <PageHeader title='Notas' subtitle={career?.program?.name} art='academico'>
        {career && career.average !== null && (
          <Link
            href='/estado'
            className='inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/12 px-3.5 text-[0.8125rem] font-semibold text-white ring-1 ring-white/20 transition-colors ring-inset hover:bg-white/20 focus-ring'
          >
            <ChartPie aria-hidden='true' className='size-4' strokeWidth={2} />
            Promedio {gradeText(career.average)} · ver el plan de estudios
          </Link>
        )}
      </PageHeader>

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus notas.'}</ErrorNotice>
        ) : (
          <>
            {result.value.stale && <StaleBanner since={result.value.readAt} now={system().now()} />}
            {taken.length === 0 ? (
              <EmptyState icon={BookOpenCheck} title='Todavía no cursaste materias'>
                Cuando te inscribas a una materia, aparece acá con sus parciales y sus notas.
              </EmptyState>
            ) : (
              <GradesBoard
                subjects={taken}
                careerYears={career?.program?.years ?? Math.max(1, ...taken.map((s) => s.year ?? 1))}
                initialFilters={filtersFrom(params)}
                initialGrouping={groupingFrom(params)}
                initialOpen={typeof params.materia === 'string' ? params.materia : undefined}
              />
            )}
          </>
        )}
      </main>
    </>
  )
}
