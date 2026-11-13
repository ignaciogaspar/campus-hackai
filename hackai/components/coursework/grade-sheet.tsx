'use client'

/* La planilla de una columna de Calificaciones: una fila por alumno con un
   campo para la nota, y un solo botón que guarda todas las que cambiaron. Es
   lo que hace el docente la mayoría de las veces (pasar las notas de una
   lista), sin entrar alumno por alumno. El comentario, que es más largo, se
   escribe aparte desde el botón de cada fila. Muestra una página de alumnos
   por vez.

   Marca las filas que cambiaron y cuenta las notas sin guardar; con alguna
   pendiente, pregunta antes de salir por un enlace o de cerrar la página.
   Antes de mandar revisa lo escrito: si una nota no sirve, la marca y no manda
   nada; si un campo se vació, pide confirmar que se quita esa nota. */
import { MessageSquareText, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useEffect, useState } from 'react'
import { saveGradeSheet } from '@/app/actions/coursework'
import { GRADE_BOX, PRIMARY } from '@/components/coursework/fields'
import { gradesHref, notesLabel, sheetChange, sheetValue } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
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

type Change = ReturnType<typeof sheetChange>

/** Lo que dice la fila de su cambio sin guardar. */
function changeNote(change: Change, published: boolean): string | null {
  if (change === 'igual') return null
  if (change === 'quitar') return published ? 'ya la ven los alumnos: no se puede quitar' : 'se quita al guardar'
  if (change === 'invalida') return 'tiene que ir de 1 a 10, o «A» si faltó'
  return 'sin guardar'
}

/** Lo que tiene que hacer el docente para que se guarde algo, o `null` si se puede mandar. */
function blocker(rows: { student: GradebookStudent; change: Change; published: boolean }[]) {
  const wrong = rows.find((r) => r.change === 'invalida')
  if (wrong) {
    return {
      legajo: wrong.student.legajo,
      message: `No guardamos ninguna nota: la de ${wrong.student.name} tiene que ir de 1 a 10, con coma o punto, o ser «A» si faltó.`
    }
  }
  const seen = rows.find((r) => r.change === 'quitar' && r.published)
  if (seen) {
    return {
      legajo: seen.student.legajo,
      message: `No guardamos ninguna nota: la de ${seen.student.name} ya la ven los alumnos, así que no se puede quitar. Escribí la nota corregida.`
    }
  }
  return null
}

/** La pregunta antes de quitar notas: «Vas a quitar la nota de Aguirre, Tomás. ¿Seguimos?». */
function removalQuestion(names: string[]): string {
  const who = names.length === 1 ? `la nota de ${names[0]}` : `${names.length} notas: ${names.join('; ')}`
  return `Vas a quitar ${who}. Los alumnos todavía no la veían. ¿Seguimos?`
}

/** Mientras haya notas sin guardar, pregunta antes de seguir un enlace de la página o de recargarla o cerrarla. Un
    enlace de descarga, uno que abre otra pestaña o uno a la misma dirección no pierden nada. */
function useLeaveGuard(unsaved: number) {
  useEffect(() => {
    if (unsaved === 0) return
    const question = `Tenés ${notesLabel(unsaved)} sin guardar. Si salís ahora, se pierden. ¿Salir igual?`
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.target === '_blank') return
      if (link.href === window.location.href || window.confirm(question)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Safari todavía pide el valor de devolución para preguntar.
      event.returnValue = ''
    }
    // En captura: llega antes que el enlace de Next.js, que navega sin recargar.
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [unsaved])
}

/** En el celular el teclado de números no tiene letras: el ausente se marca con este botón. Al sacarlo, vuelve lo
    que estaba guardado. */
function AbsentToggle({
  name,
  value,
  before,
  onValue
}: {
  name: string
  value: string
  before: string
  onValue: (value: string) => void
}) {
  const absent = value.trim().toUpperCase() === 'A'
  return (
    <button
      type='button'
      aria-pressed={absent}
      aria-label={`Ausente: ${name}`}
      onClick={() => onValue(absent ? (before === 'A' ? '' : before) : 'A')}
      className={cn(
        'grid h-11 place-items-center rounded-[10px] border border-border px-2 text-xs font-semibold text-muted-foreground transition-colors focus-ring sm:hidden',
        'aria-pressed:border-blue aria-pressed:bg-accent aria-pressed:text-blue'
      )}
    >
      Ausente
    </button>
  )
}

/** El botón del comentario de la fila, o su lugar vacío si el alumno todavía no entró a HackAI. */
function CommentLink({ href, name, filled }: { href: string | null; name: string; filled: boolean }) {
  if (!href) return <span aria-hidden='true' className='size-11' />
  return (
    <Link
      href={href}
      aria-label={`Comentario para ${name}`}
      className={cn(
        'grid size-11 place-items-center rounded-[10px] transition-colors hover:bg-ink/5 hover:text-ink focus-ring',
        filled ? 'text-ink' : 'text-muted-foreground'
      )}
    >
      <MessageSquareText aria-hidden='true' className='size-5' strokeWidth={2} />
    </Link>
  )
}

function SheetRow({
  student,
  cell,
  commentHref,
  selected,
  columnPublished,
  value,
  change,
  invalid,
  onValue
}: {
  student: GradebookStudent
  cell: GradeCell | undefined
  commentHref: string | null
  selected: boolean
  columnPublished: boolean
  value: string
  change: Change
  invalid: boolean
  onValue: (value: string) => void
}) {
  const inputId = `nota-${student.legajo}`
  const disabled = student.personId === null
  const before = sheetValue(cell)
  const note = disabled ? 'todavía no entró a HackAI' : cellNote(cell, columnPublished)
  const pending = changeNote(change, cell?.published ?? false)
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3',
        selected && 'bg-accent/60',
        change !== 'igual' && 'bg-warning-background/60'
      )}
    >
      <div className='flex min-w-[9rem] flex-1 flex-col gap-1'>
        <label htmlFor={inputId} className='text-[0.9375rem] font-semibold break-words text-ink'>
          {student.name}
        </label>
        <p className='text-xs text-muted-foreground'>
          <span className='tabular-nums'>Legajo {student.legajo}</span>
          {note && <span> · {note}</span>}
          {pending && <span className='font-semibold text-warning-foreground'> · {pending}</span>}
        </p>
        {cell?.comment && <p className='line-clamp-1 text-[0.8125rem] text-muted-foreground'>{cell.comment}</p>}
      </div>
      <div className='ml-auto flex items-center gap-1'>
        {student.personId && (
          <>
            <input type='hidden' name='alumno' value={student.personId} />
            <input type='hidden' name='nombre' value={student.name} />
            <input type='hidden' name='antes' value={before} />
            <input type='hidden' name='comentario' value={cell?.comment ?? ''} />
            <input type='hidden' name='publicada' value={cell?.published ? 'si' : ''} />
          </>
        )}
        <input
          id={inputId}
          name={disabled ? undefined : 'nota'}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          disabled={disabled}
          inputMode='decimal'
          autoComplete='off'
          placeholder='—'
          aria-describedby='planilla-ayuda'
          aria-invalid={invalid || undefined}
          className={cn(
            GRADE_BOX,
            'placeholder:font-normal placeholder:text-muted-foreground focus-ring focus-visible:border-blue disabled:bg-ice/60',
            invalid && 'border-2 border-destructive focus-visible:border-destructive'
          )}
        />
        {!disabled && <AbsentToggle name={student.name} value={value} before={before} onValue={onValue} />}
        <CommentLink href={commentHref} name={student.name} filled={Boolean(cell?.comment)} />
      </div>
    </li>
  )
}

/** Lo escrito en cada campo, por legajo: al empezar, lo guardado. */
const valuesOf = (items: GradebookStudent[], columnId: string) =>
  Object.fromEntries(items.map((s) => [s.legajo, sheetValue(s.cells[columnId])]))

/** El formulario de la planilla. Cuando vuelven del servidor notas guardadas distintas, los campos se rearman con lo
    nuevo; el formulario no se rearma, para no perder el «Guardamos N notas». */
function SheetForm({
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
  columnPublished: boolean
}) {
  const saved = page.items.map((s) => sheetValue(s.cells[columnId])).join('|')
  const [shown, setShown] = useState(saved)
  const [values, setValues] = useState(() => valuesOf(page.items, columnId))
  const [problem, setProblem] = useState<{ legajo: string; message: string } | null>(null)
  if (shown !== saved) {
    setShown(saved)
    setValues(valuesOf(page.items, columnId))
  }

  const rows = page.items.map((student) => {
    const cell = student.cells[columnId]
    const change: Change =
      student.personId === null
        ? 'igual'
        : sheetChange({ before: sheetValue(cell), value: values[student.legajo] ?? '' })
    return { student, cell, change, published: cell?.published ?? false }
  })
  const unsaved = rows.filter((r) => r.change !== 'igual').length
  useLeaveGuard(unsaved)

  function setValue(legajo: string, value: string) {
    setValues((current) => ({ ...current, [legajo]: value }))
    if (problem?.legajo === legajo) setProblem(null)
  }

  /** Antes de mandar: lo que no sirve se marca y no se manda nada; quitar notas se confirma. */
  function check(event: FormEvent) {
    const stop = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    const found = blocker(rows)
    if (found) {
      stop()
      setProblem(found)
      document.getElementById(`nota-${found.legajo}`)?.focus()
      return
    }
    setProblem(null)
    const removed = rows.filter((r) => r.change === 'quitar').map((r) => r.student.name)
    if (removed.length > 0 && !window.confirm(removalQuestion(removed))) stop()
  }

  const view = { comision: sectionId, columna: columnId }
  return (
    // En captura, para revisar antes de que el formulario mande.
    <div onSubmitCapture={check}>
      <ActionForm action={saveGradeSheet} clearOnEdit className='flex flex-col gap-3'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='columnId' value={columnId} />
        {problem && <ErrorNotice>{problem.message}</ErrorNotice>}
        <Card>
          <div className='flex items-baseline justify-between gap-3 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground'>
            <span>{students === 1 ? '1 alumno' : `${students} alumnos`}</span>
            <span>Nota</span>
          </div>
          <ul aria-label='Alumnos' className='divide-y divide-border'>
            {rows.map(({ student, cell, change }) => (
              <SheetRow
                key={student.legajo}
                student={student}
                cell={cell}
                value={values[student.legajo] ?? ''}
                change={change}
                invalid={problem?.legajo === student.legajo}
                onValue={(value) => setValue(student.legajo, value)}
                selected={student.personId !== null && student.personId === selectedId}
                columnPublished={columnPublished}
                commentHref={
                  student.personId
                    ? gradesHref(subjectId, { ...view, alumno: student.personId, pagina: page.page })
                    : null
                }
              />
            ))}
          </ul>
        </Card>
        {columnPublished && (
          <p className='rounded-xl bg-ice/70 px-3 py-2 text-[0.8125rem] text-ink'>
            Esta columna ya está publicada: los alumnos ven enseguida las notas que guardes.
          </p>
        )}
        <p id='planilla-ayuda' className='text-[0.8125rem] text-muted-foreground'>
          De 1 a 10, con coma o punto. <span className='sm:hidden'>Si faltó, tocá «Ausente».</span>
          <span className='max-sm:hidden'>Escribí «A» si faltó.</span> Para quitar una nota, borrala y guardá.
        </p>
        {/* Con cambios sin guardar, en el celular el botón queda a mano arriba de la barra de abajo. */}
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3',
            unsaved > 0 &&
              'max-lg:sticky max-lg:bottom-[calc(var(--tabbar-space)+0.5rem)] max-lg:z-10 max-lg:rounded-xl max-lg:border max-lg:border-border max-lg:bg-card max-lg:p-3 max-lg:shadow-raised'
          )}
        >
          <p aria-live='polite' className='text-[0.8125rem] font-semibold text-warning-foreground'>
            {unsaved > 0 ? `Tenés ${notesLabel(unsaved)} sin guardar` : ''}
          </p>
          <SubmitButton className={cn(PRIMARY, 'w-full sm:w-auto')}>
            {columnPublished ? 'Guardar y publicar' : 'Guardar notas'}
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
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
  return (
    <div className='flex flex-col gap-3'>
      <SheetForm
        key={`${columnId}-${page.page}`}
        subjectId={subjectId}
        sectionId={sectionId}
        columnId={columnId}
        students={students}
        page={page}
        selectedId={selectedId}
        columnPublished={columnPublished}
      />
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
