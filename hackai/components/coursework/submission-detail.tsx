/* Una entrega abierta por el docente: de quién es (nombre, legajo y mail),
   cuándo la hizo, si fue a tiempo o atrasada y cuánto, y sus archivos, que se
   abren o se bajan con un toque. Es de una columna. Sin reglas de negocio. */
import { CircleCheck, Clock } from 'lucide-react'
import { FileRow } from '@/components/coursework/file-row'
import { dueTime, submissionStatus } from '@/components/coursework/format'
import { StatusPill } from '@/components/ui/status-pill'
import type { SubmissionDetail } from '@/lib/core/coursework'

export function SubmissionDetailCard({ detail }: { detail: SubmissionDetail }) {
  const { student, submission } = detail
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
        {submission.graded && <StatusPill tone='neutral'>Calificada</StatusPill>}
      </div>
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
