/* Inasistencias del alumno: una fila por materia actual en la que tiene faltas, con
   cuántas le quedan y, abajo, cuántas lleva del máximo. Se despliega con cada falta.
   Solo muestra lo que le da Cursada: el aviso de cerca del máximo lo decide ella. */
import { CalendarX, ChevronRight, TriangleAlert } from 'lucide-react'
import { absencesLine } from '@/components/absences/line'
import { shortDate } from '@/components/dates'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'
import type { AbsenceWarning, SubjectAbsences } from '@/lib/core/studies'

/** El chip de cada aviso de faltas: el texto se lee, no depende del color. */
const WARNING: Record<AbsenceWarning, { tone: StatusTone; label: string }> = {
  cerca: { tone: 'warning', label: 'Cuidado' },
  limite: { tone: 'danger', label: 'Al límite' }
}

function Summary({ subject }: { subject: SubjectAbsences }) {
  const look = subject.warning ? WARNING[subject.warning] : null
  const { headline, detail } = absencesLine(subject)
  return (
    <>
      <ChevronRight
        aria-hidden='true'
        className='mt-1 size-4 flex-none text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none'
      />
      <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
        <span className='font-bold'>{subject.subjectName}</span>
        <span className='text-[0.75rem] text-muted-foreground'>
          Comisión {subject.sectionName}
          {subject.classes !== null && ` · ${subject.classes} clases en el período`}
        </span>
        <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          {look ? (
            <StatusPill tone={look.tone} className='gap-1'>
              <TriangleAlert aria-hidden='true' className='size-3.5' strokeWidth={2} />
              {look.label}
            </StatusPill>
          ) : (
            <CalendarX aria-hidden='true' className='size-4 flex-none text-muted-foreground' strokeWidth={1.8} />
          )}
          <span className='text-[0.875rem] font-semibold text-ink'>{headline}</span>
        </span>
        {detail && <span className='text-[0.75rem] text-muted-foreground'>{detail}</span>}
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
