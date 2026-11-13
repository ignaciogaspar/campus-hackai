/* Una tarea: su consigna, el archivo si hay, la fecha límite, si lleva nota y
   para qué comisiones es. El docente de sus comisiones además la edita (nombre,
   consigna y fecha límite). Sin reglas de negocio: quién ve y quién edita lo
   decide Seguimiento; una tarea de otra comisión es, acá, una tarea que no
   existe. El alumno además entrega ahí mismo y ve cuándo entregó. */
import type { Metadata } from 'next'
import { cache } from 'react'
import { FileRow } from '@/components/coursework/file-row'
import { dueLabel, sectionsLabel, taskHref, tasksHref } from '@/components/coursework/format'
import { SubmissionPanel } from '@/components/coursework/submission-panel'
import { SubmissionsPanel } from '@/components/coursework/submissions-panel'
import { TaskError } from '@/components/coursework/task-error'
import { EditTaskForm } from '@/components/coursework/task-form'
import { TaskHeader } from '@/components/coursework/task-header'
import { BackLink } from '@/components/spaces/back-link'
import { messageTime } from '@/components/spaces/format'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { OriginBadge } from '@/components/ui/origin-badge'
import { ErrorNotice, StaleNotice } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { TaskView } from '@/lib/core/coursework'

type Params = Promise<{ subjectId: string; taskId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

const read = cache((personId: string, taskId: string) => system().coursework.task(personId, taskId))

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const session = await getSession()
  const { taskId } = await params
  const opened = session ? await read(session.personId, taskId) : null
  return { title: `${opened?.ok ? opened.value.name : 'Tarea'} · Campus HackAI` }
}

function TaskDetail({ task }: { task: TaskView }) {
  return (
    <article aria-labelledby='tarea-nombre' className='flex flex-col gap-4 rounded-[22px] bg-card p-4 shadow-card'>
      <div className='flex flex-col gap-2'>
        <h2 id='tarea-nombre' className='text-xl font-extrabold text-balance'>
          {task.name}
        </h2>
        <div className='flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground'>
          <OriginBadge origin='hackai' />
          <time dateTime={task.dueAt}>{dueLabel(task)}</time>
          {task.past ? <StatusPill tone='neutral'>Venció</StatusPill> : <StatusPill tone='info'>Vigente</StatusPill>}
          <StatusPill tone='neutral'>{task.graded ? 'Lleva nota' : 'Sin nota'}</StatusPill>
        </div>
        {task.canManage && (
          <p className='text-[0.8125rem] text-muted-foreground'>
            Para {sectionsLabel(task.sections.map((s) => s.name))}.
          </p>
        )}
      </div>
      {task.instructions ? (
        <p className='text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-pretty'>{task.instructions}</p>
      ) : (
        <p className='text-[0.9375rem] text-muted-foreground'>Esta tarea no tiene consigna escrita.</p>
      )}
      {task.file && <FileRow file={task.file} />}
    </article>
  )
}

/** Quién entregó en la comisión elegida, o por qué no se pudo leer. */
async function SubmissionsBlock({
  personId,
  taskId,
  subjectId,
  comision
}: {
  personId: string
  taskId: string
  subjectId: string
  comision: string
}) {
  const result = await system().coursework.submissions(personId, taskId, comision)
  if (!result.ok) {
    return (
      <ErrorNotice>
        {result.error === 'falla-externa'
          ? 'No pudimos traer los alumnos porque el SIU no responde. Probá de nuevo en un rato.'
          : 'No podés ver quién entregó en esta comisión.'}
      </ErrorNotice>
    )
  }
  return <SubmissionsPanel result={result.value} subjectId={subjectId} comision={comision} />
}

export default async function TaskPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession()
  const { subjectId, taskId } = await params
  const raw = await searchParams
  const result = await read(session.personId, taskId)
  // Una tarea de otra materia, por una ruta armada a mano, tampoco existe.
  const task = result.ok && result.value.subjectId === subjectId ? result.value : null
  const comision =
    typeof raw.comision === 'string' && task?.sections.some((s) => s.sectionId === raw.comision)
      ? raw.comision
      : task?.sections[0]?.sectionId
  const back = tasksHref(subjectId, comision)

  if (!task) {
    const error = result.ok ? 'tarea-desconocida' : result.error
    return (
      <TaskError
        error={error}
        retryHref={taskHref(subjectId, taskId)}
        backHref={tasksHref(subjectId)}
        backLabel='Volver a las tareas'
      />
    )
  }

  const shown = task.sections.filter((s) => s.sectionId === comision)
  return (
    <>
      <TaskHeader subject={task.subject} role={task.role} sections={shown} backHref={back} />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs
          subjectId={subjectId}
          current='tareas'
          comision={task.sections.length > 1 ? comision : undefined}
          role={task.role}
        />
        {task.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(task.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        <BackLink href={back}>Volver a las tareas</BackLink>
        <div className='flex w-full max-w-3xl flex-col gap-4'>
          <TaskDetail task={task} />
          {!task.canManage && <SubmissionPanel task={task} />}
          {task.canManage && comision && (
            <SubmissionsBlock personId={session.personId} taskId={taskId} subjectId={subjectId} comision={comision} />
          )}
          {task.canManage && <EditTaskForm task={task} />}
        </div>
      </main>
    </>
  )
}
