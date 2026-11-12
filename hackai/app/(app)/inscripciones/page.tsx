/* Inscripciones: a materias (cursada) y a exámenes (finales), en dos pestañas.
   A la izquierda, las materias con la inscripción abierta que le sirven al
   alumno; al elegir una, a la derecha su detalle: cada comisión de su carrera
   (o cada mesa) con modalidad, fechas y horarios, duración, cupo, si se
   promociona, sede, docentes y observaciones, el botón para inscribirse y el
   certificado (de prueba). En el celular, la lista y el detalle van uno por
   vez. Todo vive en la URL: `?tab=examenes&materia=aga`.

   Qué está abierto, qué le sirve, qué comisiones son de su carrera y si ya
   está inscripto lo decide Cursada; la página solo lo muestra. */
import { ChevronLeft, ChevronRight, ClipboardList, MousePointerClick } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { shortDate } from '@/components/dates'
import { BoardCard, SectionCard } from '@/components/enrollment/offer-detail'
import { readErrorText } from '@/components/enrollment/read-error'
import { KIND, yearName } from '@/components/grades/status'
import { activeProgram } from '@/components/session/person-text'
import { PageHeader } from '@/components/shell/page-header'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { Person } from '@/lib/core/people'
import type { OfferItem, OpenEnrollment, StudiesReadError, SubjectStanding } from '@/lib/core/studies'
import type { Result } from '@/lib/result'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

type Tab = 'materias' | 'examenes'

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'materias', label: 'Inscripción a materias' },
  { tab: 'examenes', label: 'Inscripción a exámenes' }
]

function href(tab: Tab, subjectId?: string): string {
  const params = new URLSearchParams()
  if (tab === 'examenes') params.set('tab', tab)
  if (subjectId) params.set('materia', subjectId)
  const query = params.toString()
  return query ? `/inscripciones?${query}` : '/inscripciones'
}

/** Una materia de la lista: la de la inscripción abierta o, si ya se inscribió, la elegida. */
type ListItem = { subjectId: string; subjectName: string; closesAt: string | null; enrolled: boolean }

/** El año de la carrera o el tipo de la materia, según su plan. */
function planLabel(standing: SubjectStanding | undefined): string | null {
  if (!standing) return null
  if (standing.kind !== 'obligatoria') return KIND[standing.kind]
  return standing.year ? yearName(standing.year) : null
}

function SubjectList({
  tab,
  items,
  selected,
  standings
}: {
  tab: Tab
  items: ListItem[]
  selected: string | undefined
  standings: SubjectStanding[]
}) {
  if (items.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title='No hay inscripciones abiertas'>
        {tab === 'materias'
          ? 'Ahora no hay inscripciones a cursada que te sirvan. Cuando abra una, aparece acá.'
          : 'Ahora no hay mesas abiertas de materias que tengas regulares o estés cursando.'}
      </EmptyState>
    )
  }
  return (
    <ul className='flex flex-col gap-1'>
      {items.map((item) => {
        const active = item.subjectId === selected
        const plan = planLabel(standings.find((s) => s.subjectId === item.subjectId))
        return (
          <li key={item.subjectId}>
            <Link
              href={href(tab, item.subjectId)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus-ring',
                active ? 'bg-accent' : 'hover:bg-ink/4'
              )}
            >
              <SubjectIcon name={item.subjectName} size='md' tone={active ? 'solid' : 'soft'} />
              <span className='min-w-0 flex-1'>
                <span className='block text-[0.875rem] leading-snug font-semibold text-ink'>{item.subjectName}</span>
                <span className='block text-[0.75rem] text-muted-foreground'>
                  {[
                    plan,
                    item.enrolled ? 'Ya estás inscripto' : item.closesAt && `Cierra el ${shortDate(item.closesAt)}`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
      })}
    </ul>
  )
}

function Detail({
  tab,
  offer,
  opening,
  standing,
  person
}: {
  tab: Tab
  offer: Result<OfferItem[], StudiesReadError>
  opening: OpenEnrollment | undefined
  standing: SubjectStanding | undefined
  person: Person | null
}) {
  if (!offer.ok) return <ErrorNotice>{readErrorText(offer.error, 'la oferta de esta materia')}</ErrorNotice>
  const items = offer.value
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
  const needsRegularity = opening?.needsRegularity ?? standing?.status === 'en-curso'
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
              needsRegularity={needsRegularity}
              enrollAction={enrollAction}
              dropAction={dropAction}
            />
          )
        )}
      </ul>
    </div>
  )
}

function listItems(
  openings: OpenEnrollment[],
  selected: string | undefined,
  offer: Result<OfferItem[], StudiesReadError> | null
): ListItem[] {
  const items: ListItem[] = openings.map((o) => ({
    subjectId: o.subjectId,
    subjectName: o.subjectName,
    closesAt: o.closesAt,
    enrolled: false
  }))
  // Recién inscripto, la materia deja de estar entre las abiertas: sigue en la
  // lista, marcada, para que no se pierda lo que se eligió.
  const chosen = offer?.ok ? offer.value[0] : undefined
  if (selected && chosen && !items.some((i) => i.subjectId === selected)) {
    const enrolled = offer?.ok === true && offer.value.some((i) => i.alreadyEnrolled)
    items.unshift({ subjectId: selected, subjectName: chosen.subjectName, closesAt: chosen.enrollmentEnd, enrolled })
  }
  return items
}

/* La lista a la izquierda y el detalle a la derecha; en el celular, uno por vez. */
function EnrollmentBoard({
  tab,
  items,
  selected,
  offer,
  openings,
  standings,
  person
}: {
  tab: Tab
  items: ListItem[]
  selected: string | undefined
  offer: Result<OfferItem[], StudiesReadError> | null
  openings: OpenEnrollment[]
  standings: SubjectStanding[]
  person: Person | null
}) {
  return (
    <div className='grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start'>
      <section
        aria-label='Materias con inscripción abierta'
        className={cn('rounded-2xl border border-border bg-card p-2 lg:sticky lg:top-6', selected && 'max-lg:hidden')}
      >
        <SubjectList tab={tab} items={items} selected={selected} standings={standings} />
      </section>

      <section aria-label='Detalle de la materia' className={cn(!selected && 'max-lg:hidden')}>
        {selected && (
          <Link
            href={href(tab)}
            className='mb-3 inline-flex min-h-10 items-center gap-1 text-[0.875rem] font-semibold text-blue lg:hidden'
          >
            <ChevronLeft aria-hidden='true' className='size-4' strokeWidth={2} />
            Todas las materias
          </Link>
        )}
        {selected && offer ? (
          <Detail
            tab={tab}
            offer={offer}
            opening={openings.find((o) => o.subjectId === selected)}
            standing={standings.find((s) => s.subjectId === selected)}
            person={person}
          />
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

export default async function InscripcionesPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; materia?: string }>
}) {
  const session = await requireSession('alumno')
  const params = await searchParams
  const tab: Tab = params.tab === 'examenes' ? 'examenes' : 'materias'
  const selected = params.materia || undefined
  const studies = system().studies
  const [person, open, career, offer] = await Promise.all([
    system().people.get(session.personId),
    studies.openEnrollments(session.personId),
    studies.career(session.personId),
    selected
      ? studies.offer(session.personId, { kind: tab === 'examenes' ? 'examen' : 'cursada', subjectId: selected })
      : null
  ])
  const kind = tab === 'examenes' ? 'examen' : 'cursada'
  const openings = open.ok ? open.value.data.filter((o) => o.kind === kind) : []
  const standings = career.ok ? career.value.data.subjects : []
  const items = listItems(openings, selected, offer)

  return (
    <>
      <PageHeader
        title='Inscripciones'
        subtitle='Elegí la materia y la comisión: quedás inscripto en el SIU y en el aula del Campus Virtual a la vez.'
        art='inscripciones'
      />

      <main className='flex w-full flex-col gap-5 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <nav aria-label='Tipo de inscripción' className={cn(railTrack({ size: 'sm' }), 'w-full max-w-xl')}>
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
            {open.value.stale && (
              <StaleNotice>
                El SIU no responde. Te mostramos lo último que trajimos: puede estar desactualizado.
              </StaleNotice>
            )}
            <EnrollmentBoard
              tab={tab}
              items={items}
              selected={selected}
              offer={offer}
              openings={openings}
              standings={standings}
              person={person.ok ? person.value : null}
            />
          </>
        )}
      </main>
    </>
  )
}
