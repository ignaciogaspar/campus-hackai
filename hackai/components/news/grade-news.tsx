/* Las notas nuevas, arriba de Novedades: hasta dos, la más nueva primero, una
   fila por evaluación con la materia, cuándo se cargó y la nota, en el mismo
   recuadro que en Notas; si hay más, «Ver todas». Vengan de la historia o de
   actuación provisoria, se ven igual. Tocar una, o «Ver todas», lleva a Notas
   y las marca como vistas (app/notas/vistas/route.ts), así la campana deja de
   contarlas. Qué nota es nueva lo decide Cursada. Los enlaces son <a> y no
   <Link>: precargar la ruta las marcaría como vistas sin tocarlas. */
import { ArrowRight } from 'lucide-react'
import { gradeDate } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { Card } from '@/components/ui/card'
import type { AssessmentGrade } from '@/lib/core/studies'

/** Cuántas se ven; el resto, en Notas. */
const SHOWN = 2
const SEEN_HREF = '/notas/vistas'

/** «Cargada el lun, 9 nov», o la fecha de la evaluación si el SIU no dice cuándo se cargó. */
function When({ grade }: { grade: AssessmentGrade }) {
  const date = grade.loadedAt ?? grade.date
  return (
    <span className='mt-0.5 text-xs text-muted-foreground'>
      {grade.loadedAt ? 'Cargada el ' : 'Evaluación del '}
      <time dateTime={date}>{gradeDate(date)}</time>
    </span>
  )
}

export function GradeNews({ grades }: { grades: AssessmentGrade[] }) {
  return (
    <section aria-labelledby='notas-nuevas' className='flex flex-col gap-2'>
      <div className='flex items-baseline justify-between gap-3 px-1'>
        <h2 id='notas-nuevas' className='text-[0.8125rem] font-extrabold tracking-wide text-ink uppercase'>
          Notas nuevas
        </h2>
        <span className='flex-none text-xs text-muted-foreground'>
          {grades.length} {grades.length === 1 ? 'nueva' : 'nuevas'}
        </span>
      </div>
      <Card>
        <ul className='divide-y divide-border'>
          {grades.slice(0, SHOWN).map((g) => (
            <li key={`${g.source}-${g.subjectId}-${g.assessmentName}-${g.date}`}>
              <a
                href={SEEN_HREF}
                className='flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-background focus-ring-inset lg:gap-4 lg:px-5 lg:py-4'
              >
                <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                  <span className='font-semibold text-pretty text-foreground'>{g.assessmentName}</span>
                  <span className='text-[0.8125rem] text-pretty text-muted-foreground'>
                    Te llegó la nota de {g.subjectName}
                  </span>
                  <When grade={g} />
                </span>
                <GradeBadge grade={g.grade} />
              </a>
            </li>
          ))}
        </ul>
        {grades.length > SHOWN && (
          <a
            href={SEEN_HREF}
            className='flex min-h-11 items-center justify-center gap-1.5 border-t border-border px-4 text-[0.8125rem] font-semibold text-blue transition-colors hover:bg-background focus-ring-inset'
          >
            Ver todas
            <ArrowRight aria-hidden='true' className='size-4' strokeWidth={2} />
          </a>
        )}
      </Card>
    </section>
  )
}
