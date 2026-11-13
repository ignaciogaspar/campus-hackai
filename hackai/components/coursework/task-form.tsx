/* El formulario de una tarea, para el docente. Al crearla se elige para qué
   comisiones (de las vigentes que dicta), si lleva nota y, si quiere, un
   archivo; al editarla solo se cambian el nombre, la consigna y la fecha
   límite: las comisiones y si lleva nota quedan como estaban. La fecha y la
   hora van en dos campos, en la hora de Buenos Aires (date-time-fields.tsx). */
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { createTask, updateTask } from '@/app/actions/coursework'
import { DateTimeFields } from '@/components/coursework/date-time-fields'
import { dateTimeParts, sectionLabel } from '@/components/coursework/format'
import { ActionForm, FieldError, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { Task, TaskSection } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

/** Un campo: el nombre (con si es obligatorio), el control, la ayuda y el error, uno debajo del otro. El error va
    afuera del label para que no se sume al nombre del campo. */
const FIELD = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[[aria-invalid=true]]:border-destructive'
const HELP = 'font-normal text-muted-foreground'
const CHOICE =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent has-[:checked]:font-semibold'
const CHECK = 'size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** «(obligatorio)» u «(opcional)» al lado del nombre del campo, más suave que el nombre. */
function Need({ children }: { children: string }) {
  return <span className={HELP}> ({children})</span>
}

/** Nombre, consigna y fecha límite: los mismos campos para crear la tarea y para editarla. La ayuda del archivo
    va solo al crearla, que es cuando hay campo de archivo. `min`: desde qué día se puede elegir la fecha límite
    (`AAAA-MM-DD`). Sin `min`, cualquiera (una tarea ya vencida que se edita sin cambiarle la fecha). */
function Fields({ task, min }: { task?: Task; min?: string }) {
  return (
    <>
      <div className={FIELD}>
        <label htmlFor='tarea-nombre'>
          Nombre<Need>obligatorio</Need>
        </label>
        <span className={BOX}>
          <input
            id='tarea-nombre'
            name='name'
            required
            maxLength={120}
            autoComplete='off'
            defaultValue={task?.name}
            placeholder='Práctica 3: integrales'
            className='min-h-11 w-full bg-transparent px-3 text-[0.9375rem] font-normal outline-none'
          />
        </span>
        <FieldError field='name' />
      </div>
      <div className={FIELD}>
        <label htmlFor='tarea-consigna'>
          Consigna<Need>opcional</Need>
        </label>
        <span className={BOX}>
          <textarea
            id='tarea-consigna'
            name='instructions'
            rows={5}
            maxLength={5000}
            defaultValue={task?.instructions}
            aria-describedby={task ? undefined : 'tarea-consigna-ayuda'}
            placeholder='Qué tienen que hacer y cómo se entrega.'
            className='min-h-28 w-full resize-y bg-transparent px-3 py-2 text-[0.9375rem] font-normal outline-none'
          />
        </span>
        {!task && (
          <span id='tarea-consigna-ayuda' className={HELP}>
            Podés sumar un archivo con los enunciados más abajo
          </span>
        )}
        <FieldError field='instructions' />
      </div>
      <DateTimeFields
        legend='Fecha límite'
        lead='Vence el'
        dateName='dueDate'
        timeName='dueTime'
        idPrefix='tarea-fecha'
        value={task?.dueAt}
        suggestedTime='23:59'
        minDate={min}
      />
    </>
  )
}

function CreateOnly({ sections, selectedId }: { sections: TaskSection[]; selectedId: string }) {
  return (
    <>
      <div className={FIELD}>
        <label htmlFor='tarea-archivo'>
          Archivo<Need>opcional, hasta 10 MB</Need>
        </label>
        <input
          id='tarea-archivo'
          type='file'
          name='file'
          className='text-[0.8125rem] font-normal file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-ice file:px-3 file:font-semibold file:text-blue focus-visible:outline-3 focus-visible:outline-ring'
        />
        <FieldError field='file' />
      </div>
      <fieldset className='flex flex-col gap-1'>
        <legend className='mb-1 text-[0.8125rem] font-semibold'>
          ¿Para qué comisiones?<Need>obligatorio, al menos una</Need>
        </legend>
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
        <FieldError field='sectionIds' className='px-2' />
      </fieldset>
      {/* La advertencia va antes de la casilla: se lee antes de decidir, porque después no se puede cambiar. */}
      <fieldset className='flex flex-col gap-1'>
        <legend className='text-[0.8125rem] font-semibold'>¿Lleva nota?</legend>
        <p id='tarea-nota-ayuda' className={cn(HELP, 'mb-1 text-[0.8125rem]')}>
          Después no se puede cambiar. Si no lleva nota, no tiene columna en Calificaciones.
        </p>
        <label className={CHOICE}>
          <input
            type='checkbox'
            name='graded'
            value='si'
            defaultChecked
            aria-describedby='tarea-nota-ayuda'
            className={CHECK}
          />
          Lleva nota
        </label>
      </fieldset>
    </>
  )
}

export function NewTaskForm({
  subjectId,
  sections,
  selectedId,
  cancelHref,
  now
}: {
  subjectId: string
  /** Las comisiones vigentes que dicta el docente en la materia. */
  sections: TaskSection[]
  selectedId: string
  cancelHref: string
  /** ISO: la hora del reloj de la app. Una tarea no nace vencida. */
  now: string
}) {
  return (
    <section aria-labelledby='tarea-nueva' className='rounded-[22px] bg-card p-4 shadow-card'>
      <h2 id='tarea-nueva' className='text-lg font-extrabold'>
        Tarea nueva
      </h2>
      <ActionForm action={createTask} noValidate className='mt-3 flex flex-col gap-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <Fields min={dateTimeParts(now).date} />
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

export function EditTaskForm({ task, now }: { task: Task; now: string }) {
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
        <ActionForm action={updateTask} noValidate className='mt-3 flex flex-col gap-4'>
          <input type='hidden' name='taskId' value={task.id} />
          {/* Una tarea ya vencida se edita sin tocarle la fecha: el campo no la puede marcar como inválida. */}
          <Fields task={task} min={task.past ? undefined : dateTimeParts(now).date} />
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
