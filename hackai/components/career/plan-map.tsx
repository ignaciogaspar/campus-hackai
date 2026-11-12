/* El plan de estudios como mapa: un bloque por año de la carrera, más las
   optativas y la vida universitaria, y en cada uno sus materias con el color
   de su estado. Solo muestra lo que da Cursada. */
import Link from 'next/link'
import { byGroup } from '@/components/grades/filters'
import { gradeText, STATUS } from '@/components/grades/status'
import type { SubjectStanding, SubjectStatus } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const LEGEND: SubjectStatus[] = ['aprobada', 'en-curso', 'regular', 'pendiente']

const LEGEND_LABEL: Partial<Record<SubjectStatus, string>> = {
  aprobada: 'Aprobada',
  regular: 'Falta el final'
}

const CHIP: Record<SubjectStatus, string> = {
  promocionada: 'border-success/20 bg-success-background',
  aprobada: 'border-success/20 bg-success-background',
  'en-curso': 'border-blue/20 bg-accent',
  regular: 'border-kind-recuperatorio-border bg-kind-recuperatorio-background',
  pendiente: 'border-border bg-card'
}

export function PlanLegend() {
  return (
    <p className='flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground'>
      {LEGEND.map((status) => (
        <span key={status} className='inline-flex items-center gap-1.5'>
          <span aria-hidden='true' className={cn('size-2 rounded-full', STATUS[status].dot)} />
          {LEGEND_LABEL[status] ?? STATUS[status].label}
        </span>
      ))}
    </p>
  )
}

function SubjectChip({ subject }: { subject: SubjectStanding }) {
  const grade = subject.finalGrade
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-[0.8125rem]',
        CHIP[subject.status],
        subject.status === 'pendiente' && 'text-muted-foreground'
      )}
    >
      <span aria-hidden='true' className={cn('size-2 flex-none rounded-full', STATUS[subject.status].dot)} />
      <span className={cn('min-w-0 flex-1 leading-snug', subject.status !== 'pendiente' && 'font-semibold text-ink')}>
        {subject.name}
        <span className='sr-only'>: {STATUS[subject.status].label}</span>
      </span>
      {grade !== null && <span className='flex-none font-bold text-success tabular-nums'>{gradeText(grade)}</span>}
    </li>
  )
}

export function PlanMap({ subjects }: { subjects: SubjectStanding[] }) {
  return (
    <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-3'>
      {byGroup(subjects).map((group) => {
        const done = group.items.filter((s) => s.status === 'aprobada' || s.status === 'promocionada').length
        return (
          <section key={group.name} aria-label={group.name} className='rounded-2xl border border-border bg-card p-4'>
            <div className='flex items-baseline justify-between gap-2 pb-3'>
              <h3 className='text-[0.9375rem] font-bold text-ink'>{group.name}</h3>
              <span className='text-[0.75rem] text-muted-foreground tabular-nums'>
                {done} de {group.items.length} aprobadas
              </span>
            </div>
            <ul className='flex flex-col gap-1.5'>
              {group.items.map((s) => (
                <SubjectChip key={s.subjectId} subject={s} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function PlanLink() {
  return (
    <Link href='/notas' className='text-[0.8125rem] font-semibold text-blue hover:underline focus-ring'>
      Ver las notas de cada materia
    </Link>
  )
}
