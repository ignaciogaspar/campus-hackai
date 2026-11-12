/* Inscripciones: a materias (cursada) y a exámenes (finales), en dos pestañas.
   A la izquierda, en cada pestaña, las materias con la inscripción abierta que
   le sirven al alumno, las que cierran antes primero, con los días que faltan
   y los lugares que quedan; y debajo, lo que ya tiene: sus cursadas o sus
   finales. Al elegir una, a la derecha su detalle: cada comisión de su
   carrera (o cada mesa) con modalidad, fechas y horarios, duración, cupo, si
   se promociona, sede, docentes y observaciones, el botón para inscribirse o
   darse de baja y el certificado (de prueba). En el celular, la lista y el
   detalle van uno por vez. En la pestaña de materias, la lista se filtra por
   tipo: materias obligatorias, optativas o actividades de vida universitaria.
   Todo vive en la URL: `?tab=examenes&materia=aga`, `?tipo=optativa`.

   Qué está abierto, qué le sirve, qué comisiones son de su carrera, si a un
   final le falta la regularidad, los días y los lugares los calcula Cursada;
   la página solo los muestra. Si una lectura falla, su parte lo dice y el
   resto se ve igual. */
import { ChevronLeft, ChevronRight, ClipboardList, MousePointerClick } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { shortDate } from '@/components/dates'
import { closingText, creditsText, spotsLeftText } from '@/components/enrollment/format'
import { BoardCard, SectionCard } from '@/components/enrollment/offer-detail'
import { readErrorText } from '@/components/enrollment/read-error'
import { KIND, yearName } from '@/components/grades/status'
import { activeProgram } from '@/components/session/person-text'
import { PageHeader } from '@/components/shell/page-header'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { examDetail } from '@/components/today/upcoming'
import { railItem, railTrack } from '@/components/ui/rail'
import { StaleBanner } from '@/components/ui/stale-banner'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Person } from '@/lib/core/people'
import type {
  Fresh,
  MySection,
  OfferItem,
  OpenEnrollment,
  PlanKind,
  StudiesReadError,
  SubjectStanding,
  UpcomingItem
} from '@/lib/core/studies'
import { staleSince } from '@/lib/fresh'
import type { Result } from '@/lib/result'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

type Tab = 'materias' | 'examenes'

/** El filtro por tipo de la pestaña de materias. */
type Kind = 'todas' | 'obligatoria' | 'optativa' | 'vida-universitaria'

/** `short`: en el celular, para que los cuatro entren en una fila. */
const KINDS: { kind: Kind; label: string; short?: string }[] = [
  { kind: 'todas', label: 'Todas' },
  { kind: 'obligatoria', label: 'Materias' },
  { kind: 'optativa', label: 'Optativas' },
  { kind: 'vida-universitaria', label: 'Vida universitaria', short: 'Vida univ.' }
]

const asKind = (value: string | undefined): Kind =>
  KINDS.find((k) => k.kind === value && value !== 'todas')?.kind ?? 'todas'

type Read<T> = Result<Fresh<T>, StudiesReadError>

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'materias', label: 'Inscripción a materias' },
  { tab: 'examenes', label: 'Inscripción a exámenes' }
]

/** Faltan pocos días para que cierre: se resalta. */
const CLOSING_SOON_DAYS = 3

function href(tab: Tab, subjectId?: string, kind: Kind = 'todas'): string {
  const params = new URLSearchParams()
  if (tab === 'examenes') params.set('tab', tab)
  if (tab === 'materias' && kind !== 'todas') params.set('tipo', kind)
  if (subjectId) params.set('materia', subjectId)
  const query = params.toString()
  return query ? `/inscripciones?${query}` : '/inscripciones'
}

/** Una fila de la lista: la materia y, debajo, lo que importa para elegirla. */
type ListItem = {
  subjectId: string
  subjectName: string
  /** Debajo del nombre: el año del plan, cuándo cierra o en qué comisión o mesa está. */
  detail: string
  /** Cierra en pocos días o no le queda lugar: va resaltado. */
  urgent: boolean
  /** Cómo cuenta en su plan, para el filtro; `null` si no se sabe. */
  kind: PlanKind | null
}

/** El año de la carrera o el tipo de la materia, según su plan. */
function planLabel(standing: SubjectStanding | undefined): string | null {
  if (!standing) return null
  if (standing.kind !== 'obligatoria') return KIND[standing.kind]
  return standing.year ? yearName(standing.year) : null
}

function SubjectRow({ tab, kind, item, active }: { tab: Tab; kind: Kind; item: ListItem; active: boolean }) {
  return (
    <li>
      <Link
        href={href(tab, item.subjectId, kind)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus-ring',
          active ? 'bg-accent' : 'hover:bg-ink/4'
        )}
      >
        <SubjectIcon name={item.subjectName} size='md' tone={active ? 'solid' : 'soft'} />
        <span className='min-w-0 flex-1'>
          <span className='block text-[0.875rem] leading-snug font-semibold text-ink'>{item.subjectName}</span>
          <span
            className={cn(
              'block text-[0.75rem]',
              item.urgent ? 'font-semibold text-warning-foreground' : 'text-muted-foreground'
            )}
          >
            {item.detail}
          </span>
        </span>
        <ChevronRight
          aria-hidden='true'
          className={cn(
            'size-4.5 flex-none transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none',
            active ? 'text-blue' : 'text-gray-light'
          )}
          strokeWidth={2}
        />
      </Link>
    </li>
  )
}

function ListGroup({
  title,
  tab,
  kind,
  items,
  selected
}: {
  title: string
  tab: Tab
  kind: Kind
  items: ListItem[]
  selected: string | undefined
}) {
  return (
    <div className='flex flex-col gap-1'>
      <h2 className='flex items-baseline justify-between px-3 pt-2 pb-1 text-[0.75rem] font-bold tracking-wide text-muted-foreground uppercase'>
        {title}
        <span className='font-semibold tabular-nums'>{items.length}</span>
      </h2>
      <ul className='flex flex-col gap-1'>
        {items.map((item) => (
          <SubjectRow key={item.subjectId} tab={tab} kind={kind} item={item} active={item.subjectId === selected} />
        ))}
      </ul>
    </div>
  )
}

/* Los tipos, en un riel de una fila arriba de la lista (fuera del scroll): con cuántas abiertas hay de cada uno. */
function KindFilter({
  current,
  counts,
  selected
}: {
  current: Kind
  counts: Record<Kind, number>
  selected: string | undefined
}) {
  return (
    <nav
      aria-label='Tipo de materia'
      className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto [scrollbar-width:none]')}
    >
      {KINDS.map(({ kind, label, short }) => (
        <Link
          key={kind}
          href={href('materias', selected, kind)}
          aria-current={kind === current ? 'page' : undefined}
          className={railItem({
            size: 'sm',
            className: 'group/kind flex-auto shrink-0 gap-1 px-2.5 text-[0.75rem] max-sm:px-1.5'
          })}
        >
          {short ? (
            <>
              <span className='sm:hidden'>{short}</span>
              <span className='max-sm:hidden'>{label}</span>
            </>
          ) : (
            label
          )}
          <span className='text-[0.6875rem] text-muted-foreground tabular-nums group-aria-[current=page]/kind:text-blue'>
            {counts[kind]}
          </span>
        </Link>
      ))}
    </nav>
  )
}

const matches = (kind: Kind) => (item: ListItem) => kind === 'todas' || item.kind === kind

/** Cuántas abiertas hay de cada tipo, para el filtro. */
function kindCounts(open: ListItem[]): Record<Kind, number> {
  return Object.fromEntries(KINDS.map((k) => [k.kind, open.filter(matches(k.kind)).length])) as Record<Kind, number>
}

function emptyText(tab: Tab, kind: Kind): string {
  if (tab === 'examenes') return 'Ahora no hay mesas abiertas de materias que tengas regulares o estés cursando.'
  if (kind === 'todas') return 'Ahora no hay inscripciones a cursada que te sirvan. Cuando abra una, aparece acá.'
  return 'No hay inscripciones abiertas de este tipo. Probá con otro filtro.'
}

function SubjectList({
  tab,
  kind,
  open,
  mine,
  mineError,
  selected
}: {
  tab: Tab
  kind: Kind
  open: ListItem[]
  mine: ListItem[]
  mineError: string | null
  selected: string | undefined
}) {
  const shownOpen = open.filter(matches(kind))
  const shownMine = mine.filter(matches(kind))
  return (
    <div className='flex flex-col gap-2'>
      {shownOpen.length === 0 ? (
        <EmptyState icon={ClipboardList} title='No hay inscripciones abiertas'>
          {emptyText(tab, kind)}
        </EmptyState>
      ) : (
        <ListGroup title='Con inscripción abierta' tab={tab} kind={kind} items={shownOpen} selected={selected} />
      )}
      {shownMine.length > 0 && (
        <ListGroup
          title={tab === 'materias' ? 'Tus cursadas' : 'Tus finales'}
          tab={tab}
          kind={kind}
          items={shownMine}
          selected={selected}
        />
      )}
      {mineError && <ErrorNotice>{mineError}</ErrorNotice>}
    </div>
  )
}

/** Cómo cuenta en el plan: lo dice la carrera; si no la conoce, una actividad con créditos es de vida universitaria. */
function kindOf(subjectId: string, standings: SubjectStanding[], activity = false): PlanKind | null {
  const standing = standings.find((s) => s.subjectId === subjectId)
  if (standing && standing.kind !== 'fuera-del-plan') return standing.kind
  return activity ? 'vida-universitaria' : (standing?.kind ?? null)
}

function openItems(openings: OpenEnrollment[], standings: SubjectStanding[]): ListItem[] {
  return openings.map((o) => {
    const spots = spotsLeftText(o.spotsLeft)
    const plan = planLabel(standings.find((s) => s.subjectId === o.subjectId))
    return {
      kind: kindOf(o.subjectId, standings, o.kind === 'actividad'),
      subjectId: o.subjectId,
      subjectName: o.subjectName,
      detail: [
        plan,
        o.credits !== null ? `Actividad · ${creditsText(o.credits)}` : null,
        `${closingText(o.closesInDays)} (${shortDate(o.closesAt)})`,
        spots.full ? spots.text : null
      ]
        .filter(Boolean)
        .join(' · '),
      urgent: spots.full || (o.closesInDays >= 0 && o.closesInDays <= CLOSING_SOON_DAYS)
    }
  })
}

/** Lo que ya tiene en esta pestaña: sus comisiones actuales o los finales a los que está inscripto. */
function mineItems(
  tab: Tab,
  sections: Read<MySection[]>,
  upcoming: Read<UpcomingItem[]>,
  standings: SubjectStanding[]
): ListItem[] {
  if (tab === 'materias') {
    const current = sections.ok ? sections.value.data.filter((s) => s.current && s.role === 'alumno') : []
    return current.map((s) => ({
      kind: kindOf(s.subjectId, standings),
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      detail: `Comisión ${s.name} · ${s.termName}`,
      urgent: false
    }))
  }
  const finals = upcoming.ok ? upcoming.value.data.filter((i) => i.kind === 'final' && !i.past) : []
  return finals.map((f) => ({
    kind: kindOf(f.subjectId, standings),
    subjectId: f.subjectId,
    subjectName: f.subjectName,
    detail: [`Final del ${shortDate(f.date)}`, examDetail(f)].filter(Boolean).join(' · '),
    urgent: false
  }))
}

function Detail({
  tab,
  offer,
  standing,
  person
}: {
  tab: Tab
  offer: Read<OfferItem[]>
  standing: SubjectStanding | undefined
  person: Person | null
}) {
  if (!offer.ok) return <ErrorNotice>{readErrorText(offer.error, 'la oferta de esta materia')}</ErrorNotice>
  // Las comisiones de otras carreras no se muestran: no se puede inscribir a ellas.
  const items = offer.value.data.filter((item) => !item.otherProgram)
  const name = items[0]?.subjectName ?? standing?.name
  if (!name || items.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title={tab === 'materias' ? 'Sin comisiones' : 'Sin mesas'}>
        {tab === 'materias'
          ? 'Esta materia no tiene comisiones abiertas para tu carrera.'
          : 'Esta materia no tiene mesas por delante en tu facultad.'}
      </EmptyState>
    )
  }
  const student = person?.name ?? ''
  const program = (person && activeProgram(person)?.name) ?? ''
  const plan = planLabel(standing)
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-start gap-3.5 rounded-2xl bg-accent/60 p-4'>
        <SubjectIcon name={name} size='lg' />
        <div className='min-w-0'>
          <h2 className='text-xl leading-tight font-semibold text-ink'>{name}</h2>
          <p className='mt-1 text-[0.8125rem] text-ink/70'>
            {[plan, standing?.code, tab === 'materias' ? `Comisiones para ${program}` : 'Mesas de tu facultad']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      <ul className='flex flex-col gap-4'>
        {items.map((item) =>
          item.target.kind === 'comision' ? (
            <SectionCard
              key={item.target.sectionId}
              item={item}
              student={student}
              program={program}
              enrollAction={enrollAction}
              dropAction={dropAction}
            />
          ) : (
            <BoardCard
              key={item.target.examBoardId}
              item={item}
              student={student}
              program={program}
              enrollAction={enrollAction}
              dropAction={dropAction}
            />
          )
        )}
      </ul>
    </div>
  )
}

/* La lista a la izquierda y el detalle a la derecha; en el celular, uno por vez.
   En compu el tablero tiene el alto de la ventana y cada columna scrollea sola,
   así la pantalla no se mueve. Las columnas son `relative`: si no, los textos
   para lector de pantalla (posición absoluta) se escapan del scroll y estiran la página. */
function EnrollmentBoard({
  tab,
  kind,
  open,
  mine,
  mineError,
  selected,
  offer,
  standings,
  person
}: {
  tab: Tab
  kind: Kind
  open: ListItem[]
  mine: ListItem[]
  mineError: string | null
  selected: string | undefined
  offer: Read<OfferItem[]> | null
  standings: SubjectStanding[]
  person: Person | null
}) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)] gap-5 lg:h-[max(30rem,calc(100dvh-17.5rem))] lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] lg:gap-6'>
      <section
        aria-label='Materias'
        className={cn(
          'flex min-h-0 flex-col gap-2 rounded-2xl border border-border bg-card p-2',
          selected && 'max-lg:hidden'
        )}
      >
        {tab === 'materias' && <KindFilter current={kind} counts={kindCounts(open)} selected={selected} />}
        <div className='relative min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]'>
          <SubjectList tab={tab} kind={kind} open={open} mine={mine} mineError={mineError} selected={selected} />
        </div>
      </section>

      <section
        aria-label='Detalle de la materia'
        className={cn(
          'relative min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]',
          !selected && 'max-lg:hidden'
        )}
      >
        {selected && (
          <Link
            href={href(tab, undefined, kind)}
            className='mb-3 inline-flex min-h-10 items-center gap-1 text-[0.875rem] font-semibold text-blue lg:hidden'
          >
            <ChevronLeft aria-hidden='true' className='size-4' strokeWidth={2} />
            Todas las materias
          </Link>
        )}
        {selected && offer ? (
          <Detail tab={tab} offer={offer} standing={standings.find((s) => s.subjectId === selected)} person={person} />
        ) : (
          <EmptyState icon={MousePointerClick} title='Elegí una materia'>
            {tab === 'materias'
              ? 'Tocá una materia de la lista para ver sus comisiones, horarios, cupo y docentes.'
              : 'Tocá una materia de la lista para ver sus mesas, fechas y tribunal.'}
          </EmptyState>
        )}
      </section>
    </div>
  )
}

/** Las dos listas de la pestaña, el plan de cada materia y si falló leer lo que ya tiene. */
function listsFor(
  tab: Tab,
  open: Read<OpenEnrollment[]>,
  career: Read<{ subjects: SubjectStanding[] }>,
  sections: Read<MySection[]>,
  upcoming: Read<UpcomingItem[]>
) {
  // Las actividades con créditos se inscriben como una cursada: van con las materias.
  const kinds: OpenEnrollment['kind'][] = tab === 'examenes' ? ['examen'] : ['cursada', 'actividad']
  const standings = career.ok ? career.value.data.subjects : []
  const openings = open.ok ? open.value.data.filter((o) => kinds.includes(o.kind)) : []
  const mineRead = tab === 'materias' ? sections : upcoming
  return {
    standings,
    open: openItems(openings, standings),
    mine: mineItems(tab, sections, upcoming, standings),
    mineError: mineRead.ok ? null : readErrorText(mineRead.error, tab === 'materias' ? 'tus cursadas' : 'tus finales')
  }
}

export default async function InscripcionesPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; materia?: string; tipo?: string }>
}) {
  const session = await requireSession('alumno')
  const params = await searchParams
  const tab: Tab = params.tab === 'examenes' ? 'examenes' : 'materias'
  const kind = tab === 'materias' ? asKind(params.tipo) : 'todas'
  const selected = params.materia || undefined
  const studies = system().studies
  const [person, open, career, sections, upcoming, offer] = await Promise.all([
    system().people.get(session.personId),
    studies.openEnrollments(session.personId),
    studies.career(session.personId),
    studies.sectionsOf(session.personId),
    studies.upcoming(session.personId),
    selected
      ? studies.offer(session.personId, { kind: tab === 'examenes' ? 'examen' : 'cursada', subjectId: selected })
      : null
  ])
  const lists = listsFor(tab, open, career, sections, upcoming)
  const stale = staleSince([open, career, sections, upcoming, ...(offer ? [offer] : [])])

  return (
    <>
      <PageHeader
        title='Inscripciones'
        subtitle='Elegí la materia y la comisión: quedás inscripto en el SIU y en el aula del Campus Virtual a la vez.'
        art='inscripciones'
      />

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-8 lg:pt-8 lg:pb-6'>
        <nav aria-label='Tipo de inscripción' className={cn(railTrack({ size: 'sm' }), 'mx-auto w-full max-w-xl')}>
          {TABS.map((t) => (
            <Link
              key={t.tab}
              href={href(t.tab)}
              aria-current={t.tab === tab ? 'page' : undefined}
              className={railItem({ size: 'sm' })}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {!open.ok ? (
          <ErrorNotice>{readErrorText(open.error, 'las inscripciones')}</ErrorNotice>
        ) : (
          <>
            {stale && <StaleBanner since={stale} now={system().now()} />}
            <EnrollmentBoard
              tab={tab}
              kind={kind}
              {...lists}
              selected={selected}
              offer={offer}
              person={person.ok ? person.value : null}
            />
          </>
        )}
      </main>
    </>
  )
}
