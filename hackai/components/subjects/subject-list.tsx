/* Lista de materias de la pantalla Mis materias: las actuales arriba y las
   archivadas plegadas aparte. Cada una con el enlace a su aula de Moodle y, las
   actuales, sus tareas con fecha. Solo muestra lo que le da Cursada. */
import { ExternalLink } from 'lucide-react'
import { dueTime } from '@/components/dates'
import { buttonVariants } from '@/components/ui/button'
import type { MyAssignment, MyClassroom, MySubject } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function ClassroomLinks({ classrooms }: { classrooms: MyClassroom[] }) {
  if (!classrooms.length) return null
  return (
    <div className='mt-3 flex flex-col gap-2'>
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
            key={`${a.dueDate}-${a.name}`}
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

function SubjectCard({ subject, archived = false }: { subject: MySubject; archived?: boolean }) {
  return (
    <li className={cn('rounded-xl border border-border bg-card p-4 shadow-xs', archived && 'bg-muted/60 shadow-none')}>
      <p className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>{subject.code}</p>
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
      <ClassroomLinks classrooms={subject.classrooms} />
      <Assignments assignments={subject.assignments} />
    </li>
  )
}

export function CurrentSubjects({ subjects }: { subjects: MySubject[] }) {
  if (!subjects.length) {
    return (
      <p className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
        No tenés materias en curso ni del próximo período.
      </p>
    )
  }
  return (
    <ul className='flex flex-col gap-3'>
      {subjects.map((s) => (
        <SubjectCard key={s.sectionId} subject={s} />
      ))}
    </ul>
  )
}

export function ArchivedSubjects({ subjects }: { subjects: MySubject[] }) {
  if (!subjects.length) return null
  return (
    <details className='group rounded-xl border border-border bg-background'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
        <span>Archivadas ({subjects.length})</span>
        <span aria-hidden className='text-muted-foreground transition-transform group-open:rotate-180'>
          ▾
        </span>
      </summary>
      <ul className='flex flex-col gap-3 px-4 pb-4'>
        {subjects.map((s) => (
          <SubjectCard key={s.sectionId} subject={s} archived />
        ))}
      </ul>
    </details>
  )
}
