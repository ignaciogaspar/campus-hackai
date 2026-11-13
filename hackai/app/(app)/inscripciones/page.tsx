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
import { ClipboardList } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { dropAction, enrollAction } from '@/app/(app)/inscripciones/actions'
import { shortDate } from '@/components/dates'
import { EnrollmentLists } from '@/components/enrollment/enrollment-lists'
import { closingText, creditsText, spotsLeftText } from '@/components/enrollment/format'
import type { ListItem, Tab } from '@/components/enrollment/list-filters'
import { BoardCard, SectionCard } from '@/components/enrollment/offer-detail'
import { readErrorText } from '@/components/enrollment/read-error'
import { KIND, yearName } from '@/components/grades/status'
import { activeProgram } from '@/components/session/person-text'
import { PageHeader } from '@/components/shell/page-header'
import { SkeletonRows } from '@/components/shell/screen-skeleton'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { examDetail } from '@/components/today/upcoming'
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

export const metadata: Metadata = { title: 'Inscripciones · Campus HackAI' }

type Read<T> = Result<Fresh<T>, StudiesReadError>
const CLOSING_SOON_DAYS = 3

/** El año de la carrera o el tipo de la materia, según su plan. */
function planLabel(standing: SubjectStanding | undefined): string | null {
  if (!standing) return null
  if (standing.kind !== 'obligatoria') return KIND[standing.kind]
  return standing.year ? yearName(standing.year) : null
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
        o.closesAt === null || o.closesInDays === null
          ? 'Sin fecha de cierre informada por el SIU'
          : `${closingText(o.closesInDays)} (${shortDate(o.closesAt)})`,
        spots.full ? spots.text : null
      ]
        .filter(Boolean)
        .join(' · '),
      urgent: spots.full || (o.closesInDays !== null && o.closesInDays >= 0 && o.closesInDays <= CLOSING_SOON_DAYS)
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
  const content = <EnrollmentContent personId={session.personId} params={params} />
  return (
    <>
      <PageHeader
        desktopBell={false}
        title='Inscripciones'
        subtitle='Elegí la materia y la comisión: quedás inscripto en el SIU y en el aula del Campus Virtual a la vez.'
        art='inscripciones'
      />

      <main className='mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-5 pb-16 lg:px-8 lg:pt-8 lg:pb-6'>
        {params.materia ? (
          content
        ) : (
          <Suspense fallback={<SkeletonRows label='Cargando inscripciones…' />}>{content}</Suspense>
        )}
      </main>
    </>
  )
}

async function EnrollmentContent({
  personId,
  params
}: {
  personId: string
  params: { tab?: string; materia?: string }
}) {
  const tab: Tab = params.tab === 'examenes' ? 'examenes' : 'materias'
  const selected = params.materia || undefined
  const studies = system().studies
  const [person, open, career, sections, upcoming, offer] = await Promise.all([
    system().people.get(personId),
    studies.openEnrollments(personId),
    studies.career(personId),
    studies.sectionsOf(personId),
    studies.upcoming(personId),
    selected ? studies.offer(personId, { kind: tab === 'examenes' ? 'examen' : 'cursada', subjectId: selected }) : null
  ])
  const materias = listsFor('materias', open, career, sections, upcoming)
  const examenes = listsFor('examenes', open, career, sections, upcoming)
  const stale = staleSince([open, career, sections, upcoming, ...(offer ? [offer] : [])])
  return (
    <>
      {stale && open.ok && <StaleBanner since={stale} now={system().now()} />}
      <EnrollmentLists
        lists={{ materias, examenes }}
        detailTab={tab}
        detailSubject={selected}
        error={open.ok ? null : readErrorText(open.error, 'las inscripciones')}
        detail={
          selected && offer ? (
            <Detail
              tab={tab}
              offer={offer}
              standing={materias.standings.find((item) => item.subjectId === selected)}
              person={person.ok ? person.value : null}
            />
          ) : null
        }
      />
    </>
  )
}
