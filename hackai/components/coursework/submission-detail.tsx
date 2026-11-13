/* Una entrega abierta por el docente: de quién es (nombre, legajo y mail),
   cuándo la hizo, si fue a tiempo o atrasada y cuánto, sus archivos, que se
   abren o se bajan con un toque, y la nota y la devolución que le cargó, con
   el botón para ponerlas o cambiarlas en Calificaciones. Es de una columna.
   Sin reglas de negocio. */
import { CircleCheck, Clock, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { PRIMARY } from '@/components/coursework/fields'
import { FileRow } from '@/components/coursework/file-row'
import { gradesHref, submissionStatus, taskGradeLabel } from '@/components/coursework/format'
import { dueTime } from '@/components/dates'
import { StatusPill } from '@/components/ui/status-pill'
import type { SubmissionDetail, TaskGrade } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

/** La nota cargada, si hay, y su devolución. */
function GradeSummary({ grade }: { grade: TaskGrade }) {
  return (
    <div className='flex flex-col gap-1 rounded-[14px] bg-muted px-3 py-2.5'>
      <p className='text-[0.9375rem] font-bold tabular-nums'>{taskGradeLabel(grade)}</p>
      {grade.comment && (
        <p className='text-[0.875rem] leading-relaxed whitespace-pre-wrap text-pretty'>{grade.comment}</p>
      )}
    </div>
  )
}

export function SubmissionDetailCard({ detail }: { detail: SubmissionDetail }) {
  const { student, submission, task } = detail
  // Una tarea sin nota no tiene columna en Calificaciones; un alumno sin cuenta no se puede calificar.
  const gradeHref =
    task.graded && student.personId
      ? gradesHref(task.subjectId, {
          comision: detail.sectionId,
          columna: `tarea:${task.id}`,
          alumno: student.personId
        })
      : null
  return (
    <article aria-labelledby='entrega-alumno' className='flex flex-col gap-4 rounded-[22px] bg-card p-4 shadow-card'>
      <div className='flex flex-col gap-1'>
        <h2 id='entrega-alumno' className='text-xl font-extrabold text-balance'>
          {student.name}
        </h2>
        <p className='text-[0.8125rem] text-muted-foreground'>Legajo {student.legajo}</p>
        <a
          href={`mailto:${student.email}`}
          className='inline-flex min-h-11 w-fit items-center text-[0.8125rem] break-all text-blue underline-offset-2 hover:underline focus-ring'
        >
          {student.email}
        </a>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusPill tone={submission.late ? 'warning' : 'success'}>{submissionStatus(submission)}</StatusPill>
        {!submission.grade && submission.graded && <StatusPill tone='neutral'>Calificada</StatusPill>}
      </div>
      {submission.grade && <GradeSummary grade={submission.grade} />}
      {gradeHref && (
        <Link href={gradeHref} className={cn(PRIMARY, 'w-full justify-center sm:w-fit')}>
          <NotebookPen aria-hidden='true' className='size-5' strokeWidth={1.8} />
          {submission.grade ? 'Cambiar la nota y la devolución' : 'Poner nota y devolución'}
        </Link>
      )}
      <p className='flex items-center gap-2 text-[0.9375rem]'>
        {submission.late ? (
          <Clock aria-hidden='true' className='size-5 flex-none text-kind-recuperatorio' strokeWidth={2} />
        ) : (
          <CircleCheck aria-hidden='true' className='size-5 flex-none text-success' strokeWidth={2} />
        )}
        <span>
          Entregó el <time dateTime={submission.submittedAt}>{dueTime(submission.submittedAt)}</time>.
        </span>
      </p>
      <ul aria-label='Archivos entregados' className='flex flex-col gap-2'>
        {submission.files.map((file) => (
          <li key={file.url}>
            <FileRow file={file} />
          </li>
        ))}
      </ul>
    </article>
  )
}
