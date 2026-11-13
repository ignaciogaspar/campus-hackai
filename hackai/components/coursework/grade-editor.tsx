/* Nota y comentario de un alumno en una columna, con «Guardar y pasar al
   siguiente»: el docente no vuelve a la lista entre un alumno y otro. Sin
   JavaScript también manda: la acción guarda y lleva a la pantalla del
   siguiente. Con la columna ya publicada, avisa que el alumno ve el cambio al
   toque. */
import Link from 'next/link'
import { gradeStudent } from '@/app/actions/coursework'
import { gradeInputValue, gradesHref } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { GradebookStudent, GradeCell, GradeColumn } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'
const CHOICE =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent has-[:checked]:font-semibold'

export function GradeEditor({
  subjectId,
  sectionId,
  column,
  student,
  cell,
  nextId,
  position
}: {
  subjectId: string
  sectionId: string
  column: GradeColumn
  student: GradebookStudent & { personId: string }
  cell: GradeCell | undefined
  /** A quién se pasa después de guardar; `null` si es el último. */
  nextId: string | null
  /** «2 de 30». */
  position: { index: number; total: number }
}) {
  const closeHref = gradesHref(subjectId, { comision: sectionId, columna: column.id })
  return (
    <section aria-labelledby='nota-alumno' className='rounded-[22px] bg-card p-4 shadow-card'>
      <p className='text-xs font-semibold text-muted-foreground'>
        {column.name} · {position.index} de {position.total}
      </p>
      <h2 id='nota-alumno' className='text-lg font-extrabold text-balance'>
        {student.name}
      </h2>
      <p className='text-[0.8125rem] text-muted-foreground'>Legajo {student.legajo}</p>
      {column.publishedAt && (
        <p className='mt-2 rounded-xl bg-ice/70 px-3 py-2 text-[0.8125rem] text-ink'>
          Esta columna ya está publicada: el alumno ve cualquier cambio al toque
        </p>
      )}
      <ActionForm key={student.personId} action={gradeStudent} className='mt-3 flex flex-col gap-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='sectionId' value={sectionId} />
        <input type='hidden' name='columnId' value={column.id} />
        <input type='hidden' name='studentId' value={student.personId} />
        {nextId && <input type='hidden' name='next' value={nextId} />}
        <label className={LABEL}>
          Nota
          <span className={BOX}>
            <input
              name='value'
              inputMode='decimal'
              autoComplete='off'
              enterKeyHint='next'
              defaultValue={gradeInputValue(cell?.value ?? null)}
              aria-describedby='nota-ayuda'
              placeholder='8,5'
              className='min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
            />
          </span>
          <span id='nota-ayuda' className={HELP}>
            De 1 a 10. Podés usar coma o punto.
          </span>
        </label>
        <label className={CHOICE}>
          <input
            type='checkbox'
            name='absent'
            value='si'
            defaultChecked={cell?.absent}
            className='size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
          />
          Ausente
        </label>
        <label className={LABEL}>
          Comentario (lo ve el alumno)
          <span className={BOX}>
            <textarea
              name='comment'
              rows={4}
              maxLength={2000}
              defaultValue={cell?.comment}
              placeholder='Qué estuvo bien y qué conviene repasar.'
              className='min-h-24 w-full resize-y bg-transparent px-3 py-2 text-[0.9375rem] font-normal outline-none'
            />
          </span>
        </label>
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}>
            {nextId ? 'Guardar y pasar al siguiente' : 'Guardar y terminar'}
          </SubmitButton>
          <Link
            href={closeHref}
            className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-[10px] px-4 text-[0.9375rem]')}
          >
            Volver a la lista
          </Link>
        </div>
      </ActionForm>
    </section>
  )
}
