/* Mis materias: una grilla de tarjetas, de a seis por página, con las materias
   que cursa. Las que tienen el final pendiente y las archivadas no se ven
   hasta que se eligen arriba (`?ver=final-pendiente` o `?ver=archivadas`):
   así la pantalla muestra primero lo de este cuatrimestre. Sirve al alumno y
   al docente; el docente no tiene finales pendientes.

   Sin reglas de negocio: qué es actual, qué se archiva, qué está regular y qué
   aprobado lo deciden Cursada (`subjectsOf` y `career`). Si el SIU o Moodle no
   responden, muestra lo último leído con el aviso de desactualizado. */
import { Archive, BookOpen, Hourglass, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageHeader } from '@/components/shell/page-header'
import { ArchivedCard, CourseCard, PendingFinalCard, SubjectGrid } from '@/components/subjects/subject-grid'
import { Pagination } from '@/components/ui/pagination'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { MySubjects, StudiesReadError, SubjectStanding } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mis materias · Campus HackAI' }

const ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus materias del SIU o del Campus Virtual. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

const PAGE_SIZE = 6

type View = 'en-curso' | 'final-pendiente' | 'archivadas'

const VIEWS: { view: View; label: string; students: boolean }[] = [
  { view: 'en-curso', label: 'En curso', students: false },
  { view: 'final-pendiente', label: 'Final pendiente', students: true },
  { view: 'archivadas', label: 'Archivadas', students: false }
]

const EMPTY: Record<View, { icon: typeof BookOpen; title: string; text: string }> = {
  'en-curso': {
    icon: BookOpen,
    title: 'Sin materias en curso',
    text: 'No tenés materias en curso ni del próximo período. Inscribite a una desde Inscripciones.'
  },
  'final-pendiente': {
    icon: Hourglass,
    title: 'No tenés finales pendientes',
    text: 'Cuando regularices una cursada y te falte el final, aparece acá con el acceso a la mesa.'
  },
  archivadas: {
    icon: Archive,
    title: 'Sin materias archivadas',
    text: 'Las materias de cuatrimestres que ya terminaron se guardan acá.'
  }
}

function href(view: View, page = 1): string {
  const params = new URLSearchParams()
  if (view !== 'en-curso') params.set('ver', view)
  if (page > 1) params.set('pagina', String(page))
  const query = params.toString()
  return query ? `/materias?${query}` : '/materias'
}

/* Las vistas: «En curso» siempre; las otras, con cuántas hay, para elegirlas. */
function ViewTabs({ current, counts, student }: { current: View; counts: Record<View, number>; student: boolean }) {
  return (
    <nav aria-label='Qué materias ver' className='flex flex-wrap gap-2'>
      {VIEWS.filter((v) => student || !v.students).map(({ view, label }) => (
        <Link
          key={view}
          href={href(view)}
          aria-current={view === current ? 'page' : undefined}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors focus-ring',
            view === current
              ? 'border-blue bg-blue text-white'
              : 'border-border bg-card text-ink hover:border-blue/30 hover:bg-accent'
          )}
        >
          {label}
          <span
            className={cn(
              'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.6875rem] tabular-nums',
              view === current ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            )}
          >
            {counts[view]}
          </span>
        </Link>
      ))}
    </nav>
  )
}

/** Lo que va en cada vista, ya como tarjetas, para paginar. */
function cardsFor(view: View, subjects: MySubjects, standings: SubjectStanding[]): ReactNode[] {
  const standingOf = (id: string) => standings.find((s) => s.subjectId === id)
  if (view === 'final-pendiente')
    return standings
      .filter((s) => s.status === 'regular')
      .map((s) => <PendingFinalCard key={s.subjectId} standing={s} />)
  if (view === 'archivadas')
    return subjects.archived.map((s) => (
      <ArchivedCard key={s.sectionId} subject={s} standing={standingOf(s.subjectId)} />
    ))
  return subjects.current.map((s) => <CourseCard key={s.sectionId} subject={s} standing={standingOf(s.subjectId)} />)
}

const asView = (value: string | undefined): View =>
  value === 'final-pendiente' || value === 'archivadas' ? value : 'en-curso'

export default async function MateriasPage({
  searchParams
}: {
  searchParams: Promise<{ ver?: string; pagina?: string }>
}) {
  const session = await requireSession()
  const student = session.role === 'alumno'
  const [params, person, result, career] = await Promise.all([
    searchParams,
    system().people.get(session.personId),
    system().studies.subjectsOf(session.personId),
    student ? system().studies.career(session.personId) : null
  ])
  const view = student ? asView(params.ver) : asView(params.ver === 'archivadas' ? params.ver : undefined)
  const standings = career?.ok ? career.value.data.subjects : []

  return (
    <>
      <PageHeader title='Mis materias' school={person.ok ? person.value.school.name : undefined} art='materias'>
        {student && (
          <Link
            href='/inscripciones'
            className='inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-white/90 focus-ring'
          >
            <Plus aria-hidden='true' className='size-4' strokeWidth={2.4} />
            Inscribirme a una materia
          </Link>
        )}
      </PageHeader>

      <main className='flex w-full flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!result.ok ? (
          <ErrorNotice>{ERRORS[result.error] ?? 'Algo salió mal al traer tus materias.'}</ErrorNotice>
        ) : (
          <SubjectsView
            view={view}
            page={Number(params.pagina) || 1}
            subjects={result.value.data}
            standings={standings}
            student={student}
            stale={result.value.stale ? result.value.readAt : null}
          />
        )}
      </main>
    </>
  )
}

function SubjectsView({
  view,
  page,
  subjects,
  standings,
  student,
  stale
}: {
  view: View
  page: number
  subjects: MySubjects
  standings: SubjectStanding[]
  student: boolean
  stale: string | null
}) {
  const counts: Record<View, number> = {
    'en-curso': subjects.current.length,
    'final-pendiente': standings.filter((s) => s.status === 'regular').length,
    archivadas: subjects.archived.length
  }
  const cards = cardsFor(view, subjects, standings)
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const current = Math.min(Math.max(page, 1), pages)
  const empty = EMPTY[view]

  return (
    <>
      {stale && <StaleBanner since={stale} />}
      <ViewTabs current={view} counts={counts} student={student} />
      {cards.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title}>
          {empty.text}
        </EmptyState>
      ) : (
        <SubjectGrid>{cards.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)}</SubjectGrid>
      )}
      <Pagination page={current} pages={pages} hrefFor={(n) => href(view, n)} label='Páginas de materias' />
    </>
  )
}
