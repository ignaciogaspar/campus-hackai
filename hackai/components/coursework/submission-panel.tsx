/* La entrega del alumno en la pantalla de una tarea: qué entregó y cuándo, si
   fue a tiempo o atrasada y cuánto, la nota y la devolución cuando el docente
   las publica, y el formulario para entregar o para reemplazar la entrega
   hasta que el docente la califique. Es de una columna y con botones de toque
   cómodo, para entregar desde el celular. Sin reglas de negocio: si se acepta
   o no, y qué nota ve, lo decide Seguimiento. */
import { CircleCheck, Clock, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { submitTask } from '@/app/actions/coursework'
import { FileRow } from '@/components/coursework/file-row'
import { FilesField } from '@/components/coursework/files-field'
import { gradeInputValue, subjectNotesHref, submissionStatus } from '@/components/coursework/format'
import { dueTime } from '@/components/dates'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import type { Submission, Task, TaskGrade } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

function SubmissionSummary({ submission }: { submission: Submission }) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusPill tone={submission.late ? 'warning' : 'success'}>{submissionStatus(submission)}</StatusPill>
        {/* Calificada sin publicar: el alumno todavía no ve la nota, así que no se la anuncia. */}
        {submission.grade ? (
          <StatusPill tone='success'>Con nota</StatusPill>
        ) : (
          submission.graded && <StatusPill tone='info'>Corrigiendo</StatusPill>
        )}
      </div>
      <p className='flex items-center gap-2 text-[0.9375rem]'>
        {submission.late ? (
          <Clock aria-hidden='true' className='size-5 flex-none text-kind-recuperatorio' strokeWidth={1.8} />
        ) : (
          <CircleCheck aria-hidden='true' className='size-5 flex-none text-success' strokeWidth={1.8} />
        )}
        <span>
          Entregaste el <time dateTime={submission.submittedAt}>{dueTime(submission.submittedAt)}</time>.
        </span>
      </p>
      <ul aria-label='Archivos que entregaste' className='flex flex-col gap-2'>
        {submission.files.map((file) => (
          <li key={file.url}>
            <FileRow file={file} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** La nota publicada y la devolución del docente. */
function GradeBox({ grade }: { grade: TaskGrade }) {
  return (
    <div className='flex flex-col gap-1.5 rounded-[14px] bg-success-background px-3 py-2.5'>
      <p className='flex items-baseline gap-2'>
        <span className='text-[0.8125rem] font-semibold text-success'>Tu nota</span>
        <span className='text-2xl font-extrabold text-ink tabular-nums'>
          {grade.absent ? 'Ausente' : gradeInputValue(grade.value)}
        </span>
      </p>
      {grade.comment && (
        <div className='flex flex-col gap-0.5'>
          <p className='text-[0.8125rem] font-semibold text-muted-foreground'>Devolución de tu docente</p>
          <p className='text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-pretty'>{grade.comment}</p>
        </div>
      )}
    </div>
  )
}

/** Dónde va a ver la nota: acá y en Notas. Una tarea sin nota no dice nada. */
function GradeNote({ task }: { task: Task }) {
  if (!task.graded) return null
  const text = task.submission?.grade
    ? 'También la ves en Notas, con las demás de la materia.'
    : 'Cuando tu docente publique la nota, va a aparecer acá y en Notas.'
  return (
    <p className='flex flex-col items-start gap-0.5 text-[0.8125rem] text-muted-foreground'>
      {text}
      <Link
        href={subjectNotesHref(task.subjectId)}
        className='inline-flex min-h-11 items-center gap-1.5 rounded-lg font-bold text-blue hover:underline focus-ring'
      >
        <NotebookPen aria-hidden='true' className='size-4' strokeWidth={1.8} />
        Ver en Notas
      </Link>
    </p>
  )
}

function SubmitForm({ task, replacing }: { task: Task; replacing: boolean }) {
  return (
    // El resultado va arriba, junto a lo entregado: debajo del archivo y del botón queda fuera de la pantalla. Sin la
    // validación del navegador: si no eligió archivos, el aviso es el de Seguimiento, en voseo y junto al campo.
    <ActionForm action={submitTask} resetOnSuccess feedbackFirst noValidate className='flex flex-col gap-3'>
      <input type='hidden' name='taskId' value={task.id} />
      <FilesField replacing={replacing} />
      <SubmitButton
        // Con la entrega hecha, reemplazarla es lo secundario.
        className={cn(
          buttonVariants({ variant: replacing ? 'outline' : 'default' }),
          'min-h-11 w-full scroll-mb-4 rounded-[10px] px-4 text-[0.9375rem] font-bold sm:w-fit'
        )}
      >
        {replacing ? 'Reemplazar la entrega' : 'Entregar'}
      </SubmitButton>
    </ActionForm>
  )
}

export function SubmissionPanel({ task }: { task: Task }) {
  const { submission } = task
  const closed = submission?.graded ?? false
  return (
    <section aria-labelledby='entrega' className='flex flex-col gap-4 rounded-[22px] bg-card p-4 shadow-card'>
      <h2 id='entrega' className='text-lg font-extrabold'>
        Tu entrega
      </h2>
      {submission ? (
        <SubmissionSummary submission={submission} />
      ) : (
        <p className='text-[0.9375rem] text-muted-foreground'>
          {task.past
            ? 'Ya venció, pero podés entregar igual: queda marcada como atrasada.'
            : 'Todavía no entregaste. Podés subir uno o más archivos.'}
        </p>
      )}
      {submission?.grade && <GradeBox grade={submission.grade} />}
      {closed ? (
        <p className='text-[0.8125rem] text-muted-foreground'>
          {submission?.grade
            ? 'Ya tiene nota, así que no se puede reemplazar.'
            : 'Tu docente la está corrigiendo, así que ya no se puede reemplazar.'}
        </p>
      ) : (
        <SubmitForm task={task} replacing={submission !== null} />
      )}
      <GradeNote task={task} />
    </section>
  )
}
