/* Quién entregó una tarea, para el docente: el resumen (cuántos entregaron,
   cuántos tarde, cuántos faltan) y una fila por alumno de la comisión con su
   estado y la nota que le cargó. Las filas con entrega abren la entrega; las
   demás, si la tarea lleva nota, llevan a ponerle la nota en Calificaciones. En
   el celular es una columna de filas de 56 px o más; el estado va a la derecha
   de cada nombre. Sin reglas de negocio: el estado lo decide Seguimiento. */
import { Users } from 'lucide-react'
import {
  countsLabel,
  gradesHref,
  pageOf,
  rowStatus,
  submissionHref,
  taskGradeLabel
} from '@/components/coursework/format'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { SubmissionRow, TaskSubmissions } from '@/lib/core/coursework'

const TONES = { entregada: 'success', atrasada: 'warning', 'sin-entrega': 'neutral' } as const

export function SubmissionPill({ row }: { row: Pick<SubmissionRow, 'state' | 'submission'> }) {
  return <StatusPill tone={TONES[row.state]}>{rowStatus(row)}</StatusPill>
}

function StudentRow({
  row,
  hrefFor,
  gradeHrefFor
}: {
  row: SubmissionRow
  hrefFor: (submissionId: string) => string
  /** A dónde lleva una fila sin entrega para ponerle la nota; `null` si no se puede (tarea sin nota, sin cuenta). */
  gradeHrefFor: (studentId: string | null) => string | null
}) {
  const { student, submission, grade } = row
  return (
    <ListItem
      href={submission ? hrefFor(submission.id) : (gradeHrefFor(student.personId) ?? undefined)}
      title={student.name}
      description={`Legajo ${student.legajo}`}
      end={
        <>
          <SubmissionPill row={row} />
          {grade && <span className='text-xs font-semibold text-ink tabular-nums'>{taskGradeLabel(grade)}</span>}
        </>
      }
    />
  )
}

export function SubmissionsPanel({
  result,
  subjectId,
  comision,
  requestedPage,
  pageHref
}: {
  result: TaskSubmissions
  subjectId: string
  comision: string
  /** `?pagina=`, sin validar. */
  requestedPage?: string
  pageHref: (page: number) => string
}) {
  const { rows, counts, task } = result
  const page = pageOf(rows, requestedPage)
  return (
    <section aria-labelledby='entregas' className='flex flex-col gap-2'>
      <div className='flex flex-col gap-0.5 px-1'>
        <h2 id='entregas' className='text-lg font-extrabold'>
          Entregas
        </h2>
        {rows.length > 0 && <p className='text-[0.8125rem] text-muted-foreground'>{countsLabel(counts)}</p>}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title='Todavía no hay alumnos inscriptos'>
          Cuando se inscriban a la comisión, vas a ver acá quién entregó.
        </EmptyState>
      ) : (
        <>
          <Card>
            <List aria-label='Alumnos de la comisión'>
              {page.items.map((row) => (
                <StudentRow
                  key={row.student.legajo}
                  row={row}
                  hrefFor={(submissionId) => submissionHref(subjectId, task.id, submissionId, comision)}
                  gradeHrefFor={(studentId) =>
                    task.graded && studentId
                      ? gradesHref(subjectId, { comision, columna: `tarea:${task.id}`, alumno: studentId })
                      : null
                  }
                />
              ))}
            </List>
          </Card>
          <Pagination page={page.page} pages={page.pages} hrefFor={pageHref} label='Páginas de alumnos' />
        </>
      )}
    </section>
  )
}
