/* El detalle de una materia en Notas, dentro del panel: el estado, las notas
   de cursada y de final, cada parcial, TP y tarea con su nota (y, si el docente
   la publicó en HackAI, su comentario entero) y la comisión. Solo muestra lo
   que le llega: lo del SIU y lo publicado en HackAI ya vienen juntos. */
import { ArrowRight, CalendarCheck2 } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { approvalDate, gradeDate, termLabel } from '@/components/academic/format'
import { GradeBadge } from '@/components/academic/grade-badge'
import {
  APPROVAL,
  ASSESSMENT_KIND,
  gradeText,
  groupName,
  isApproved,
  KIND,
  StatusChip
} from '@/components/grades/status'
import { spaceHref } from '@/components/spaces/format'
import { buttonVariants } from '@/components/ui/button'
import { OriginBadge } from '@/components/ui/origin-badge'
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
  if (!a.past) return { text: 'Todavía no se tomó', tone: 'text-muted-foreground' }
  return { text: 'Sin nota todavía', tone: 'text-muted-foreground' }
}

function AssessmentRow({ a, highlighted }: { a: SubjectAssessment; highlighted: boolean }) {
  const kind = a.kind ? ASSESSMENT_KIND[a.kind] : null
  const result = assessmentResult(a)
  return (
    <li
      aria-current={highlighted ? 'true' : undefined}
      className={cn('flex items-center gap-3 py-3', highlighted && '-mx-2 rounded-xl bg-accent px-2')}
    >
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
          {a.source === 'hackai' && <OriginBadge origin='hackai' />}
          {highlighted && <span className='text-[0.75rem] font-semibold text-blue'>Nueva</span>}
        </p>
        <p className='text-[0.75rem] text-muted-foreground'>
          <time dateTime={a.date}>{gradeDate(a.date)}</time>
          {!a.past && !a.graded && a.grade === null && ' · próximamente'}
        </p>
        {a.comment && (
          <p className='mt-0.5 text-[0.8125rem] whitespace-pre-line text-ink'>
            <span className='font-semibold'>Comentario del docente: </span>
            {a.comment}
          </p>
        )}
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

/** Por qué no hay parciales, según el estado de la materia: nunca dice que la aprobó si no la aprobó. */
function noAssessmentsText(subject: SubjectStanding): string {
  if (subject.approval === 'equivalencia') return 'La aprobaste por equivalencia, así que no tiene parciales.'
  if (subject.sectionName) {
    return subject.status === 'en-curso'
      ? 'Tu comisión todavía no cargó parciales.'
      : 'Tu comisión no cargó parciales en el SIU.'
  }
  if (isApproved(subject.status)) return 'El SIU no tiene la cursada de esta materia, así que no hay parciales.'
  if (subject.status === 'regular') return 'El SIU no tiene los parciales de tu cursada.'
  return 'Todavía no la cursaste.'
}

function Section({ subject }: { subject: SubjectStanding }) {
  return (
    <>
      {subject.sectionName ? `Comisión ${subject.sectionName}` : '—'}
      {subject.termName && (
        <span className='block text-[0.75rem] font-normal text-muted-foreground'>{termLabel(subject.termName)}</span>
      )}
    </>
  )
}

/** En curso no hay nota de cursada ni final todavía: una línea en lugar de cuatro tarjetas vacías. */
function InProgress({ subject }: { subject: SubjectStanding }) {
  return (
    <div className='flex flex-col gap-0.5 rounded-xl bg-ice/70 px-3 py-2.5 text-[0.8125rem] text-ink'>
      <p>
        <b>Cursando</b> · la nota de cursada sale al cerrar
      </p>
      {(subject.sectionName || subject.termName) && (
        <p className='text-[0.75rem] text-muted-foreground'>
          {[subject.sectionName && `Comisión ${subject.sectionName}`, subject.termName && termLabel(subject.termName)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  )
}

function Standing({ subject }: { subject: SubjectStanding }) {
  if (subject.status === 'en-curso') return <InProgress subject={subject} />
  return (
    <dl className='grid grid-cols-2 gap-2'>
      <Field label='Nota de cursada'>
        {subject.courseGrade !== null ? gradeText(subject.courseGrade) : 'Sin nota'}
      </Field>
      <Field label='Nota final'>{finalText(subject)}</Field>
      {subject.approvedAt && <Field label='Fecha de aprobación'>{approvalDate(subject.approvedAt)}</Field>}
      {(subject.sectionName || subject.termName) && (
        <Field label='Cursada'>
          <Section subject={subject} />
        </Field>
      )}
    </dl>
  )
}

/** `highlight`: la evaluación que se resalta, la nota nueva que tocó en Novedades. */
export function SubjectDetail({ subject, highlight }: { subject: SubjectStanding; highlight?: string }) {
  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusChip status={subject.status} />
        <span className='text-[0.8125rem] text-muted-foreground'>
          {subject.code} · {KIND[subject.kind]} · {groupName(subject)}
        </span>
      </div>

      <Standing subject={subject} />

      {subject.examDate && (
        <p className='flex items-start gap-2.5 rounded-xl bg-accent px-3 py-2.5 text-[0.8125rem] text-ink'>
          <CalendarCheck2 aria-hidden='true' className='mt-px size-4.5 flex-none text-blue' strokeWidth={2} />
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
              <AssessmentRow key={`${a.date}-${a.name}`} a={a} highlighted={a.name === highlight} />
            ))}
          </ul>
        ) : (
          <p className='pt-2 text-[0.8125rem] text-muted-foreground'>{noAssessmentsText(subject)}</p>
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
