/* Calificaciones de una comisión, pensadas primero para el celular: una
   columna a la vez. Arriba se elige la columna (una por tarea con nota y una
   por parcial del SIU), después se ve su estado y se publica, y debajo hay una
   fila por alumno con su nota. Tocar un alumno abre su nota y comentario.
   Sin tablas anchas: la misma lista sirve en la compu. */
import { ClipboardList, ClipboardPaste, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { publishColumn } from '@/app/actions/coursework'
import { GradeBadge } from '@/components/academic/grade-badge'
import { dueTime, gradesHref, pasteGradesHref } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { GradebookStudent, GradeCell, GradeColumn } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

export function NoColumns() {
  return (
    <EmptyState icon={ClipboardList} title='Todavía no hay columnas'>
      Cuando crees una tarea con nota, o el SIU tenga parciales para esta comisión, aparecen acá para cargar las notas.
    </EmptyState>
  )
}

/** Las columnas de la comisión como enlaces: la elegida va en `?columna=`. */
export function ColumnPicker({
  subjectId,
  comision,
  columns,
  selectedId
}: {
  subjectId: string
  comision?: string
  columns: GradeColumn[]
  selectedId: string
}) {
  return (
    <nav aria-label='Columna' className='flex flex-col gap-1.5'>
      <span aria-hidden='true' className='px-1 text-xs font-semibold text-muted-foreground'>
        Columna
      </span>
      <div className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto lg:max-w-3xl')}>
        {columns.map((c) => (
          <Link
            key={c.id}
            href={gradesHref(subjectId, { comision, columna: c.id })}
            aria-current={c.id === selectedId ? 'page' : undefined}
            className={cn(railItem({ size: 'sm' }), 'min-h-11 max-w-[11rem] flex-none px-3 max-sm:px-2.5')}
          >
            <span className='truncate'>{c.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

function publishLabel(column: GradeColumn): string {
  if (column.publishedAt === null) return 'Publicar las notas'
  return column.unpublished === 1 ? 'Publicar la nota nueva' : `Publicar las ${column.unpublished} notas nuevas`
}

/** La columna elegida: de dónde viene, su estado y el botón para publicar. */
export function ColumnSummary({
  subjectId,
  sectionId,
  column,
  students
}: {
  subjectId: string
  sectionId: string
  column: GradeColumn
  students: number
}) {
  const everythingPublished = column.graded > 0 && column.unpublished === 0
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <div className='flex flex-col gap-1.5'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='text-lg font-extrabold text-balance'>{column.name}</h2>
          <StatusPill tone={column.publishedAt ? 'success' : 'neutral'}>
            {column.publishedAt ? 'Publicada' : 'Sin publicar'}
          </StatusPill>
        </div>
        <p className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
          <OriginBadge origin={column.kind === 'tarea' ? 'hackai' : 'siu'} />
          <time dateTime={column.date}>{dueTime(column.date)}</time>
        </p>
        <p className='text-[0.8125rem] text-ink'>
          {column.graded} de {students} con nota
          {column.unpublished > 0 && column.graded > 0 ? ` · ${column.unpublished} sin publicar` : ''}
        </p>
      </div>
      <ActionForm action={publishColumn} className='flex flex-col gap-2'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='columnId' value={column.id} />
        <div className='flex flex-wrap gap-2'>
          <SubmitButton
            disabled={column.graded === 0 || everythingPublished}
            className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}
          >
            {everythingPublished ? 'Todo publicado' : publishLabel(column)}
          </SubmitButton>
          <Link
            href={pasteGradesHref(subjectId, { comision: sectionId, columna: column.id })}
            className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-[10px] px-4 text-[0.9375rem]')}
          >
            <ClipboardPaste aria-hidden='true' className='size-4' strokeWidth={2} />
            Pegar notas de una planilla
          </Link>
        </div>
        <p className='text-[0.8125rem] text-muted-foreground'>
          Al publicar, cada alumno ve su nota y tu comentario, y le llega el aviso a la campana.
        </p>
      </ActionForm>
    </Card>
  )
}

function Result({ cell }: { cell: GradeCell | undefined }) {
  if (cell?.value != null) return <GradeBadge grade={cell.value} />
  return <StatusPill tone='neutral'>{cell?.absent ? 'Ausente' : 'Sin nota'}</StatusPill>
}

/** Una fila por alumno con su nota. Quien todavía no entró a HackAI no se puede calificar. */
export function StudentList({
  subjectId,
  sectionId,
  columnId,
  students,
  selectedId
}: {
  subjectId: string
  sectionId: string
  columnId: string
  students: GradebookStudent[]
  selectedId?: string
}) {
  if (students.length === 0) {
    return (
      <EmptyState icon={NotebookPen} title='Todavía no hay alumnos'>
        Cuando haya alumnos inscriptos a esta comisión, aparecen acá para cargarles la nota.
      </EmptyState>
    )
  }
  return (
    <Card>
      <List aria-label='Alumnos'>
        {students.map((s) => {
          const cell = s.cells[columnId]
          const meta = (
            <>
              <span>Legajo {s.legajo}</span>
              {s.personId === null && <span>· Todavía no entró a HackAI</span>}
              {cell && <span>· {cell.published ? 'Publicada' : 'Sin publicar'}</span>}
            </>
          )
          return (
            <ListItem
              key={s.legajo}
              href={
                s.personId
                  ? gradesHref(subjectId, { comision: sectionId, columna: columnId, alumno: s.personId })
                  : undefined
              }
              className={s.personId && s.personId === selectedId ? 'bg-accent/60' : undefined}
              title={s.name}
              description={cell?.comment || undefined}
              meta={meta}
              end={<Result cell={cell} />}
            />
          )
        })}
      </List>
    </Card>
  )
}
