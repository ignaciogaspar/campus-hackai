/* Las piezas de Calificaciones de una comisión: el selector de columna (una por
   tarea con nota, una por instancia de examen y al final la nota de cursada) y
   el estado de la columna elegida, con publicar y cómo va el pase al SIU. La
   planilla para cargar las notas está en ./grade-sheet.tsx. */
import { ClipboardList, ClipboardPaste } from 'lucide-react'
import Link from 'next/link'
import { publishColumn, retryGradePass } from '@/app/actions/coursework'
import { GHOST, PRIMARY, SECONDARY } from '@/components/coursework/fields'
import { COURSE_COLUMN, gradeInputValue, gradesHref, pasteGradesHref } from '@/components/coursework/format'
import { dueTime } from '@/components/dates'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { Card } from '@/components/ui/card'
import { OriginBadge } from '@/components/ui/origin-badge'
import { railItem, railTrack } from '@/components/ui/rail'
import { RailScroller } from '@/components/ui/rail-scroller'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { GradeColumn, PassCounts, PassStatus } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

export function NoColumns({ evaluationHref }: { evaluationHref: string }) {
  return (
    <EmptyState icon={ClipboardList} title='Todavía no hay columnas'>
      Creá una tarea con nota o{' '}
      <Link href={evaluationHref} className='font-semibold text-blue underline-offset-2 hover:underline focus-ring'>
        sumá una instancia de examen
      </Link>
      , o esperá a que el SIU cargue los parciales de la comisión.
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
    <nav aria-label='Columna' className='flex min-w-0 flex-col gap-2'>
      <span aria-hidden='true' className='px-1 text-xs font-semibold text-muted-foreground'>
        Columna
      </span>
      <RailScroller
        className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto [scrollbar-width:none] lg:max-w-3xl')}
      >
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
      </RailScroller>
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
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='text-lg font-extrabold text-balance'>{column.name}</h2>
          <StatusPill tone={column.publishedAt ? 'success' : 'neutral'}>
            {column.publishedAt ? 'Publicada' : 'Sin publicar'}
          </StatusPill>
        </div>
        <p className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <OriginBadge origin={column.kind === 'evaluacion' ? 'siu' : 'hackai'} />
          <time dateTime={column.date}>{dueTime(column.date)}</time>
          <span>· {column.weight === null ? 'Sin peso' : `Peso ${gradeInputValue(column.weight)}`}</span>
        </p>
        <p className='text-[0.8125rem] text-ink tabular-nums'>
          {column.graded} de {students} con nota
          {column.unpublished > 0 && column.graded > 0 ? ` · ${column.unpublished} sin publicar` : ''}
        </p>
      </div>
      <ActionForm action={publishColumn} className='flex flex-col gap-2'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='columnId' value={column.id} />
        <div className='flex flex-wrap gap-2'>
          <SubmitButton disabled={column.graded === 0 || everythingPublished} className={PRIMARY}>
            {everythingPublished ? 'Todo publicado' : publishLabel(column)}
          </SubmitButton>
          <Link href={pasteGradesHref(subjectId, { comision: sectionId, columna: column.id })} className={GHOST}>
            <ClipboardPaste aria-hidden='true' className='size-4' strokeWidth={2} />
            Pegar de una planilla
          </Link>
        </div>
        {column.publishedAt === null && column.graded > 0 && (
          <p className='text-[0.8125rem] text-muted-foreground'>
            Al publicar, cada alumno ve su nota y tu comentario, y le llega el aviso
          </p>
        )}
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

/** Lo que ya se resolvió del pase, en una línea: «Pasaron 12 al SIU · 1 sin pasar». Lo pendiente va aparte. */
function passLine(pass: PassCounts): string {
  const parts = [
    pass.passed > 0 ? `Pasaron ${pass.passed} al SIU` : null,
    pass.refused > 0 ? `${pass.refused} sin pasar al SIU` : null
  ].filter(Boolean)
  return parts.join(' · ')
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
      <p className='flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground tabular-nums'>
        <span>{passLine(pass)}</span>
        {pass.pending > 0 && (
          <StatusPill tone='warning'>
            {pass.pending === 1 ? '1 pendiente de pasar' : `${pass.pending} pendientes de pasar`}
          </StatusPill>
        )}
      </p>
      {pass.pending > 0 && (
        <>
          <p className='text-[0.8125rem] text-muted-foreground'>
            El SIU no respondió. Las notas ya las ven los alumnos y las reintentamos solas.
          </p>
          <div className='flex flex-wrap gap-2'>
            <SubmitButton className={SECONDARY}>Reintentar el pase</SubmitButton>
          </div>
        </>
      )}
      {pass.refused > 0 && (
        <p className='text-[0.8125rem] text-muted-foreground'>
          El SIU no permite cargar notas desde HackAI: esas notas quedan solo acá, y los alumnos las ven igual
        </p>
      )}
    </ActionForm>
  )
}
