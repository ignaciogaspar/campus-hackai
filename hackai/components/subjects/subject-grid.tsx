/* Las tarjetas de Mis materias, en grilla: una por materia. Las tres vistas
   que arma la página (las que cursa, las que tienen el final pendiente y las
   archivadas) usan la misma tarjeta, del mismo tamaño y con las mismas
   partes: cabecera con ícono, nombre y estado; dos datos; un aviso opcional;
   y abajo, una acción secundaria. Toda la tarjeta lleva al espacio de la
   materia (el título es el enlace y se estira sobre la tarjeta); la acción
   secundaria queda por encima y lleva a otro lado. Solo muestra lo que le da
   Cursada: qué es actual, qué está regular y qué está aprobado lo decide
   Cursada. */
import {
  ArrowUpRight,
  CalendarClock,
  CalendarX,
  ChevronRight,
  ExternalLink,
  type LucideIcon,
  MapPin,
  NotebookPen,
  TriangleAlert,
  Trophy
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { dueTime, longDay, shortDate, timeOf } from '@/components/dates'
import { modalityName, scheduleLine } from '@/components/enrollment/format'
import { offerHref } from '@/components/enrollment/offer-href'
import { gradeText, StatusChip } from '@/components/grades/status'
import { spaceHref } from '@/components/spaces/format'
import { absencesLine } from '@/components/subjects/absences'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import type {
  AbsenceWarning,
  MyAbsences,
  MySubject,
  PendingFinal,
  SubjectStanding,
  SubjectStatus
} from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function Row({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className='flex items-start gap-2 text-[0.8125rem] text-ink/80 lg:text-[0.875rem]'>
      <Icon aria-hidden='true' className='mt-0.5 size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
      <span className='min-w-0 line-clamp-2'>{children}</span>
    </p>
  )
}

/** Lo que no leyó en el espacio de la materia. En compu también está en la barra lateral. */
function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className='inline-flex flex-none items-center gap-1.5 rounded-md bg-blue px-2 py-0.5 text-[0.75rem] font-semibold text-white motion-safe:animate-in motion-safe:zoom-in-50'>
      {count} sin leer
    </span>
  )
}

/* Un aviso dentro de la tarjeta: la próxima entrega, la próxima mesa. Neutro: el color queda para el estado. */
function Callout({ children }: { children: ReactNode }) {
  return <div className='flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2 text-[0.8125rem] text-ink'>{children}</div>
}

/** Cómo se ve cada aviso de faltas: el fondo, el ícono y lo que lee un lector de pantalla. */
const ABSENCE_WARNING: Record<AbsenceWarning, { box: string; icon: string; label: string }> = {
  cerca: { box: 'bg-warning-background text-warning-foreground', icon: 'text-warning-icon', label: 'Cuidado: ' },
  limite: { box: 'bg-error-background text-error-foreground', icon: 'text-destructive', label: 'Aviso: ' }
}

/** Las faltas de la materia. Cerca del máximo o en el máximo, resaltadas como aviso. */
function AbsencesRow({ absences }: { absences: MyAbsences }) {
  const line = absencesLine(absences)
  if (!absences.warning) return <Row icon={CalendarX}>{line}</Row>
  const look = ABSENCE_WARNING[absences.warning]
  return (
    <p className={cn('flex w-fit items-start gap-2 rounded-xl px-2.5 py-1.5 text-[0.8125rem] font-semibold', look.box)}>
      <TriangleAlert aria-hidden='true' className={cn('mt-0.5 size-4 flex-none', look.icon)} strokeWidth={2} />
      <span className='min-w-0'>
        <span className='sr-only'>{look.label}</span>
        {line}
      </span>
    </p>
  )
}

const SECONDARY =
  'relative z-10 -mr-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold whitespace-nowrap text-blue transition-colors hover:bg-accent focus-ring'

/* La tarjeta: siempre las mismas partes y el mismo alto (la grilla iguala las
   filas). El título es el enlace al espacio y cubre toda la tarjeta. */
function SubjectCard({
  subjectId,
  name,
  detail,
  status,
  badge,
  rows,
  callout,
  secondary
}: {
  subjectId: string
  name: string
  detail: string
  status: SubjectStatus | null
  badge?: ReactNode
  rows: ReactNode
  callout?: ReactNode
  secondary?: ReactNode
}) {
  return (
    <li className='group relative flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-blue/30 hover:shadow-card has-[a.stretched:focus-visible]:ring-3 has-[a.stretched:focus-visible]:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:p-5'>
      <div className='flex items-start gap-3'>
        <SubjectIcon name={name} size='lg' tone='soft' />
        <div className='min-w-0 flex-1'>
          <h3 className='line-clamp-2 text-[0.9375rem] leading-snug font-bold text-ink lg:text-base'>
            <Link
              href={spaceHref(subjectId)}
              className='stretched text-ink outline-none transition-colors group-hover:text-blue after:absolute after:inset-0 after:rounded-2xl after:content-[""]'
            >
              {name}
            </Link>
          </h3>
          <p className='mt-0.5 truncate text-[0.75rem] text-muted-foreground'>{detail}</p>
        </div>
        {badge}
      </div>
      {status && <StatusChip status={status} className='-mt-1' />}
      <div className='flex flex-col gap-1.5'>{rows}</div>
      {callout}
      <div className='mt-auto flex items-center justify-between gap-2 border-t border-border pt-3'>
        <span className='inline-flex items-center gap-1 text-[0.8125rem] font-bold whitespace-nowrap text-ink transition-colors group-hover:text-blue'>
          Abrir el espacio
          <ChevronRight
            aria-hidden='true'
            className='size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none'
          />
        </span>
        {secondary}
      </div>
    </li>
  )
}

const detailOf = (subject: MySubject) => `${subject.code} · Comisión ${subject.sectionName} · ${subject.termName}`

/* Una materia que cursa o dicta: horarios, aula, lo que no leyó y lo próximo de Moodle. */
export function CourseCard({
  subject,
  standing,
  unread = 0
}: {
  subject: MySubject
  standing?: SubjectStanding
  unread?: number
}) {
  const next = subject.assignments.find((a) => !a.past)
  const modality = modalityName(subject.modality)
  const place = modality === subject.location ? modality : [modality, subject.location].filter(Boolean).join(' · ')
  const classroom = subject.classrooms[0]
  return (
    <SubjectCard
      subjectId={subject.subjectId}
      name={subject.name}
      detail={detailOf(subject)}
      status={subject.role === 'profesor' ? null : (standing?.status ?? null)}
      badge={<UnreadPill count={unread} />}
      rows={
        <>
          <Row icon={CalendarClock}>{subject.schedule.map(scheduleLine).join(' · ') || 'Horario a confirmar'}</Row>
          <Row icon={MapPin}>{place || 'Aula a confirmar'}</Row>
          {subject.absences && <AbsencesRow absences={subject.absences} />}
        </>
      }
      callout={
        next && (
          <Callout>
            <span className='truncate font-semibold'>{next.name}</span>
            <span className='text-[0.75rem] text-ink/65'>
              Vence <time dateTime={next.dueDate}>{dueTime(next.dueDate)}</time> · Moodle
            </span>
          </Callout>
        )
      }
      secondary={
        classroom && (
          <a href={classroom.url} target='_blank' rel='noopener noreferrer' className={SECONDARY}>
            Aula
            <ExternalLink aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>de {subject.name} en Moodle (se abre en otra pestaña)</span>
          </a>
        )
      }
    />
  )
}

/* Una materia de un período que ya terminó: cómo quedó y su nota, si la tiene. */
export function ArchivedCard({ subject, standing }: { subject: MySubject; standing?: SubjectStanding }) {
  const final = standing?.finalGrade ?? null
  const course = standing?.courseGrade ?? null
  return (
    <SubjectCard
      subjectId={subject.subjectId}
      name={subject.name}
      detail={detailOf(subject)}
      status={standing?.status ?? null}
      rows={
        <>
          <Row icon={Trophy}>
            {final !== null ? (
              <>
                Nota final <b className='text-ink tabular-nums'>{gradeText(final)}</b>
              </>
            ) : course !== null ? (
              <>
                Nota de cursada <b className='text-ink tabular-nums'>{gradeText(course)}</b>
              </>
            ) : (
              'Sin nota cargada'
            )}
          </Row>
          <Row icon={CalendarClock}>Cursada en {subject.termName}</Row>
        </>
      }
      secondary={
        <Link href={`/notas?materia=${encodeURIComponent(subject.subjectId)}`} className={SECONDARY}>
          <NotebookPen aria-hidden='true' className='size-3.5' />
          Ver notas
        </Link>
      }
    />
  )
}

/* Una materia con la cursada regular y sin el final: la nota de cursada y el acceso a la mesa. */
type NextBoard = NonNullable<PendingFinal['next']>

/** Cómo está la inscripción a la próxima mesa; `warn` resalta lo que pide hacer algo. */
function boardStatus(next: NextBoard): { text: string; warn: boolean } {
  if (next.status === 'inscripto') return { text: 'Ya estás inscripto', warn: false }
  if (next.status === 'no-abrio')
    return { text: `La inscripción abre el ${shortDate(next.enrollmentStart)}`, warn: false }
  if (next.status === 'sin-cupo') return { text: 'Sin cupo en esta mesa', warn: true }
  return { text: `Inscripción abierta hasta el ${shortDate(next.enrollmentEnd)}`, warn: true }
}

/* La próxima mesa del final: turno, día, hora, lugar y cómo está la inscripción. */
function NextBoardBox({ next }: { next: NextBoard }) {
  const status = boardStatus(next)
  return (
    <Callout>
      <span className='truncate'>
        Próxima mesa: <b className='font-semibold'>{next.examPeriod}</b>
      </span>
      <span className='truncate text-[0.75rem] text-ink/70'>
        <time dateTime={next.date}>{longDay(next.date)}</time> · {timeOf(next.date)} · {next.location}
      </span>
      <span className={cn('text-[0.75rem] font-bold', status.warn ? 'text-blue' : 'text-ink/70')}>{status.text}</span>
    </Callout>
  )
}

/** Una materia regular sin el final aprobado. `pending` es lo que da Cursada de su próxima mesa; sin él
    (si no se pudo leer), la tarjeta dice solo si ya está inscripto. */
export function PendingFinalCard({ standing, pending }: { standing: SubjectStanding; pending?: PendingFinal }) {
  const enrolled = pending ? pending.next?.status === 'inscripto' : Boolean(standing.examDate)
  const next = pending?.next ?? null
  return (
    <SubjectCard
      subjectId={standing.subjectId}
      name={standing.name}
      detail={[standing.code, standing.termName ?? (standing.academicYear && `Cursada ${standing.academicYear}`)]
        .filter(Boolean)
        .join(' · ')}
      status='regular'
      rows={
        <>
          <Row icon={Trophy}>
            Nota de cursada{' '}
            <b className='text-ink tabular-nums'>
              {standing.courseGrade !== null ? gradeText(standing.courseGrade) : 'sin nota'}
            </b>
          </Row>
          <Row icon={CalendarClock}>
            {next
              ? `Mesa del ${shortDate(next.date)}`
              : standing.examDate
                ? `Inscripto al final del ${shortDate(standing.examDate)}`
                : 'Todavía no hay mesa a la que anotarte'}
          </Row>
        </>
      }
      callout={next && <NextBoardBox next={next} />}
      secondary={
        <Link href={offerHref(standing.subjectId, 'examen')} className={SECONDARY}>
          {enrolled ? 'Ver la mesa' : 'Inscribirme'}
          <span className='sr-only'>{enrolled ? ` de ${standing.name}` : ` al final de ${standing.name}`}</span>
          <ArrowUpRight aria-hidden='true' className='size-3.5' />
        </Link>
      }
    />
  )
}

/* Todas las filas del mismo alto: las tarjetas de una vista quedan parejas. */
export function SubjectGrid({ children }: { children: ReactNode }) {
  return <ul className='grid auto-rows-fr grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3'>{children}</ul>
}
