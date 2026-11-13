/* Tomar lista de una clase, para el docente: los alumnos de la comisión, todos
   presentes, y un toque para marcar a los ausentes. La comisión va en
   `?comision=` y la clase en `?clase=` (su instante ISO). Se llega desde «Alumnos
   y clases» de la materia. Sin reglas de negocio: quién puede tomar lista, que
   sea la clase de hoy y el pase al SIU los decide Cursada.

   En el celular se vuelve con la flecha del encabezado. En compu, donde el
   encabezado no la lleva, arriba de la lista va «Volver a Alumnos y clases» de
   la comisión, y lo mismo junto al mensaje de lista guardada. */
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { longDay, timeOf } from '@/components/dates'
import { PageHeader } from '@/components/shell/page-header'
import { AttendanceForm } from '@/components/subjects/attendance-form'
import { ATTENDANCE_ERRORS } from '@/components/subjects/attendance-format'
import { SubjectIcon, subjectTheme } from '@/components/subjects/subject-icon'
import { ALUMNOS_TAB, chooseSection, subjectTabHref, teachingSections } from '@/components/subjects/subject-nav'
import { StaleBanner } from '@/components/ui/stale-banner'
import { ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { AttendanceError, StudiesReadError } from '@/lib/core/studies'
import { saveAttendanceAction } from './actions'

export const metadata: Metadata = { title: 'Tomar lista · Campus HackAI' }

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const ERRORS: Record<AttendanceError | StudiesReadError, string> = {
  ...ATTENDANCE_ERRORS,
  'falla-externa': 'No pudimos traer la lista porque el SIU no responde. Probá de nuevo en un rato.',
  'sin-acceso': 'Solo los docentes de la comisión toman lista.'
}

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value !== '' ? value : undefined)

function Problem({ message, backHref }: { message: string; backHref: string }) {
  return (
    <>
      <PageHeader title='Tomar lista' backHref={backHref} hideBackOnDesktop art='general' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <ErrorNotice>
          <p>{message}</p>
          <Link href={backHref} className='inline-flex min-h-11 items-center font-bold underline'>
            Volver a Alumnos y clases
          </Link>
        </ErrorNotice>
      </main>
    </>
  )
}

export default async function TomarListaPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession('profesor')
  const [{ subjectId }, raw] = await Promise.all([params, searchParams])
  const classAt = one(raw.clase)

  const mine = await system().studies.sectionsOf(session.personId)
  const taught = mine.ok ? teachingSections(mine.value.data, subjectId) : []
  const section = chooseSection(taught, one(raw.comision))
  const backHref = subjectTabHref(subjectId, ALUMNOS_TAB, section?.sectionId)

  if (!mine.ok || !section)
    return (
      <Problem message={mine.ok ? 'No dictás esta materia en este período.' : ERRORS[mine.error]} backHref={backHref} />
    )
  if (!classAt) return <Problem message='Elegí una clase de la lista.' backHref={backHref} />

  const sheet = await system().studies.attendanceSheet(session.personId, section.sectionId, classAt)
  if (!sheet.ok) return <Problem message={ERRORS[sheet.error]} backHref={backHref} />

  const data = sheet.value
  const staleRead = mine.value.stale ? mine.value : null

  return (
    <>
      <PageHeader
        title='Tomar lista'
        subtitle={`${longDay(data.classAt)} · ${timeOf(data.classAt)} a ${timeOf(data.endAt)}`}
        icon={<SubjectIcon name={section.subjectName} size='lg' tone='glass' className='max-sm:hidden' />}
        art={subjectTheme(section.subjectName).art}
        backHref={backHref}
        hideBackOnDesktop
      >
        <span className='rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset'>
          {`${section.subjectName} · Comisión ${section.name}`}
        </span>
      </PageHeader>

      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-40 lg:px-8 lg:pt-6 lg:pb-16'>
        <Link
          href={backHref}
          className='-ml-1 hidden min-h-11 items-center gap-1 self-start rounded-lg px-1 text-sm font-semibold text-blue underline-offset-2 hover:underline focus-ring lg:inline-flex'
        >
          <ChevronLeft aria-hidden='true' className='size-4' />
          Volver a Alumnos y clases
        </Link>
        {staleRead && <StaleBanner since={staleRead.readAt} now={system().now()} />}
        <AttendanceForm
          action={saveAttendanceAction}
          backHref={backHref}
          sectionId={section.sectionId}
          classAt={data.classAt}
          students={data.students.map((s) => ({ legajo: s.legajo, name: s.name }))}
          initialAbsent={data.absent}
          pass={data.taken?.pass ?? null}
          editable={data.today}
        />
      </main>
    </>
  )
}
