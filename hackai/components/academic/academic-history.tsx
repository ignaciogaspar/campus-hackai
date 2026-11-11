/* Historia académica: el promedio y las materias aprobadas, con cómo y cuándo
   se aprobó cada una y su nota. Solo muestra lo que le da Cursada. */
import { GraduationCap } from 'lucide-react'
import { approvalDate, average } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import type { AcademicRecord, Approval } from '@/lib/core/studies'

const APPROVALS: Record<Approval, string> = {
  promocion: 'Promoción',
  examen: 'Final',
  equivalencia: 'Equivalencia'
}

export function AcademicHistory({ record }: { record: Pick<AcademicRecord, 'history' | 'average'> }) {
  if (!record.history.length) {
    return (
      <EmptyState icon={GraduationCap} title='Todavía no aprobaste materias'>
        Cuando apruebes una materia por promoción, por final o por equivalencia, aparece acá con su nota.
      </EmptyState>
    )
  }
  const count = record.history.length
  return (
    <Card>
      <div className='flex items-end justify-between gap-3 border-b border-border px-4 py-4'>
        <div className='flex flex-col'>
          <span className='text-xs font-bold tracking-widest text-muted-foreground uppercase'>Promedio</span>
          <span className='text-[2rem] leading-none font-extrabold text-blue tabular-nums'>
            {record.average === null ? '—' : average(record.average)}
          </span>
        </div>
        <span className='text-[0.8125rem] text-muted-foreground'>
          {count} {count === 1 ? 'materia aprobada' : 'materias aprobadas'}
        </span>
      </div>
      <List>
        {record.history.map((h) => (
          <ListItem
            key={`${h.subjectId}-${h.date}`}
            title={h.subjectName}
            meta={
              <span>
                {APPROVALS[h.approval]} · <time dateTime={h.date}>{approvalDate(h.date)}</time>
              </span>
            }
            end={<GradeBadge grade={h.grade} />}
          />
        ))}
      </List>
    </Card>
  )
}
