/* El formulario de una tarea, para el docente. Al crearla se elige para qué
   comisiones (de las vigentes que dicta), si lleva nota y, si quiere, un
   archivo; al editarla solo se cambian el nombre, la consigna y la fecha
   límite: las comisiones y si lleva nota quedan como estaban. La fecha se
   escribe en la hora de Buenos Aires (components/coursework/format.ts). */
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { createTask, updateTask } from '@/app/actions/coursework'
import { inputValueOf, sectionLabel } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { Task, TaskSection } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'
const CHOICE =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent has-[:checked]:font-semibold'
const CHECK = 'size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'

function Fields({ task }: { task?: Task }) {
  return (
    <>
      <label className={LABEL}>
        Nombre
        <span className={BOX}>
          <input
            name='name'
            required
            maxLength={120}
            autoComplete='off'
            defaultValue={task?.name}
            placeholder='Práctica 3: integrales'
            className='min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
          />
        </span>
      </label>
      <label className={LABEL}>
        Consigna
        <span className={BOX}>
          <textarea
            name='instructions'
            rows={5}
            maxLength={5000}
            defaultValue={task?.instructions}
            aria-describedby='tarea-consigna-ayuda'
            placeholder='Qué tienen que hacer y cómo se entrega.'
            className='min-h-28 w-full resize-y bg-transparent px-3 py-2 text-[0.9375rem] font-normal outline-none'
          />
        </span>
        <span id='tarea-consigna-ayuda' className={HELP}>
          Podés sumar un archivo con los enunciados.
        </span>
      </label>
      <label className={LABEL}>
        Fecha límite
        <span className={BOX}>
          <input
            type='datetime-local'
            name='dueAt'
            required
            defaultValue={task ? inputValueOf(task.dueAt) : undefined}
            aria-describedby='tarea-fecha-ayuda'
            className='min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
          />
        </span>
        <span id='tarea-fecha-ayuda' className={HELP}>
          En hora de Buenos Aires.
        </span>
      </label>
    </>
  )
}

function CreateOnly({ sections, selectedId }: { sections: TaskSection[]; selectedId: string }) {
  return (
    <>
      <label className={LABEL}>
        Archivo (opcional, hasta 10 MB)
        <input
          type='file'
          name='file'
          className='text-[0.8125rem] font-normal file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-ice file:px-3 file:font-semibold file:text-blue focus-visible:outline-3 focus-visible:outline-ring'
        />
      </label>
      <fieldset className='flex flex-col gap-1'>
        <legend className='mb-1 text-[0.8125rem] font-semibold'>¿Para qué comisiones?</legend>
        {sections.map((s) => (
          <label key={s.sectionId} className={CHOICE}>
            <input
              type='checkbox'
              name='sectionIds'
              value={s.sectionId}
              defaultChecked={s.sectionId === selectedId}
              className={CHECK}
            />
            {sectionLabel(s.name)}
          </label>
        ))}
      </fieldset>
      <div className='flex flex-col gap-0.5'>
        <label className={CHOICE}>
          <input type='checkbox' name='graded' value='si' defaultChecked className={CHECK} />
          Lleva nota
        </label>
        <p className={cn(HELP, 'px-2 text-[0.8125rem]')}>
          Si no lleva nota, no tiene columna en Calificaciones. Después no se puede cambiar.
        </p>
      </div>
    </>
  )
}

export function NewTaskForm({
  subjectId,
  sections,
  selectedId,
  cancelHref
}: {
  subjectId: string
  /** Las comisiones vigentes que dicta el docente en la materia. */
  sections: TaskSection[]
  selectedId: string
  cancelHref: string
}) {
  return (
    <section aria-labelledby='tarea-nueva' className='rounded-[22px] bg-card p-4 shadow-card'>
      <h2 id='tarea-nueva' className='text-lg font-extrabold'>
        Tarea nueva
      </h2>
      <ActionForm action={createTask} className='mt-3 flex flex-col gap-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <Fields />
        <CreateOnly sections={sections} selectedId={selectedId} />
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}>
            Crear tarea
          </SubmitButton>
          <Link
            href={cancelHref}
            className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-[10px] px-4 text-[0.9375rem]')}
          >
            Cancelar
          </Link>
        </div>
      </ActionForm>
    </section>
  )
}

export function EditTaskForm({ task }: { task: Task }) {
  return (
    <details className='group rounded-[22px] bg-card shadow-card'>
      <summary className='flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[22px] px-4 text-base font-extrabold transition-colors hover:bg-ink/[0.03] focus-ring-inset [&::-webkit-details-marker]:hidden'>
        Editar la tarea
        <ChevronDown
          aria-hidden='true'
          className='size-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none'
          strokeWidth={2}
        />
      </summary>
      <div className='border-t border-border px-4 pt-3 pb-4'>
        <p className='text-[0.8125rem] text-muted-foreground'>
          Podés cambiar el nombre, la consigna y la fecha límite. Las comisiones y si lleva nota quedan como están.
        </p>
        <ActionForm action={updateTask} className='mt-3 flex flex-col gap-4'>
          <input type='hidden' name='taskId' value={task.id} />
          <Fields task={task} />
          <div className='flex flex-wrap gap-2'>
            <SubmitButton className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}>
              Guardar cambios
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </details>
  )
}
