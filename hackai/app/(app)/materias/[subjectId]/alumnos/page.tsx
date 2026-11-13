/* Alumnos y clases de la materia, para el docente: primero la clase de hoy
   (para tomar lista) o cuándo es la próxima, después el historial de clases,
   los alumnos de la comisión elegida con su legajo y su mail y, al final, el
   enlace de Zoom, que se carga una vez por cuatrimestre. La comisión va en
   `?comision=` (con varias comisiones de la materia, un selector arriba; si
   falta o no es suya, la primera). Es una pestaña más de la materia, junto al
   espacio. Sin reglas de negocio: quién ve a los alumnos de una comisión y
   cuándo es su próxima clase lo decide Cursada.

   En el celular es una columna de filas; en compu, la misma lista con más aire. */
import { Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { pageOf } from '@/components/coursework/format'
import { PageHeader } from '@/components/shell/page-header'
import { ATTENDANCE_ERRORS } from '@/components/subjects/attendance-format'
import { ClassHistory } from '@/components/subjects/class-history'
import { ClassList } from '@/components/subjects/class-list'
import { SubjectIcon, subjectTheme } from '@/components/subjects/subject-icon'
import { ALUMNOS_TAB, chooseSection, subjectTabHref, teachingSections } from '@/components/subjects/subject-nav'
import { SUBJECT_MAIN, SubjectToolbar } from '@/components/subjects/subject-toolbar'
import { ZoomForm } from '@/components/subjects/zoom-form'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import {
  type AttendanceError,
  hasZoom,
  type SectionStudent,
  type SectionStudentsError,
  type Studies,
  type StudiesReadError
} from '@/lib/core/studies'
import { type Back, backFor } from '@/lib/home'
import { saveZoomLinkAction } from './zoom-actions'

export const metadata: Metadata = { title: 'Alumnos · Campus HackAI' }

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const ERRORS: Record<StudiesReadError | SectionStudentsError | AttendanceError, string> = {
  ...ATTENDANCE_ERRORS,
  'falla-externa': 'No pudimos traer los alumnos porque el SIU no responde. Probá de nuevo en un rato.',
  'sin-acceso': 'Solo los docentes de la comisión ven a sus alumnos.'
}

function StudentRow({ student }: { student: SectionStudent }) {
  return (
    <li className='grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,16rem)] sm:items-center'>
      <span className='truncate text-[0.9375rem] font-semibold text-ink'>{student.name}</span>
      <span className='text-[0.8125rem] text-muted-foreground tabular-nums'>Legajo {student.legajo}</span>
      <a
        href={`mailto:${student.email}`}
        className='inline-flex min-h-11 items-center truncate text-[0.8125rem] text-blue underline-offset-2 hover:underline focus-ring sm:justify-self-end'
      >
        {student.email}
      </a>
    </li>
  )
}

function NoSection({ message, back }: { message: string; back: Back }) {
  return (
    <>
      <PageHeader title='Alumnos' back={back} hideBackOnDesktop art='general' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <ErrorNotice>
          <p>{message}</p>
          <Link href='/materias' className='inline-flex min-h-11 items-center font-bold underline'>
            Ir a Mis materias
          </Link>
        </ErrorNotice>
      </main>
    </>
  )
}

type Students = Awaited<ReturnType<Studies['sectionStudents']>>

/** La lista de alumnos de la comisión, o por qué no está. */
function StudentsBlock({
  students,
  sectionName,
  requestedPage,
  pageHref
}: {
  students: Students
  sectionName: string
  requestedPage?: string
  pageHref: (page: number) => string
}) {
  if (!students.ok) return <ErrorNotice>{ERRORS[students.error]}</ErrorNotice>
  const list = students.value.data
  const page = pageOf(list, requestedPage)
  if (list.length === 0) {
    return (
      <EmptyState icon={Users} title='Todavía no hay alumnos inscriptos'>
        Cuando se inscriban a la comisión {sectionName}, los vas a ver acá.
      </EmptyState>
    )
  }
  return (
    <section aria-label={`Alumnos de la comisión ${sectionName}`} className='flex flex-col gap-2'>
      <h2 className='px-1 text-sm font-bold text-muted-foreground'>
        {list.length === 1 ? '1 alumno' : `${list.length} alumnos`}
      </h2>
      <Card>
        <ul className='divide-y divide-border'>
          {page.items.map((s) => (
            <StudentRow key={s.legajo} student={s} />
          ))}
        </ul>
      </Card>
      <Pagination page={page.page} pages={page.pages} hrefFor={pageHref} label='Páginas de alumnos' />
    </section>
  )
}

type History = Awaited<ReturnType<Studies['classHistory']>>

/** El historial de la comisión, o por qué no está. */
function HistoryBlock({
  history,
  subjectId,
  section
}: {
  history: History
  subjectId: string
  section: { sectionId: string; name: string }
}) {
  if (!history.ok) return <ErrorNotice>{ERRORS[history.error]}</ErrorNotice>
  return (
    <ClassHistory
      history={history.value}
      subjectId={subjectId}
      sectionId={section.sectionId}
      sectionName={section.name}
    />
  )
}

type Classes = Awaited<ReturnType<Studies['classesOf']>>

type Next = Awaited<ReturnType<Studies['nextClass']>>

/** La clase de hoy (o cuándo es la próxima) y el historial, o por qué no están. Sin clase hoy ni historial, los dos
    vacíos van en una sola franja. */
function ClassesBlock({
  classes,
  history,
  next,
  subjectId,
  section,
  total
}: {
  classes: Classes
  history: History
  next: Next
  subjectId: string
  section: { sectionId: string; name: string }
  total: number
}) {
  const noHistory = history.ok && history.value.length === 0
  const noClassToday = classes.ok && !classes.value.some((c) => c.today)
  return (
    <>
      {classes.ok ? (
        <ClassList
          classes={classes.value}
          subjectId={subjectId}
          sectionId={section.sectionId}
          sectionName={section.name}
          total={total}
          next={next.ok ? next.value : undefined}
          noHistory={noHistory}
        />
      ) : (
        <ErrorNotice>{ERRORS[classes.error]}</ErrorNotice>
      )}
      {!(noHistory && noClassToday) && <HistoryBlock history={history} subjectId={subjectId} section={section} />}
    </>
  )
}

type Subjects = Awaited<ReturnType<Studies['subjectsOf']>>

/** El enlace de Zoom de la comisión. Es de las comisiones virtuales o híbridas; si no se pudo leer, no se ofrece. */
function ZoomBlock({
  subjects,
  sectionId,
  sectionName
}: {
  subjects: Subjects
  sectionId: string
  sectionName: string
}) {
  const subject = subjects.ok ? subjects.value.data.current.find((c) => c.sectionId === sectionId) : undefined
  if (!subject || !hasZoom(subject.modality)) return null
  return <ZoomForm action={saveZoomLinkAction} sectionId={sectionId} sectionName={sectionName} url={subject.zoomUrl} />
}

export default async function AlumnosPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession('profesor')
  const [{ subjectId }, raw] = await Promise.all([params, searchParams])
  const requested = typeof raw.comision === 'string' && raw.comision !== '' ? raw.comision : undefined

  const mine = await system().studies.sectionsOf(session.personId)
  const taught = mine.ok ? teachingSections(mine.value.data, subjectId) : []
  const section = chooseSection(taught, requested)

  const back = backFor(session.role, raw.desde)
  if (!mine.ok || !section)
    return <NoSection message={mine.ok ? 'No dictás esta materia en este período.' : ERRORS[mine.error]} back={back} />

  const [students, classes, history, subjects, next] = await Promise.all([
    system().studies.sectionStudents(session.personId, section.sectionId),
    system().studies.classesOf(session.personId, section.sectionId),
    system().studies.classHistory(session.personId, section.sectionId),
    system().studies.subjectsOf(session.personId),
    system().studies.nextClass(session.personId, section.sectionId)
  ])

  const staleRead = mine.value.stale ? mine.value : students.ok && students.value.stale ? students.value : null
  const several = taught.length > 1

  return (
    <>
      <PageHeader
        title={section.subjectName}
        subtitle={[section.subjectCode, section.termName].join(' · ')}
        icon={<SubjectIcon name={section.subjectName} size='lg' tone='glass' className='max-sm:hidden' />}
        art={subjectTheme(section.subjectName).art}
        back={back}
        hideBackOnDesktop
        desktopBell={false}
      >
        <span className='rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset'>
          {several ? 'Docente' : `Docente · Comisión ${section.name}`}
        </span>
      </PageHeader>

      <main className={SUBJECT_MAIN}>
        <SubjectToolbar
          subjectId={subjectId}
          current='alumnos'
          viewer='profesor'
          sections={taught}
          selectedId={section.sectionId}
          hrefFor={(sectionId) => subjectTabHref(subjectId, ALUMNOS_TAB, sectionId)}
        />
        {staleRead && <StaleBanner since={staleRead.readAt} now={system().now()} />}

        <ClassesBlock
          classes={classes}
          history={history}
          next={next}
          subjectId={subjectId}
          section={section}
          total={students.ok ? students.value.data.length : 0}
        />
        <StudentsBlock
          students={students}
          sectionName={section.name}
          requestedPage={typeof raw.pagina === 'string' ? raw.pagina : undefined}
          pageHref={(n) => {
            const href = subjectTabHref(subjectId, ALUMNOS_TAB, several ? section.sectionId : undefined)
            return n > 1 ? `${href}${href.includes('?') ? '&' : '?'}pagina=${n}` : href
          }}
        />
        <ZoomBlock subjects={subjects} sectionId={section.sectionId} sectionName={section.name} />
      </main>
    </>
  )
}
