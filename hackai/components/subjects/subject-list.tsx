/* Lista de materias de la pantalla Mis materias: las actuales arriba y las
   archivadas plegadas aparte. Solo muestra lo que le da Cursada. */
import type { MySubject } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function SubjectCard({ subject, archived = false }: { subject: MySubject; archived?: boolean }) {
  return (
    <li
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-xs',
        archived && 'bg-muted/60 shadow-none',
      )}
    >
      <p className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>{subject.code}</p>
      <h3 className={cn('mt-0.5 text-base leading-snug font-semibold', archived ? 'text-muted-foreground' : 'text-foreground')}>
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
      {subjects.map((s) => <SubjectCard key={s.sectionId} subject={s} />)}
    </ul>
  )
}

export function ArchivedSubjects({ subjects }: { subjects: MySubject[] }) {
  if (!subjects.length) return null
  return (
    <details className='group rounded-xl border border-border bg-background'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
        <span>Archivadas ({subjects.length})</span>
        <span aria-hidden className='text-muted-foreground transition-transform group-open:rotate-180'>▾</span>
      </summary>
      <ul className='flex flex-col gap-3 px-4 pb-4'>
        {subjects.map((s) => <SubjectCard key={s.sectionId} subject={s} archived />)}
      </ul>
    </details>
  )
}
