/* Notas de parciales, recuperatorios y TP: la última arriba, destacada, y las
   demás en lista. Cada una dice de dónde viene en el SIU, en criollo: si ya
   está en la historia académica o si es provisoria porque el acta sigue
   abierta. Solo muestra lo que le da Cursada. */
import { NotebookPen } from 'lucide-react'
import { gradeDate } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import type { AssessmentGrade } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const SOURCES: Record<AssessmentGrade['source'], { label: string; className: string }> = {
  historia: { label: 'Historia académica', className: 'bg-accent text-blue' },
  'actuacion-provisoria': {
    label: 'Provisoria · acta abierta',
    className: 'bg-warning-background text-warning-foreground'
  }
}

function GradeSource({ source, className }: { source: AssessmentGrade['source']; className?: string }) {
  const { label, className: colors } = SOURCES[source]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-px text-[11px] font-bold whitespace-nowrap',
        colors,
        className
      )}
    >
      {label}
    </span>
  )
}

function LatestGrade({ grade }: { grade: AssessmentGrade }) {
  return (
    <Card className='flex items-center gap-4 p-5'>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <span className='text-xs font-bold tracking-widest text-blue-light uppercase'>Tu última nota</span>
        <h3 className='text-[1.25rem] leading-tight font-extrabold text-balance'>{grade.assessmentName}</h3>
        <p className='text-[0.8125rem] text-muted-foreground'>
          {grade.subjectName} · <time dateTime={grade.date}>{gradeDate(grade.date)}</time>
        </p>
        <GradeSource source={grade.source} className='mt-1 self-start' />
      </div>
      <GradeBadge grade={grade.grade} size='lg' />
    </Card>
  )
}

export function GradeList({ grades }: { grades: AssessmentGrade[] }) {
  if (!grades.length) {
    return (
      <EmptyState icon={NotebookPen} title='Todavía no tenés notas de parciales'>
        Cuando un docente cargue una nota en el SIU, aparece acá, sea en la historia académica o en un acta todavía
        abierta.
      </EmptyState>
    )
  }
  const [latest, ...rest] = grades
  const provisional = grades.some((g) => g.source === 'actuacion-provisoria')
  return (
    <div className='flex flex-col gap-3'>
      <LatestGrade grade={latest} />
      {rest.length > 0 && (
        <Card>
          <List>
            {rest.map((g) => (
              <ListItem
                key={`${g.date}-${g.subjectId}-${g.assessmentName}`}
                title={g.assessmentName}
                description={g.subjectName}
                meta={
                  <>
                    <GradeSource source={g.source} />
                    <time dateTime={g.date}>{gradeDate(g.date)}</time>
                  </>
                }
                end={<GradeBadge grade={g.grade} />}
              />
            ))}
          </List>
        </Card>
      )}
      {provisional && (
        <p className='px-1 text-xs text-pretty text-muted-foreground'>
          «Provisoria» quiere decir que el docente la cargó en un acta que todavía no cerró: puede cambiar hasta que la
          cierre.
        </p>
      )}
    </div>
  )
}
