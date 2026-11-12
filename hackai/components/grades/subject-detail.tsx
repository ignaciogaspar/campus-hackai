/* El detalle de una materia en Notas, dentro del panel: el estado, las notas
   de cursada y de final, cada parcial y TP con su nota y la comisión. Solo
   muestra lo que da Cursada. */
import { ArrowRight, CalendarCheck2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { approvalDate, gradeDate } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import { APPROVAL, ASSESSMENT_KIND, gradeText, groupName, KIND, StatusChip } from '@/components/grades/status'
import { spaceHref } from '@/components/spaces/format'
import { buttonVariants } from '@/components/ui/button'
import type { SubjectAssessment, SubjectStanding } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5 rounded-xl bg-ice/70 px-3 py-2.5'>
      <dt className='text-[0.75rem] text-muted-foreground'>{label}</dt>
      <dd className='text-[0.9375rem] font-semibold text-ink tabular-nums'>{children}</dd>
    </div>
  )
}

/** Qué dice la nota de una evaluación: el número, ausente o que todavía no está. */
function assessmentResult(a: SubjectAssessment): { text: string; tone: string } {
  if (a.grade !== null) return { text: gradeText(a.grade), tone: 'text-ink' }
  if (a.graded) return { text: 'Ausente', tone: 'text-destructive' }
  if (!a.past) return { text: 'Todavía no se tomó', tone: 'text-blue' }
  return { text: 'Sin nota todavía', tone: 'text-muted-foreground' }
}

function AssessmentRow({ a }: { a: SubjectAssessment }) {
  const kind = a.kind ? ASSESSMENT_KIND[a.kind] : null
  const result = assessmentResult(a)
  return (
    <li className='flex items-center gap-3 py-3'>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <p className='flex flex-wrap items-center gap-2 text-[0.875rem] font-semibold text-ink'>
          {a.name}
          {kind && (
            <span className={cn('rounded px-1.5 text-[0.6875rem] leading-5 font-semibold', kind.chip)}>
              {kind.label}
            </span>
          )}
          {a.source === 'actuacion-provisoria' && (
            <span className='rounded bg-warning-background px-1.5 text-[0.6875rem] leading-5 font-semibold text-warning-foreground'>
              Provisoria
            </span>
          )}
        </p>
        <p className='text-[0.75rem] text-muted-foreground'>
          <time dateTime={a.date}>{gradeDate(a.date)}</time>
          {!a.past && ' · próximamente'}
        </p>
      </div>
      {a.grade !== null ? (
        <GradeBadge grade={a.grade} />
      ) : (
        <span className={cn('max-w-[7rem] text-right text-[0.75rem] font-semibold', result.tone)}>{result.text}</span>
      )}
    </li>
  )
}

function finalText(subject: SubjectStanding): string {
  if (subject.finalGrade !== null && subject.approval)
    return `${gradeText(subject.finalGrade)} · ${APPROVAL[subject.approval]}`
  if (subject.approval) return `Aprobada · ${APPROVAL[subject.approval]}`
  return 'Todavía no'
}

export function SubjectDetail({ subject }: { subject: SubjectStanding }) {
  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusChip status={subject.status} />
        <span className='text-[0.8125rem] text-muted-foreground'>
          {subject.code} · {KIND[subject.kind]} · {groupName(subject)}
        </span>
      </div>

      <dl className='grid grid-cols-2 gap-2'>
        <Field label='Nota de cursada'>
          {subject.courseGrade !== null ? gradeText(subject.courseGrade) : 'Sin nota'}
        </Field>
        <Field label='Nota final'>{finalText(subject)}</Field>
        <Field label='Aprobada'>{subject.approvedAt ? approvalDate(subject.approvedAt) : '—'}</Field>
        <Field label='Cursada'>
          {subject.sectionName ? `Comisión ${subject.sectionName}` : '—'}
          {subject.termName && (
            <span className='block text-[0.75rem] font-normal text-muted-foreground'>{subject.termName}</span>
          )}
        </Field>
      </dl>

      {subject.examDate && (
        <p className='flex items-start gap-2.5 rounded-xl bg-kind-final-background px-3 py-2.5 text-[0.8125rem] text-ink'>
          <CalendarCheck2 aria-hidden='true' className='mt-px size-4.5 flex-none text-kind-final' strokeWidth={2} />
          <span>
            Estás inscripto al final del <b>{gradeDate(subject.examDate)}</b>.
          </span>
        </p>
      )}

      <section aria-labelledby='evaluaciones' className='flex flex-col'>
        <h3 id='evaluaciones' className='text-[0.9375rem] font-bold text-ink'>
          Parciales y trabajos prácticos
        </h3>
        {subject.assessments.length ? (
          <ul className='divide-y divide-border'>
            {subject.assessments.map((a) => (
              <AssessmentRow key={`${a.date}-${a.name}`} a={a} />
            ))}
          </ul>
        ) : (
          <p className='pt-2 text-[0.8125rem] text-muted-foreground'>
            {subject.sectionName
              ? 'Esta comisión no tiene parciales cargados en el SIU.'
              : 'La aprobaste sin una cursada en el SIU (antes de los períodos que vemos o por equivalencia).'}
          </p>
        )}
      </section>

      {subject.status === 'en-curso' && (
        <Link href={spaceHref(subject.subjectId)} className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 self-start')}>
          Abrir el espacio de la materia
          <ArrowRight aria-hidden='true' data-icon='inline-end' />
        </Link>
      )}
    </div>
  )
}
