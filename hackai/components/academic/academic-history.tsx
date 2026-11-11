/* Historia académica: el promedio y las materias aprobadas, con cómo y cuándo
   se aprobó cada una y su nota. Van por año de aprobación, plegadas salvo el
   más reciente, como «Aprobadas» de los mocks, para que en quinto año no sea
   una pared de materias. Solo muestra lo que le da Cursada. */
import { GraduationCap } from 'lucide-react'
import { approvalDate, approvalYear, average } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { Card } from '@/components/ui/card'
import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import type { AcademicRecord, Approval, HistoryItem } from '@/lib/core/studies'

const APPROVALS: Record<Approval, string> = {
  promocion: 'Promoción',
  examen: 'Final',
  equivalencia: 'Equivalencia'
}

const subjects = (n: number) => `${n} ${n === 1 ? 'materia' : 'materias'}`

/** Las materias por año de aprobación, en el orden en que vienen (la más reciente primero). */
function byYear(history: HistoryItem[]): { year: string; items: HistoryItem[] }[] {
  const groups: { year: string; items: HistoryItem[] }[] = []
  for (const item of history) {
    const year = approvalYear(item.date)
    const group = groups.find((g) => g.year === year)
    if (group) group.items.push(item)
    else groups.push({ year, items: [item] })
  }
  return groups
}

export function AcademicHistory({ record }: { record: Pick<AcademicRecord, 'history' | 'average'> }) {
  if (!record.history.length) {
    return (
      <EmptyState icon={GraduationCap} title='Todavía no aprobaste materias'>
        Cuando apruebes una materia por promoción, por final o por equivalencia, aparece acá con su nota.
      </EmptyState>
    )
  }
  return (
    <div className='flex flex-col gap-3'>
      <Card className='flex items-end justify-between gap-3 p-4'>
        <div className='flex flex-col'>
          <span className='text-xs font-bold tracking-widest text-muted-foreground uppercase'>Promedio</span>
          <span className='text-[2rem] leading-none font-extrabold text-blue tabular-nums'>
            {record.average === null ? '—' : average(record.average)}
          </span>
        </div>
        <span className='text-[0.8125rem] text-muted-foreground'>{subjects(record.history.length)} aprobadas</span>
      </Card>
      {byYear(record.history).map((group, i) => (
        <CollapsibleCard key={group.year} title={group.year} count={subjects(group.items.length)} defaultOpen={i === 0}>
          <List aria-label={`Materias aprobadas en ${group.year}`}>
            {group.items.map((h) => (
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
        </CollapsibleCard>
      ))}
    </div>
  )
}
