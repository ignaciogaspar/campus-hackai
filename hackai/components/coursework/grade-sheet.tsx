/* La planilla de una columna de Calificaciones: una fila por alumno con un
   campo para la nota, y un solo botón que guarda todas las que cambiaron. Es
   lo que hace el docente la mayoría de las veces (pasar las notas de una
   lista), sin entrar alumno por alumno. El comentario, que es más largo, se
   escribe aparte desde el botón de cada fila. Muestra una página de alumnos
   por vez. */
import { MessageSquareText, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { saveGradeSheet } from '@/app/actions/coursework'
import { GRADE_BOX, PRIMARY } from '@/components/coursework/fields'
import { gradesHref, sheetValue } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/states'
import type { GradebookStudent, GradeCell } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

type Page = { page: number; pages: number; items: GradebookStudent[] }

const PASS_NOTE = { pendiente: 'pendiente de pasar al SIU', 'no-permitido': 'sin pasar al SIU' } as const

/** Lo que la fila dice de más, solo cuando se aparta de la columna: una nota nueva en una columna ya publicada, o una
    nota que no llegó al SIU. Lo demás lo cuenta el estado de la columna. */
function cellNote(cell: GradeCell | undefined, columnPublished: boolean): string | null {
  if (!cell) return null
  if (columnPublished && !cell.published) return 'sin publicar'
  if (cell.pass === 'pendiente' || cell.pass === 'no-permitido') return PASS_NOTE[cell.pass]
  return null
}

function SheetRow({
  student,
  cell,
  commentHref,
  selected,
  columnPublished
}: {
  student: GradebookStudent
  cell: GradeCell | undefined
  commentHref: string | null
  selected: boolean
  columnPublished: boolean
}) {
  const inputId = `nota-${student.legajo}`
  const disabled = student.personId === null
  const note = disabled ? 'todavía no entró a HackAI' : cellNote(cell, columnPublished)
  return (
    <li
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3',
        selected && 'bg-accent/60'
      )}
    >
      <div className='flex min-w-0 flex-col gap-1'>
        <label htmlFor={inputId} className='truncate text-[0.9375rem] font-semibold text-ink'>
          {student.name}
        </label>
        <p className='text-xs text-muted-foreground'>
          <span className='tabular-nums'>Legajo {student.legajo}</span>
          {note && <span> · {note}</span>}
        </p>
        {cell?.comment && <p className='line-clamp-1 text-[0.8125rem] text-muted-foreground'>{cell.comment}</p>}
      </div>
      <div className='flex items-center gap-1'>
        {student.personId && (
          <>
            <input type='hidden' name='alumno' value={student.personId} />
            <input type='hidden' name='nombre' value={student.name} />
            <input type='hidden' name='antes' value={sheetValue(cell)} />
            <input type='hidden' name='comentario' value={cell?.comment ?? ''} />
          </>
        )}
        <input
          id={inputId}
          name={disabled ? undefined : 'nota'}
          defaultValue={sheetValue(cell)}
          disabled={disabled}
          inputMode='decimal'
          autoComplete='off'
          placeholder='—'
          aria-describedby='planilla-ayuda'
          className={cn(
            GRADE_BOX,
            'outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-ice/60'
          )}
        />
        {commentHref ? (
          <Link
            href={commentHref}
            aria-label={`Comentario para ${student.name}`}
            className={cn(
              'grid size-11 place-items-center rounded-[10px] transition-colors hover:bg-ink/5 hover:text-ink focus-ring',
              cell?.comment ? 'text-ink' : 'text-muted-foreground'
            )}
          >
            <MessageSquareText aria-hidden='true' className='size-5' strokeWidth={2} />
          </Link>
        ) : (
          <span aria-hidden='true' className='size-11' />
        )}
      </div>
    </li>
  )
}

/** La planilla de la columna con la página de alumnos pedida. */
export function GradeSheet({
  subjectId,
  sectionId,
  columnId,
  students,
  page,
  selectedId,
  columnPublished
}: {
  subjectId: string
  sectionId: string
  columnId: string
  students: number
  page: Page
  selectedId?: string
  /** Si la columna ya se publicó: desde ahí, una nota nueva se marca «sin publicar» en su fila. */
  columnPublished: boolean
}) {
  if (students === 0) {
    return (
      <EmptyState icon={NotebookPen} title='Todavía no hay alumnos'>
        Cuando haya alumnos inscriptos a esta comisión, aparecen acá para cargarles la nota.
      </EmptyState>
    )
  }
  const view = { comision: sectionId, columna: columnId }
  // Con las notas guardadas en la clave de la lista, al volver del servidor los campos se rearman con lo nuevo. El
  // formulario no la lleva: si se rearmara, se perdería el «Guardamos N notas».
  const saved = page.items.map((s) => sheetValue(s.cells[columnId])).join('|')
  return (
    <div className='flex flex-col gap-3'>
      <ActionForm key={`${columnId}-${page.page}`} action={saveGradeSheet} clearOnEdit className='flex flex-col gap-3'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='columnId' value={columnId} />
        <Card key={saved}>
          <div className='flex items-baseline justify-between gap-3 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground'>
            <span>{students === 1 ? '1 alumno' : `${students} alumnos`}</span>
            <span>Nota</span>
          </div>
          <ul aria-label='Alumnos' className='divide-y divide-border'>
            {page.items.map((s) => (
              <SheetRow
                key={s.legajo}
                student={s}
                cell={s.cells[columnId]}
                selected={s.personId !== null && s.personId === selectedId}
                columnPublished={columnPublished}
                commentHref={
                  s.personId ? gradesHref(subjectId, { ...view, alumno: s.personId, pagina: page.page }) : null
                }
              />
            ))}
          </ul>
        </Card>
        {columnPublished && (
          <p className='rounded-xl bg-ice/70 px-3 py-2 text-[0.8125rem] text-ink'>
            Esta columna ya está publicada: los alumnos ven las notas que guardes al toque
          </p>
        )}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <p id='planilla-ayuda' className='text-[0.8125rem] text-muted-foreground'>
            De 1 a 10, con coma o punto. Escribí «A» si faltó.
          </p>
          <SubmitButton className={cn(PRIMARY, 'w-full sm:w-auto')}>
            {columnPublished ? 'Guardar y publicar' : 'Guardar notas'}
          </SubmitButton>
        </div>
      </ActionForm>
      {/* Fuera del formulario, para que el resultado de guardar quede pegado al botón. */}
      <Pagination
        page={page.page}
        pages={page.pages}
        hrefFor={(n) => gradesHref(subjectId, { ...view, pagina: n })}
        label='Páginas de alumnos'
      />
    </div>
  )
}
