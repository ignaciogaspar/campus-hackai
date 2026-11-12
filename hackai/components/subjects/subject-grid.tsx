/* Las tarjetas de Mis materias, en grilla: una por materia, con su ícono, su
   comisión, sus horarios y lo que sigue. Hay tres vistas que arma la página:
   las que cursa (con el espacio y el aula), las que tienen el final pendiente
   (con el acceso a inscribirse a la mesa) y las archivadas. Solo muestra lo
   que le dan Cursada: qué es actual, qué está regular y qué está aprobado lo
   decide Cursada. */
import { CalendarClock, ChevronRight, ExternalLink, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { dueTime, shortDate } from '@/components/dates'
import { modalityName, scheduleLine } from '@/components/enrollment/format'
import { StatusChip } from '@/components/grades/status'
import { spaceHref } from '@/components/spaces/format'
import { SubjectIcon } from '@/components/subjects/subject-icon'
import { buttonVariants } from '@/components/ui/button'
import type { MySubject, SubjectStanding, SubjectStatus } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <p className='flex items-start gap-2 text-[0.8125rem] text-ink/80'>
      <Icon aria-hidden='true' className='mt-0.5 size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
      <span className='min-w-0'>{children}</span>
    </p>
  )
}

/* La cabecera de cada tarjeta: ícono, nombre, sigla y comisión, y el estado. */
function CardHead({
  name,
  detail,
  status,
  muted
}: {
  name: string
  detail: string
  status: SubjectStatus | null
  muted?: boolean
}) {
  return (
    <div className='flex items-start gap-3'>
      <SubjectIcon name={name} size='lg' tone={muted ? 'muted' : 'solid'} />
      <div className='min-w-0 flex-1'>
        <h3
          className={cn('text-[0.9375rem] leading-snug font-semibold text-balance', muted ? 'text-ink/70' : 'text-ink')}
        >
          {name}
        </h3>
        <p className='mt-0.5 text-[0.75rem] text-muted-foreground'>{detail}</p>
        {status && <StatusChip status={status} className='mt-2' />}
      </div>
    </div>
  )
}

const CARD = 'flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-4'

/** Lo que no leyó en el espacio de la materia. En compu también está en la barra lateral. */
function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className='inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[0.75rem] font-semibold text-blue motion-safe:animate-in motion-safe:zoom-in-50'>
      <span aria-hidden='true' className='size-1.5 rounded-full bg-blue' />
      {count} sin leer
    </span>
  )
}

/* Una materia que cursa o dicta: horarios, aula, lo que no leyó y lo próximo de Moodle, con el espacio y el aula. */
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
  return (
    <li className={CARD}>
      <CardHead
        name={subject.name}
        detail={`${subject.code} · Comisión ${subject.sectionName} · ${subject.termName}`}
        status={standing?.status ?? null}
      />
      <div className='flex flex-col gap-1.5'>
        <Row icon={CalendarClock}>{subject.schedule.map(scheduleLine).join(' · ') || 'Horario a confirmar'}</Row>
        <Row icon={MapPin}>{place}</Row>
        <UnreadPill count={unread} />
        {subject.role === 'profesor' && (
          <p className='w-fit rounded-full bg-accent px-2 py-0.5 text-[0.75rem] font-semibold text-blue'>
            Dictás esta comisión
          </p>
        )}
      </div>
      {next && (
        <p className='rounded-xl bg-kind-entrega-background px-3 py-2 text-[0.8125rem] text-ink'>
          <span className='font-semibold'>{next.name}</span>
          <span className='block text-[0.75rem] text-ink/65'>
            Vence <time dateTime={next.dueDate}>{dueTime(next.dueDate)}</time> · Moodle
          </span>
        </p>
      )}
      <div className='mt-auto flex flex-wrap gap-2'>
        <Link
          href={spaceHref(subject.subjectId)}
          className={cn(buttonVariants({ size: 'lg' }), 'min-h-10 flex-1 justify-center font-semibold')}
        >
          Abrir espacio
          <span className='sr-only'> de {subject.name}</span>
          <ChevronRight aria-hidden data-icon='inline-end' />
        </Link>
        {subject.classrooms.slice(0, 1).map((c) => (
          <a
            key={c.courseId}
            href={c.url}
            target='_blank'
            rel='noopener noreferrer'
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-10 flex-1 justify-center')}
          >
            Ir al aula
            <ExternalLink aria-hidden data-icon='inline-end' />
            <span className='sr-only'>(se abre en otra pestaña)</span>
          </a>
        ))}
      </div>
    </li>
  )
}

/* Una materia de un período que ya terminó: cómo quedó y su nota, si la tiene. */
export function ArchivedCard({ subject, standing }: { subject: MySubject; standing?: SubjectStanding }) {
  const grade = standing?.finalGrade ?? standing?.courseGrade ?? null
  return (
    <li className={cn(CARD, 'bg-muted/40')}>
      <CardHead
        name={subject.name}
        detail={`${subject.code} · Comisión ${subject.sectionName} · ${subject.termName}`}
        status={standing?.status ?? null}
        muted
      />
      {grade !== null && (
        <p className='text-[0.8125rem] text-ink/80'>
          {standing?.finalGrade !== null ? 'Nota final' : 'Nota de cursada'}:{' '}
          <b className='text-ink tabular-nums'>{grade.toLocaleString('es-AR')}</b>
        </p>
      )}
      <div className='mt-auto flex flex-wrap gap-2'>
        <Link
          href={spaceHref(subject.subjectId)}
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-10 flex-1 justify-center')}
        >
          Ver el espacio
          <span className='sr-only'> de {subject.name}</span>
        </Link>
        <Link
          href='/notas'
          className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'min-h-10 flex-1 justify-center')}
        >
          Ver notas
        </Link>
      </div>
    </li>
  )
}

/* Una materia con la cursada regular y sin el final: la nota de cursada y el acceso a la mesa. */
export function PendingFinalCard({ standing }: { standing: SubjectStanding }) {
  return (
    <li className={CARD}>
      <CardHead
        name={standing.name}
        detail={[standing.code, standing.termName ?? (standing.academicYear && `Cursada ${standing.academicYear}`)]
          .filter(Boolean)
          .join(' · ')}
        status='regular'
      />
      <p className='text-[0.8125rem] text-ink/80'>
        Nota de cursada:{' '}
        <b className='text-ink tabular-nums'>{standing.courseGrade?.toLocaleString('es-AR') ?? 'sin nota'}</b>
      </p>
      {standing.examDate ? (
        <p className='mt-auto rounded-xl bg-kind-final-background px-3 py-2 text-[0.8125rem] text-ink'>
          Estás inscripto al final del <time dateTime={standing.examDate}>{shortDate(standing.examDate)}</time>.
        </p>
      ) : (
        <Link
          href={`/inscripciones?tab=examenes&materia=${encodeURIComponent(standing.subjectId)}`}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-auto min-h-10 justify-center font-semibold')}
        >
          Inscribirme al final
          <span className='sr-only'> de {standing.name}</span>
          <ChevronRight aria-hidden data-icon='inline-end' />
        </Link>
      )}
    </li>
  )
}

export function SubjectGrid({ children }: { children: ReactNode }) {
  return <ul className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>{children}</ul>
}
