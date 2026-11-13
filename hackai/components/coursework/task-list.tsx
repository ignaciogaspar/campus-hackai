/* Las tareas de una comisión, una fila por tarea: nombre, comienzo de la
   consigna, cuándo vence y si lleva nota. Cada fila lleva a la tarea. Es la
   misma lista para el docente y para el alumno. El docente además ve para qué
   comisiones es cada una y cuántos entregaron y falta corregir, con si sigue
   vigente en la línea de abajo; el alumno, cómo está su entrega. En el celular
   lo de la derecha baja a la línea de abajo, para no quitarle lugar al nombre. */
import { ClipboardList } from 'lucide-react'
import { dueLabel, progressLabel, sectionsLabel, taskHref } from '@/components/coursework/format'
import { TaskStatus } from '@/components/coursework/task-status'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { Task, TaskProgress } from '@/lib/core/coursework'
import type { Role } from '@/lib/core/people'

/** Al docente: cuántos entregaron y cuántos falta corregir, resaltado si hay algo para corregir. */
function Progress({ progress, className }: { progress: TaskProgress; className?: string }) {
  return (
    <StatusPill tone={progress.ungraded > 0 ? 'warning' : 'neutral'} className={className}>
      {progressLabel(progress)}
    </StatusPill>
  )
}

function TaskRow({
  task,
  role,
  comision,
  fresh,
  now
}: {
  task: Task
  role: Role
  comision: string
  fresh: boolean
  now: string
}) {
  const teacher = role === 'profesor'
  const sharedWith = teacher && task.sections.length > 1
  const { progress } = task
  return (
    <ListItem
      href={taskHref(task.subjectId, task.id, comision)}
      className={fresh ? 'bg-success-background/60 hover:bg-success-background' : undefined}
      start={
        <span className='grid size-10 flex-none place-items-center rounded-full bg-accent text-blue-light'>
          <ClipboardList aria-hidden='true' className='size-5' strokeWidth={1.8} />
        </span>
      }
      title={task.name}
      description={task.instructions || undefined}
      meta={
        <>
          {teacher && progress && <Progress progress={progress} className='sm:hidden' />}
          <TaskStatus task={task} role={role} now={now} className={teacher ? undefined : 'sm:hidden'} />
          <OriginBadge origin='hackai' />
          <time dateTime={task.dueAt}>{dueLabel(task, now)}</time>
          {!task.graded && <span>· Sin nota</span>}
          {fresh && <span className='font-semibold text-success'>· Recién publicada</span>}
          {sharedWith && <span>· {sectionsLabel(task.sections.map((s) => s.name))}</span>}
        </>
      }
      end={
        teacher ? (
          progress && <Progress progress={progress} className='max-sm:hidden' />
        ) : (
          <TaskStatus task={task} role={role} now={now} className='max-sm:hidden' />
        )
      }
    />
  )
}

export function TaskList({
  tasks,
  role,
  comision,
  createdId,
  now
}: {
  tasks: Task[]
  role: Role
  comision: string
  /** ISO: la hora del reloj de la app, para decir cuánto falta. */
  now: string
  /** La tarea que se acaba de crear, que se distingue de las demás. */
  createdId?: string
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title='Todavía no hay tareas de HackAI'>
        {role === 'profesor'
          ? 'Cuando crees una tarea para esta comisión, aparece acá y la ven sus alumnos.'
          : 'Cuando tu docente cree una tarea en HackAI para tu comisión, aparece acá con su fecha límite.'}
      </EmptyState>
    )
  }
  return (
    <Card>
      <List aria-label='Tareas'>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} role={role} comision={comision} fresh={task.id === createdId} now={now} />
        ))}
      </List>
    </Card>
  )
}
