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
import { TaskStatus } from '@/components/coursework/task-status'
import { BackLink } from '@/components/spaces/back-link'
import { messageTime } from '@/components/spaces/format'
import { SUBJECT_MAIN, SubjectToolbar } from '@/components/subjects/subject-toolbar'
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

function TaskDetail({ task, now }: { task: TaskView; now: string }) {
  return (
    <article aria-labelledby='tarea-nombre' className='flex flex-col gap-4 rounded-[22px] bg-card p-4 shadow-card'>
      <div className='flex flex-col gap-2'>
        <h2 id='tarea-nombre' className='text-xl font-extrabold text-balance'>
          {task.name}
        </h2>
        <div className='flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground'>
          <OriginBadge origin='hackai' />
          <time dateTime={task.dueAt}>{dueLabel(task, now)}</time>
          <TaskStatus task={task} role={task.role} now={now} />
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
  comision,
  requestedPage
}: {
  personId: string
  taskId: string
  subjectId: string
  comision: string
  requestedPage?: string
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
  return (
    <SubmissionsPanel
      result={result.value}
      subjectId={subjectId}
      comision={comision}
      requestedPage={requestedPage}
      pageHref={(n) => {
        const href = taskHref(subjectId, taskId, comision)
        return n > 1 ? `${href}${href.includes('?') ? '&' : '?'}pagina=${n}` : href
      }}
    />
  )
}

/** El docente ve primero quién entregó, con la tarea al costado; el alumno, la tarea con su entrega al costado. */
function TaskBody({
  task,
  personId,
  comision,
  requestedPage,
  now
}: {
  task: TaskView
  personId: string
  comision: string | undefined
  requestedPage?: string
  now: string
}) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6'>
      {task.canManage ? (
        <>
          <div className='flex min-w-0 flex-col gap-4'>
            {comision && (
              <SubmissionsBlock
                personId={personId}
                taskId={task.id}
                subjectId={task.subjectId}
                comision={comision}
                requestedPage={requestedPage}
              />
            )}
          </div>
          <aside className='flex flex-col gap-4 max-lg:-order-1 lg:sticky lg:top-6'>
            <TaskDetail task={task} now={now} />
            <EditTaskForm task={task} now={now} />
          </aside>
        </>
      ) : (
        <>
          <div className='min-w-0'>
            <TaskDetail task={task} now={now} />
          </div>
          <aside className='flex flex-col gap-4 lg:sticky lg:top-6'>
            <SubmissionPanel task={task} />
          </aside>
        </>
      )}
    </div>
  )
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
      <TaskHeader
        subject={task.subject}
        role={task.role}
        sections={task.canManage && task.sections.length > 1 ? [] : shown}
        backHref={back}
        toolbarBell
      />
      <main className={SUBJECT_MAIN}>
        <SubjectToolbar
          subjectId={subjectId}
          current='tareas'
          viewer={task.role}
          sections={task.canManage ? task.sections : []}
          selectedId={comision ?? ''}
          hrefFor={(sectionId) => taskHref(subjectId, taskId, sectionId)}
        />
        {task.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(task.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        {/* En el celular ya está la flecha del encabezado: dos «Volver» seguidos empujan la entrega debajo de la
            barra de abajo. */}
        <BackLink href={back} className='max-lg:hidden'>
          Volver a las tareas
        </BackLink>
        <TaskBody
          task={task}
          personId={session.personId}
          comision={comision}
          requestedPage={typeof raw.pagina === 'string' ? raw.pagina : undefined}
          now={system().now()}
        />
      </main>
    </>
  )
}
