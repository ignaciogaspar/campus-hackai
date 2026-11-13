/* Una entrega de un alumno, abierta por el docente de su comisión: de quién es,
   cuándo la hizo y sus archivos. Sin reglas de negocio: quién la abre lo decide
   Seguimiento; para cualquier otra persona, la entrega no existe. */
import type { Metadata } from 'next'
import { cache } from 'react'
import { taskHref, tasksHref } from '@/components/coursework/format'
import { SubmissionDetailCard } from '@/components/coursework/submission-detail'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { BackLink } from '@/components/spaces/back-link'
import { messageTime } from '@/components/spaces/format'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { StaleNotice } from '@/components/ui/states'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

type Params = Promise<{ subjectId: string; taskId: string; submissionId: string }>

const read = cache((personId: string, submissionId: string) => system().coursework.submission(personId, submissionId))

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const session = await getSession()
  const { submissionId } = await params
  const opened = session ? await read(session.personId, submissionId) : null
  return { title: `${opened?.ok ? opened.value.student.name : 'Entrega'} · Campus HackAI` }
}

export default async function SubmissionPage({ params }: { params: Params }) {
  const session = await requireSession('profesor')
  const { subjectId, taskId, submissionId } = await params
  const result = await read(session.personId, submissionId)
  // Una entrega por la ruta de otra tarea o de otra materia, armada a mano, tampoco existe.
  const detail =
    result.ok && result.value.task.id === taskId && result.value.task.subjectId === subjectId ? result.value : null

  if (!detail) {
    return (
      <TaskError
        error={result.ok ? 'entrega-desconocida' : result.error}
        retryHref={taskHref(subjectId, taskId)}
        backHref={tasksHref(subjectId)}
        backLabel='Volver a las tareas'
      />
    )
  }

  const back = taskHref(subjectId, taskId, detail.sectionId)
  const section = detail.task.sections.find((s) => s.sectionId === detail.sectionId)
  return (
    <>
      <TaskHeader
        subject={detail.task.subject}
        role={detail.task.role}
        sections={section ? [section] : []}
        backHref={back}
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs
          subjectId={subjectId}
          current='tareas'
          comision={detail.task.sections.length > 1 ? detail.sectionId : undefined}
          role={detail.task.role}
        />
        {detail.staleSince && (
          <StaleNotice>
            El SIU no responde. Los alumnos salen de lo que trajimos el {messageTime(detail.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        <BackLink href={back}>Volver a la tarea</BackLink>
        <div className='flex w-full max-w-3xl flex-col gap-4'>
          <SubmissionDetailCard detail={detail} />
        </div>
      </main>
    </>
  )
}
