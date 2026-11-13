/* Inasistencias del alumno: una fila por materia actual en la que tiene faltas, con el
   máximo si lo hay. Se despliega con cada falta. Solo
   muestra lo que le da Cursada: el aviso de cerca del máximo lo decide ella. */
import { CalendarX, ChevronRight, TriangleAlert } from 'lucide-react'
import { absencesLine } from '@/components/absences/line'
import { shortDate } from '@/components/dates'
import type { AbsenceWarning, SubjectAbsences } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

/** Cómo se ve cada aviso de faltas: el fondo, el ícono y lo que lee un lector de pantalla. */
const WARNING: Record<AbsenceWarning, { box: string; icon: string; label: string }> = {
  cerca: { box: 'bg-warning-background text-warning-foreground', icon: 'text-warning-icon', label: 'Cuidado: ' },
  limite: { box: 'bg-error-background text-error-foreground', icon: 'text-destructive', label: 'Aviso: ' }
}

function Summary({ subject }: { subject: SubjectAbsences }) {
  const look = subject.warning ? WARNING[subject.warning] : null
  return (
    <>
      <ChevronRight
        aria-hidden='true'
        className='mt-1 size-4 flex-none text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none'
      />
      <span className='flex min-w-0 flex-col gap-1.5'>
        <span className='font-bold'>{subject.subjectName}</span>
        <span className='text-[0.75rem] text-muted-foreground'>
          Comisión {subject.sectionName}
          {subject.classes !== null && ` · ${subject.classes} clases en el período`}
        </span>
        <span
          className={cn(
            'flex w-fit items-start gap-2 text-[0.8125rem]',
            look ? cn('rounded-xl px-2.5 py-1.5 font-semibold', look.box) : 'text-ink/80'
          )}
        >
          {look ? (
            <TriangleAlert aria-hidden='true' className={cn('mt-0.5 size-4 flex-none', look.icon)} strokeWidth={2} />
          ) : (
            <CalendarX aria-hidden='true' className='mt-0.5 size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
          )}
          <span className='min-w-0'>
            {look && <span className='sr-only'>{look.label}</span>}
            {absencesLine(subject)}
          </span>
        </span>
      </span>
    </>
  )
}

export function AbsencesList({ subjects }: { subjects: SubjectAbsences[] }) {
  return (
    <ul className='flex flex-col gap-3'>
      {subjects.map((subject) => (
        <li key={subject.sectionId}>
          <details className='group overflow-hidden rounded-[22px] bg-card shadow-card'>
            <summary className='flex cursor-pointer list-none items-start gap-2 px-4 py-3.5 focus-ring-inset [&::-webkit-details-marker]:hidden'>
              <Summary subject={subject} />
            </summary>
            <div className='border-t border-border'>
              {subject.absences.length === 0 ? (
                <p className='px-4 py-3 text-[0.8125rem] text-muted-foreground'>No tenés faltas en esta materia.</p>
              ) : (
                <ul className='divide-y divide-border'>
                  {subject.absences.map((a) => (
                    <li
                      key={`${a.source}-${a.id}`}
                      className='flex items-center justify-between gap-3 px-4 py-3 text-[0.875rem]'
                    >
                      <time dateTime={a.date} className='font-medium'>
                        {shortDate(a.date)}
                      </time>
                      <span className='text-[0.8125rem] text-muted-foreground'>
                        {a.justified ? 'Justificada' : 'Sin justificar'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}
