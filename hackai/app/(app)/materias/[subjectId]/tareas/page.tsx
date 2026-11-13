/* Las tareas de la materia, pestaña del espacio: la lista de la comisión
   elegida, por fecha límite. El docente elige la comisión en `?comision=` (si
   dicta varias) y crea una tarea nueva; el alumno ve las de su comisión. Sin
   reglas de negocio: qué tareas ve cada uno lo decide Seguimiento.

   Esta ruta no lleva loading.tsx: cambiar de comisión es la misma ruta con otro
   `?comision=`, y con un estado de carga de la ruta la pantalla a veces no se
   actualizaba (ver el espacio de la materia). */
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { newTaskHref, tasksHref } from '@/components/coursework/format'
import { SectionPicker } from '@/components/coursework/section-picker'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { TaskList } from '@/components/coursework/task-list'
import { messageTime } from '@/components/spaces/format'
import { SubjectTabs } from '@/components/subjects/subject-tabs'
import { buttonVariants } from '@/components/ui/button'
import { StaleNotice } from '@/components/ui/states'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import { cn } from '@/lib/utils'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/* Lo comparten generateMetadata y la página en el mismo pedido, así se leen una sola vez. */
const read = cache((personId: string, subjectId: string, comision: string | undefined) =>
  system().coursework.tasksOf(personId, subjectId, comision)
)

function comisionOf(raw: Record<string, string | string[] | undefined>): string | undefined {
  return typeof raw.comision === 'string' && raw.comision !== '' ? raw.comision : undefined
}

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Params
  searchParams: SearchParams
}): Promise<Metadata> {
  const session = await getSession()
  const { subjectId } = await params
  const opened = session ? await read(session.personId, subjectId, comisionOf(await searchParams)) : null
  return { title: `Tareas · ${opened?.ok ? opened.value.subject.subjectName : 'Materia'} · Campus HackAI` }
}

export default async function TasksPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const session = await requireSession()
  const { subjectId } = await params
  const comision = comisionOf(await searchParams)

  const result = await read(session.personId, subjectId, comision)
  if (!result.ok) return <TaskError error={result.error} retryHref={tasksHref(subjectId, comision)} />
  const list = result.value
  const selected = list.sections.find((s) => s.sectionId === list.sectionId)

  return (
    <>
      <TaskHeader subject={list.subject} role={list.role} sections={selected ? [selected] : []} backHref='/materias' />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        <SubjectTabs subjectId={subjectId} current='tareas' comision={list.sectionId} />
        {list.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(list.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        {list.role === 'profesor' && (
          <SectionPicker subjectId={subjectId} sections={list.sections} selectedId={list.sectionId} />
        )}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 className='text-lg font-extrabold'>Tareas</h2>
          {list.role === 'profesor' && (
            <Link
              href={newTaskHref(subjectId, list.sectionId)}
              className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}
            >
              <Plus aria-hidden='true' className='size-5' strokeWidth={2} />
              Nueva tarea
            </Link>
          )}
        </div>
        <div className='w-full max-w-3xl'>
          <TaskList tasks={list.tasks} role={list.role} comision={list.sectionId} />
        </div>
      </main>
    </>
  )
}
