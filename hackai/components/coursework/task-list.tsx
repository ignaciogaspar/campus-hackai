/* Las tareas de una comisión, una fila por tarea: nombre, comienzo de la
   consigna, cuándo vence y si lleva nota. Cada fila lleva a la tarea. Es la
   misma lista para el docente y para el alumno; el docente además ve para qué
   comisiones es cada una, y el alumno si ya entregó y si fue tarde. */
import { ClipboardList } from 'lucide-react'
import { dueLabel, sectionsLabel, submissionStatus, taskHref } from '@/components/coursework/format'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { Task } from '@/lib/core/coursework'
import type { Role } from '@/lib/core/people'

/** El estado que ve quien mira: el alumno que ya entregó, su entrega (y si fue tarde); si no, si venció. */
function TaskStatus({ task }: { task: Task }) {
  if (task.submission) {
    return (
      <StatusPill tone={task.submission.late ? 'warning' : 'success'}>{submissionStatus(task.submission)}</StatusPill>
    )
  }
  return task.past ? <StatusPill tone='neutral'>Venció</StatusPill> : <StatusPill tone='info'>Vigente</StatusPill>
}

function TaskRow({ task, role, comision }: { task: Task; role: Role; comision: string }) {
  const sharedWith = role === 'profesor' && task.sections.length > 1
  return (
    <ListItem
      href={taskHref(task.subjectId, task.id, comision)}
      start={
        <span className='grid size-10 flex-none place-items-center rounded-full bg-accent text-blue-light'>
          <ClipboardList aria-hidden='true' className='size-5' strokeWidth={1.8} />
        </span>
      }
      title={task.name}
      description={task.instructions || undefined}
      meta={
        <>
          <OriginBadge origin='hackai' />
          <time dateTime={task.dueAt}>{dueLabel(task)}</time>
          {!task.graded && <span>· Sin nota</span>}
          {sharedWith && <span>· {sectionsLabel(task.sections.map((s) => s.name))}</span>}
        </>
      }
      end={<TaskStatus task={task} />}
    />
  )
}

export function TaskList({ tasks, role, comision }: { tasks: Task[]; role: Role; comision: string }) {
  if (tasks.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title='Todavía no hay tareas'>
        {role === 'profesor'
          ? 'Cuando crees una tarea para esta comisión, aparece acá y la ven sus alumnos.'
          : 'Cuando tu docente cree una tarea para tu comisión, aparece acá con su fecha límite.'}
      </EmptyState>
    )
  }
  return (
    <Card>
      <List aria-label='Tareas'>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} role={role} comision={comision} />
        ))}
      </List>
    </Card>
  )
}
