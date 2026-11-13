/* Tarea nueva, para el docente: el formulario con las comisiones vigentes que
   dicta en la materia y la elegida marcada. Un alumno vuelve a la lista de
   tareas. */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { tasksHref } from '@/components/coursework/format'
import { TaskError } from '@/components/coursework/task-error'
import { NewTaskForm } from '@/components/coursework/task-form'
import { TaskHeader } from '@/components/coursework/task-header'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata: Metadata = { title: 'Tarea nueva · Campus HackAI' }

export default async function NewTaskPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession('profesor')
  const { subjectId } = await params
  const raw = await searchParams
  const comision = typeof raw.comision === 'string' && raw.comision !== '' ? raw.comision : undefined

  const result = await system().coursework.tasksOf(session.personId, subjectId, comision)
  if (!result.ok) return <TaskError error={result.error} retryHref={`/materias/${subjectId}/tareas/nueva`} />
  const list = result.value
  if (list.role !== 'profesor') redirect(tasksHref(subjectId))
  const back = tasksHref(subjectId, list.sectionId)

  return (
    <>
      <TaskHeader subject={list.subject} role={list.role} sections={[]} backHref={back} />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs subjectId={subjectId} current='tareas' comision={list.sectionId} />
        <div className='w-full max-w-3xl'>
          <NewTaskForm subjectId={subjectId} sections={list.sections} selectedId={list.sectionId} cancelHref={back} />
        </div>
      </main>
    </>
  )
}
