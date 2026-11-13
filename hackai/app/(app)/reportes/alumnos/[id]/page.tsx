/* Reportes › ficha de un alumno, solo secretaría: lo que el SIU reparte en la
   ficha del alumno, el reporte de plan de estudios y el de créditos, junto y
   vinculado, al cierre del año del reporte (`?anio=`). Lo que le falta va
   resaltado y cruzado con el Planning de Aulas. Se puede marcar en seguimiento,
   exportar a CSV e imprimir. Sin reglas de negocio: la arma Reportes. */
import { Download } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FollowUpForm } from '@/components/reports/follow-up-form'
import { cutoffText } from '@/components/reports/format'
import { REPORTS_ERROR } from '@/components/reports/frame'
import { studentIdFrom } from '@/components/reports/params'
import { PrintButton } from '@/components/reports/print-button'
import {
  DataBlock,
  EnrollmentsBlock,
  FileIndex,
  HistoryBlock,
  MissingBlock,
  NoFile,
  PlanBlock,
  SanctionsBlock,
  Summary,
  UniversityLifeBlock
} from '@/components/reports/student-file'
import { PageHeader } from '@/components/shell/page-header'
import { Card } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { dayText } from '@/lib/reports-labels'

export const metadata: Metadata = { title: 'Ficha del alumno · Reportes · Campus HackAI' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** A dónde vuelve «Volver»: la lista de donde vino, si es de Reportes; si no, el listado. */
function backOf(value: string | undefined) {
  const safe = value && /^\/reportes(\/(alumnos|seguimiento))?(\?[^\s]*)?$/.test(value) ? value : '/reportes/alumnos'
  const short = safe.startsWith('/reportes/seguimiento')
    ? 'En seguimiento'
    : safe.startsWith('/reportes/alumnos')
      ? 'Alumnos'
      : 'Reportes'
  return { href: safe, label: `Volver a ${short}`, short }
}

export default async function StudentFilePage({ params, searchParams }: Props) {
  const session = await requireSession('secretaria')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const year = Number(first(query.anio)) || undefined
  const back = backOf(first(query.volver))
  const studentId = studentIdFrom(id)
  if (studentId === null) notFound()
  const report = await system().reports.student(session.personId, studentId, year)

  if (!report.ok) {
    return (
      <>
        <PageHeader title='Ficha del alumno' back={back} art='academico' />
        <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
          {report.error === 'alumno-desconocido' ? (
            <NoFile />
          ) : (
            <ErrorNotice>{REPORTS_ERROR[report.error]}</ErrorNotice>
          )}
        </main>
      </>
    )
  }

  const r = report.value
  const { profile } = r
  const exportHref = `/reportes/alumnos/${encodeURIComponent(profile.id)}/exportar?anio=${r.year}`
  return (
    <>
      <PageHeader
        title={profile.name}
        kicker='Ficha del alumno'
        subtitle={`${profile.program.name} · ${profile.school.short} · Legajo ${profile.id}`}
        back={back}
        art='academico'
      />
      <main data-print-root className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <div className='hidden print:block'>
          <p className='text-xl font-extrabold'>{profile.name}</p>
          <p className='text-sm'>
            {profile.program.name} · Legajo {profile.id} · Ficha {cutoffText(r.year, r.cutoff)}
          </p>
        </div>
        <div data-print='hide' className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-[0.8125rem] text-muted-foreground'>
            Ficha {cutoffText(r.year, r.cutoff)}, con lo que pasó hasta el {dayText(r.cutoff)}.
          </p>
          <div className='flex flex-wrap gap-2'>
            <a
              href={exportHref}
              className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[0.875rem] font-semibold text-ink hover:bg-ice focus-ring'
            >
              <Download aria-hidden='true' className='size-4' />
              Exportar CSV
            </a>
            <PrintButton />
          </div>
        </div>
        <Summary report={r} />
        <FileIndex />
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'>
          <div className='flex min-w-0 flex-col gap-4'>
            <MissingBlock report={r} />
            <PlanBlock report={r} />
            <HistoryBlock report={r} />
            <EnrollmentsBlock report={r} />
          </div>
          <div className='flex min-w-0 flex-col gap-4'>
            <Card data-print='hide' className='flex flex-col gap-3 p-4 sm:p-5'>
              <h2 className='text-[1.0625rem] font-extrabold'>Seguimiento</h2>
              <FollowUpForm
                key={r.followUp?.at ?? 'nuevo'}
                studentId={profile.id}
                note={r.followUp ? r.followUp.note : null}
                since={r.followUp ? dayText(r.followUp.at.slice(0, 10)) : null}
              />
            </Card>
            <UniversityLifeBlock report={r} />
            <DataBlock report={r} />
            <SanctionsBlock report={r} />
          </div>
        </div>
      </main>
    </>
  )
}
