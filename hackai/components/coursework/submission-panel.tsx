/* La entrega del alumno en la pantalla de una tarea: qué entregó y cuándo, si
   fue a tiempo o atrasada y cuánto, y el formulario para entregar o para
   reemplazar la entrega hasta que el docente la califique. Es de una columna y
   con botones de toque cómodo, para entregar desde el celular. Sin reglas de
   negocio: si se acepta o no lo decide Seguimiento. */
import { CircleCheck, Clock } from 'lucide-react'
import { submitTask } from '@/app/actions/coursework'
import { FileRow } from '@/components/coursework/file-row'
import { FilesField } from '@/components/coursework/files-field'
import { submissionStatus } from '@/components/coursework/format'
import { dueTime } from '@/components/dates'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import type { Submission, Task } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

function SubmissionSummary({ submission }: { submission: Submission }) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <StatusPill tone={submission.late ? 'warning' : 'success'}>{submissionStatus(submission)}</StatusPill>
        {submission.graded && <StatusPill tone='neutral'>Calificada</StatusPill>}
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

function SubmitForm({ task, replacing }: { task: Task; replacing: boolean }) {
  return (
    // Sin la validación del navegador: si no eligió archivos, el aviso es el de Seguimiento, en voseo y junto al campo.
    <ActionForm action={submitTask} resetOnSuccess noValidate className='flex flex-col gap-3'>
      <input type='hidden' name='taskId' value={task.id} />
      <FilesField replacing={replacing} />
      <SubmitButton
        className={cn(buttonVariants(), 'min-h-11 w-full rounded-[10px] px-4 text-[0.9375rem] font-bold sm:w-fit')}
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
      {closed ? (
        <p className='text-[0.8125rem] text-muted-foreground'>
          Tu docente ya la calificó, así que no se puede reemplazar.
        </p>
      ) : (
        <SubmitForm task={task} replacing={submission !== null} />
      )}
    </section>
  )
}
