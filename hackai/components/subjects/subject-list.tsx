/* Lista de materias de la pantalla Mis materias: las actuales arriba y las
   archivadas plegadas aparte. En el celular, una columna; en compu, un mosaico
   de hasta 3 columnas, para que las tareas se lean sin cortarse. Cada una
   lleva a su espacio, con el enlace a su aula de Moodle y, las actuales, sus
   tareas con fecha y lo que no leíste en su espacio. Solo muestra lo que le
   dan Cursada y Espacios. */
import { ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { dueTime } from '@/components/dates'
import { spaceHref } from '@/components/spaces/format'
import { buttonVariants } from '@/components/ui/button'
import type { MyAssignment, MySubject } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

/** El espacio de la materia como acción principal y, al lado, el aula de Moodle. */
function SubjectActions({ subject }: { subject: MySubject }) {
  const { subjectId, classrooms } = subject
  return (
    <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
      <Link
        href={spaceHref(subjectId)}
        className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 w-full justify-center font-semibold sm:w-auto')}
      >
        Abrir espacio
        <span className='sr-only'> de {subject.name}</span>
        <ChevronRight aria-hidden data-icon='inline-end' />
      </Link>
      {classrooms.map((c) => (
        <a
          key={c.courseId}
          href={c.url}
          target='_blank'
          rel='noopener noreferrer'
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 w-full justify-center sm:w-auto')}
        >
          {classrooms.length > 1 ? `Ir al aula: ${c.name}` : 'Ir al aula'}
          <ExternalLink aria-hidden data-icon='inline-end' />
          <span className='sr-only'>(se abre en otra pestaña)</span>
        </a>
      ))}
    </div>
  )
}

function Assignments({ assignments }: { assignments: MyAssignment[] }) {
  if (!assignments.length) return null
  return (
    <div className='mt-3 border-t border-border pt-3'>
      <h4 className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>Tareas con fecha</h4>
      <ul className='mt-2 flex flex-col gap-2'>
        {assignments.map((a) => (
          <li
            key={a.id}
            className={cn('flex items-start justify-between gap-3 text-sm', a.past && 'text-muted-foreground')}
          >
            <div className='min-w-0'>
              <p className={cn('leading-snug font-medium', a.past ? 'text-muted-foreground' : 'text-foreground')}>
                {a.name}
              </p>
              <p className='text-xs'>
                {a.past ? 'Venció' : 'Vence'} <time dateTime={a.dueDate}>{dueTime(a.dueDate)}</time>
              </p>
            </div>
            <span className='shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground'>
              Moodle
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Lo que no leyó en el espacio de la materia. En compu también está en la barra lateral. */
function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className='inline-flex flex-none items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-blue motion-safe:animate-in motion-safe:zoom-in-50'>
      <span aria-hidden='true' className='size-1.5 rounded-full bg-blue-light' />
      {count} sin leer
    </span>
  )
}

function SubjectCard({
  subject,
  archived = false,
  unread = 0
}: {
  subject: MySubject
  archived?: boolean
  unread?: number
}) {
  return (
    <li className={cn('rounded-[22px] bg-card p-4 shadow-card', archived && 'bg-muted/60 shadow-none')}>
      <div className='flex items-start justify-between gap-3'>
        <p className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>{subject.code}</p>
        <UnreadPill count={unread} />
      </div>
      <h3
        className={cn(
          'mt-0.5 text-base leading-snug font-semibold',
          archived ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {subject.name}
      </h3>
      <p className='mt-1 text-sm text-muted-foreground'>
        Comisión {subject.sectionName} · {subject.termName}
      </p>
      {subject.role === 'profesor' && (
        <p className='mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary'>
          Dictás esta comisión
        </p>
      )}
      <SubjectActions subject={subject} />
      <Assignments assignments={subject.assignments} />
    </li>
  )
}

const MOSAIC = 'grid gap-3 lg:grid-cols-2 lg:items-start xl:grid-cols-3'

/** `unread`: lo sin leer en el espacio de cada materia, por id de materia. */
export function CurrentSubjects({ subjects, unread }: { subjects: MySubject[]; unread: Map<string, number> }) {
  return (
    <ul className={MOSAIC}>
      {subjects.map((s) => (
        <SubjectCard key={s.sectionId} subject={s} unread={unread.get(s.subjectId)} />
      ))}
    </ul>
  )
}

export function ArchivedSubjects({ subjects }: { subjects: MySubject[] }) {
  if (!subjects.length) return null
  return (
    <details className='group rounded-[22px] bg-card shadow-card'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
        <span>Archivadas ({subjects.length})</span>
        <span aria-hidden className='text-muted-foreground transition-transform group-open:rotate-180'>
          ▾
        </span>
      </summary>
      <ul className={cn(MOSAIC, 'px-4 pb-4')}>
        {subjects.map((s) => (
          <SubjectCard key={s.sectionId} subject={s} archived />
        ))}
      </ul>
    </details>
  )
}
