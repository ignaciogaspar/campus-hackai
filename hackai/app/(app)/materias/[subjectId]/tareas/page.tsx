/* Las tareas de la materia, pestaña del espacio: la lista de la comisión
   elegida, por fecha límite. El docente elige la comisión en `?comision=` (si
   dicta varias) y crea una tarea nueva; el alumno ve las de su comisión. Arriba,
   una nota nombra las entregas del aula de Moodle, que no están en la lista. Sin
   reglas de negocio: qué tareas ve cada uno lo decide Seguimiento.

   Esta ruta no lleva loading.tsx: cambiar de comisión es la misma ruta con otro
   `?comision=`, y con un estado de carga de la ruta la pantalla a veces no se
   actualizaba (ver el espacio de la materia). */
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { CreatedNotice } from '@/components/coursework/created-notice'
import { PRIMARY } from '@/components/coursework/fields'
import { newTaskHref, pageOf, sectionsLabel, tasksHref } from '@/components/coursework/format'
import { MoodleNote } from '@/components/coursework/moodle-note'
import { TaskError } from '@/components/coursework/task-error'
import { TaskHeader } from '@/components/coursework/task-header'
import { TaskList } from '@/components/coursework/task-list'
import { messageTime } from '@/components/spaces/format'
import { SUBJECT_MAIN, SubjectToolbar } from '@/components/subjects/subject-toolbar'
import { Pagination } from '@/components/ui/pagination'
import { StaleNotice } from '@/components/ui/states'
import { getSession, requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { MySubject, MySubjects } from '@/lib/core/studies'

type Params = Promise<{ subjectId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/* Lo comparten generateMetadata y la página en el mismo pedido, así se leen una sola vez. */
const read = cache((personId: string, subjectId: string, comision: string | undefined) =>
  system().coursework.tasksOf(personId, subjectId, comision)
)

/** La materia de la persona en esa comisión (o en otra de la misma materia), con su aula y sus entregas de Moodle. */
function subjectOf(subjects: MySubjects | null, subjectId: string, sectionId: string): MySubject | undefined {
  const all = subjects ? [...subjects.current, ...subjects.archived] : []
  return (
    all.find((s) => s.subjectId === subjectId && s.sectionId === sectionId) ??
    all.find((s) => s.subjectId === subjectId)
  )
}

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
  const raw = await searchParams
  const comision = comisionOf(raw)

  // El aula de Moodle de la materia sale de Cursada; si no responde, la lista sale igual, sin la nota del aula.
  const [result, subjects] = await Promise.all([
    read(session.personId, subjectId, comision),
    system().studies.subjectsOf(session.personId)
  ])
  if (!result.ok) return <TaskError error={result.error} retryHref={tasksHref(subjectId, comision)} />
  const list = result.value
  const selected = list.sections.find((s) => s.sectionId === list.sectionId)
  const several = list.sections.length > 1
  const page = pageOf(list.tasks, typeof raw.pagina === 'string' ? raw.pagina : undefined)
  const teacher = list.role === 'profesor'
  // La que se acaba de crear (createTask lleva acá con `?creada=`), si es de esta comisión.
  const created = teacher && typeof raw.creada === 'string' ? list.tasks.find((t) => t.id === raw.creada) : undefined
  const mine = subjectOf(subjects.ok ? subjects.value.data : null, subjectId, list.sectionId)
  const now = system().now()

  return (
    <>
      <TaskHeader
        subject={list.subject}
        role={list.role}
        sections={selected && !(teacher && several) ? [selected] : []}
        backHref='/materias'
        toolbarBell
      />
      <main className={SUBJECT_MAIN}>
        <SubjectToolbar
          subjectId={subjectId}
          current='tareas'
          viewer={list.role}
          sections={list.sections}
          selectedId={list.sectionId}
          hrefFor={(sectionId) => tasksHref(subjectId, sectionId)}
        />
        {list.staleSince && (
          <StaleNotice>
            El SIU no responde. Las comisiones salen de lo que trajimos el {messageTime(list.staleSince)}: puede estar
            desactualizado.
          </StaleNotice>
        )}
        {created && <CreatedNotice name={created.name} audience={sectionsLabel(created.sections.map((s) => s.name))} />}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 className='text-lg font-extrabold'>
            Tareas
            {list.tasks.length > 0 && (
              <span className='ml-2 text-[0.875rem] font-semibold text-muted-foreground tabular-nums'>
                {list.tasks.length}
              </span>
            )}
          </h2>
          {teacher && (
            <Link href={newTaskHref(subjectId, list.sectionId)} className={PRIMARY}>
              <Plus aria-hidden='true' className='size-5' strokeWidth={2} />
              Nueva tarea
            </Link>
          )}
        </div>
        <MoodleNote
          role={list.role}
          subjectName={list.subject.subjectName}
          classroom={mine?.classrooms[0] ?? null}
          assignments={mine?.assignments ?? []}
          now={now}
        />
        <TaskList tasks={page.items} role={list.role} comision={list.sectionId} createdId={created?.id} now={now} />
        <Pagination
          page={page.page}
          pages={page.pages}
          hrefFor={(n) => {
            const href = tasksHref(subjectId, several ? list.sectionId : undefined)
            return n > 1 ? `${href}${href.includes('?') ? '&' : '?'}pagina=${n}` : href
          }}
          label='Páginas de tareas'
        />
      </main>
    </>
  )
}
