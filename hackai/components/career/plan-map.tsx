/* El plan de estudios como mapa: un bloque por año de la carrera, más las
   optativas y la vida universitaria, y en cada uno sus materias con el color
   de su estado. Las que le faltan y tienen la inscripción abierta llevan a su
   oferta en Inscripciones. Solo muestra lo que da Cursada. */
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { closingText } from '@/components/enrollment/format'
import { offerHref } from '@/components/enrollment/offer-href'
import { byGroup } from '@/components/grades/filters'
import { gradeText, STATUS } from '@/components/grades/status'
import type { OpenEnrollment, SubjectStanding, SubjectStatus } from '@/lib/core/studies'
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

/** Puede anotarse ahora: le falta cursarla y la inscripción está abierta. */
const canEnroll = (subject: SubjectStanding, open: OpenEnrollment | undefined): open is OpenEnrollment =>
  open !== undefined && subject.status === 'pendiente'

function OpenChip({ subject, open }: { subject: SubjectStanding; open: OpenEnrollment }) {
  return (
    <li>
      <Link
        href={offerHref(subject.subjectId, open.kind)}
        className='flex min-w-0 items-center gap-2 rounded-xl border border-blue/30 bg-card px-3 py-2 text-[0.8125rem] transition-colors hover:border-blue/50 hover:bg-accent/40 focus-ring'
      >
        <span aria-hidden='true' className={cn('size-2 flex-none rounded-full', STATUS.pendiente.dot)} />
        <span className='min-w-0 flex-1 leading-snug text-ink'>
          {subject.name}
          <span className='sr-only'>: {STATUS.pendiente.label}</span>
        </span>
        <span className='flex-none text-[0.75rem] font-semibold text-blue'>
          Inscribite
          {open.closesInDays !== null && <span className='hidden sm:inline'> · {closingText(open.closesInDays)}</span>}
        </span>
        <ChevronRight aria-hidden='true' className='size-4 flex-none text-blue' />
      </Link>
    </li>
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

export function PlanMap({
  subjects,
  open = new Map()
}: {
  subjects: SubjectStanding[]
  /** Las inscripciones abiertas a cursar, por materia. */
  open?: Map<string, OpenEnrollment>
}) {
  return (
    <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-3'>
      {byGroup(subjects).map((group) => {
        const done = group.items.filter((s) => s.status === 'aprobada' || s.status === 'promocionada').length
        const enrollable = group.items.filter((s) => canEnroll(s, open.get(s.subjectId))).length
        return (
          <section key={group.name} aria-label={group.name} className='rounded-2xl border border-border bg-card p-4'>
            <div className='flex items-baseline justify-between gap-2 pb-3'>
              <h3 className='text-[0.9375rem] font-bold text-ink'>{group.name}</h3>
              <span className='text-right text-[0.75rem] text-muted-foreground tabular-nums'>
                {done} de {group.items.length} aprobadas
                {enrollable > 0 && (
                  <span className='block font-semibold text-blue'>
                    {enrollable === 1 ? '1 abierta' : `${enrollable} abiertas`} para inscribirte
                  </span>
                )}
              </span>
            </div>
            <ul className='flex flex-col gap-1.5'>
              {group.items.map((s) => {
                const enrollment = open.get(s.subjectId)
                return canEnroll(s, enrollment) ? (
                  <OpenChip key={s.subjectId} subject={s} open={enrollment} />
                ) : (
                  <SubjectChip key={s.subjectId} subject={s} />
                )
              })}
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
