/* Calificaciones de una comisión, pensadas primero para el celular: una
   columna a la vez. Arriba se elige la columna (una por tarea con nota y una
   por parcial del SIU, y al final la nota de cursada), después se ve su estado y
   se publica, y debajo hay una fila por alumno con su nota. Tocar un alumno abre
   su nota y comentario.
   Sin tablas anchas: la misma lista sirve en la compu. */
import { ClipboardList, ClipboardPaste, FileSpreadsheet, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { publishColumn, retryGradePass } from '@/app/actions/coursework'
import { GradeBadge } from '@/components/academic/grade-badge'
import {
  COURSE_COLUMN,
  dueTime,
  gradeInputValue,
  gradesExcelHref,
  gradesHref,
  pasteGradesHref
} from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { OriginBadge } from '@/components/ui/origin-badge'
import { railItem, railTrack } from '@/components/ui/rail'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { GradebookStudent, GradeCell, GradeColumn, PassCounts, PassStatus } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

/** Baja el Excel de la materia: una hoja por comisión del docente, con sus alumnos y notas. Es un enlace común con
    `download`, así anda igual en el celular. */
export function ExcelDownload({ subjectId, several }: { subjectId: string; several: boolean }) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4'>
      <a
        href={gradesExcelHref(subjectId)}
        download
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-full flex-none rounded-[10px] sm:w-auto')}
      >
        <FileSpreadsheet aria-hidden='true' data-icon='inline-start' />
        Descargar Excel de la materia
      </a>
      <p className='text-[0.8125rem] text-muted-foreground'>
        {several ? 'Una hoja por cada una de tus comisiones' : 'Una hoja con tu comisión'}, con los alumnos y todas sus
        notas.
      </p>
    </div>
  )
}

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
        <Link
          href={gradesHref(subjectId, { comision, columna: COURSE_COLUMN })}
          aria-current={selectedId === COURSE_COLUMN ? 'page' : undefined}
          className={cn(railItem({ size: 'sm' }), 'min-h-11 max-w-[11rem] flex-none px-3 max-sm:px-2.5')}
        >
          <span className='truncate'>Nota de cursada</span>
        </Link>
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
          <span>· {column.weight === null ? 'Sin peso' : `Peso ${gradeInputValue(column.weight)}`}</span>
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
      {column.pass && <PassSummary subjectId={subjectId} sectionId={sectionId} pass={column.pass} />}
    </Card>
  )
}

const PASS_PILL: Record<PassStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
  pasado: { tone: 'success', label: 'Pasada al SIU' },
  pendiente: { tone: 'warning', label: 'Pendiente de pasar' },
  'no-permitido': { tone: 'neutral', label: 'Sin pasar al SIU' }
}

/** Si la nota ya pasó al SIU. Una tarea no se pasa: no existe en el SIU, y no lleva estado. */
export function PassPill({ status }: { status: PassStatus }) {
  const { tone, label } = PASS_PILL[status]
  return <StatusPill tone={tone}>{label}</StatusPill>
}

/** Cómo va el pase al SIU de una evaluación del SIU, con el botón para reintentar lo pendiente. */
export function PassSummary({
  subjectId,
  sectionId,
  pass
}: {
  subjectId: string
  sectionId: string
  pass: PassCounts
}) {
  if (pass.passed + pass.pending + pass.refused === 0) return null
  return (
    <ActionForm action={retryGradePass} className='flex flex-col gap-2'>
      <input type='hidden' name='subjectId' value={subjectId} />
      <input type='hidden' name='sectionId' value={sectionId} />
      <div className='flex flex-wrap items-center gap-1.5'>
        {pass.passed > 0 && <StatusPill tone='success'>{pass.passed} pasadas al SIU</StatusPill>}
        {pass.pending > 0 && (
          <StatusPill tone='warning'>
            {pass.pending === 1 ? '1 pendiente de pasar' : `${pass.pending} pendientes de pasar`}
          </StatusPill>
        )}
        {pass.refused > 0 && <StatusPill tone='neutral'>{pass.refused} sin pasar al SIU</StatusPill>}
      </div>
      {pass.pending > 0 && (
        <>
          <p className='text-[0.8125rem] text-muted-foreground'>
            El SIU no respondió. Las notas ya las ven los alumnos y las reintentamos solas.
          </p>
          <div className='flex flex-wrap gap-2'>
            <SubmitButton
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'min-h-11 rounded-[10px] px-4 text-[0.9375rem] font-bold'
              )}
            >
              Reintentar el pase
            </SubmitButton>
          </div>
        </>
      )}
      {pass.refused > 0 && (
        <p className='text-[0.8125rem] text-muted-foreground'>
          El SIU no permite cargar notas desde HackAI: esas notas quedan solo acá, y los alumnos las ven igual.
        </p>
      )}
    </ActionForm>
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
              {cell?.pass && <PassPill status={cell.pass} />}
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
