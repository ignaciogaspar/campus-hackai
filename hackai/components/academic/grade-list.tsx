/* Notas de parciales, recuperatorios y TP: la última arriba, destacada, unas
   pocas más a la vista y el resto plegado, para que en el celular las
   constancias no queden lejos. Cada una dice de dónde viene en el SIU; la
   provisoria se destaca porque puede cambiar. Solo muestra lo que le da
   Cursada. */
import { NotebookPen } from 'lucide-react'
import { gradeDate } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { Card } from '@/components/ui/card'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import type { AssessmentGrade } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

/** Cuántas notas, además de la última, se ven sin desplegar. */
const VISIBLE = 3

const SOURCES: Record<AssessmentGrade['source'], { label: string; className: string }> = {
  historia: { label: 'Historia académica', className: 'bg-muted text-muted-foreground' },
  'actuacion-provisoria': { label: 'Provisoria', className: 'bg-warning-background text-warning-foreground' }
}

function GradeSource({ source, className }: { source: AssessmentGrade['source']; className?: string }) {
  const { label, className: colors } = SOURCES[source]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold whitespace-nowrap',
        colors,
        className
      )}
    >
      {label}
    </span>
  )
}

const keyOf = (g: AssessmentGrade) => `${g.date}-${g.subjectId}-${g.assessmentName}`

function LatestGrade({ grade }: { grade: AssessmentGrade }) {
  return (
    <Card className='flex items-center gap-4 p-4'>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <p aria-hidden='true' className='text-xs font-bold tracking-widest text-blue-light uppercase'>
          Tu última nota
        </p>
        <h3 className='text-[1.25rem] leading-tight font-extrabold text-balance'>
          <span className='sr-only'>Tu última nota: </span>
          {grade.assessmentName}
        </h3>
        <p className='text-[0.8125rem] text-muted-foreground'>
          {grade.subjectName} · <time dateTime={grade.date}>{gradeDate(grade.date)}</time>
        </p>
        <GradeSource source={grade.source} className='mt-1 self-start' />
      </div>
      <GradeBadge grade={grade.grade} size='lg' />
    </Card>
  )
}

function GradeRows({ grades, label }: { grades: AssessmentGrade[]; label: string }) {
  return (
    <List aria-label={label}>
      {grades.map((g) => (
        <ListItem
          key={keyOf(g)}
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
  const shown = rest.slice(0, VISIBLE)
  const older = rest.slice(VISIBLE)
  const provisional = grades.some((g) => g.source === 'actuacion-provisoria')
  return (
    <div className='flex flex-col gap-3'>
      <LatestGrade grade={latest} />
      {shown.length > 0 && (
        <Card>
          <GradeRows grades={shown} label='Notas anteriores' />
        </Card>
      )}
      {older.length > 0 && (
        <CollapsibleCard title='Más notas' count={`${older.length} ${older.length === 1 ? 'nota' : 'notas'}`}>
          <GradeRows grades={older} label='Más notas' />
        </CollapsibleCard>
      )}
      {provisional && (
        <p className='px-1 text-xs text-pretty text-muted-foreground'>
          «Provisoria»: el docente la cargó en un acta que todavía no cerró, así que puede cambiar. Las de la historia
          académica ya quedaron registradas.
        </p>
      )}
    </div>
  )
}
