/* El estado de una tarea como chip, el mismo en la lista y en la tarea: al
   docente, si sigue vigente o venció; al alumno, cómo está su entrega («Sin
   entregar · vence en 3 días», «Atrasada, podés entregarla igual»,
   «Entregada»). El texto sale de components/coursework/format.ts. */
import { taskStatus } from '@/components/coursework/format'
import { StatusPill } from '@/components/ui/status-pill'
import type { Task } from '@/lib/core/coursework'
import type { Role } from '@/lib/core/people'

export function TaskStatus({
  task,
  role,
  now,
  className
}: {
  task: Task
  role: Role
  /** ISO: la hora del reloj de la app, para decir cuánto falta. */
  now: string
  className?: string
}) {
  const { label, tone } = taskStatus(task, role, now)
  return (
    <StatusPill tone={tone} className={className}>
      {label}
    </StatusPill>
  )
}
