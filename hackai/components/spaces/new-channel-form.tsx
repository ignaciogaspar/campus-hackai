/* Canal nuevo, para el docente: un nombre y quién lo ve, toda la materia o una
   de las comisiones que dicta. Si sale bien, la acción lleva al canal nuevo.
   Si el nombre no sirve o se repite, lo dice Espacios. */
import Link from 'next/link'
import { createChannel } from '@/app/actions/spaces'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import type { SpaceSection } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

type Props = {
  subjectId: string
  spaceId: string
  /** Las comisiones que dicta, para crear un canal solo de una de ellas. */
  sections: SpaceSection[]
  cancelHref: string
}

export function NewChannelForm({ subjectId, spaceId, sections, cancelHref }: Props) {
  return (
    <section aria-labelledby='canal-nuevo' className='rounded-[22px] bg-card p-4 shadow-card'>
      <h2 id='canal-nuevo' className='text-lg font-extrabold'>
        Canal nuevo
      </h2>
      <ActionForm action={createChannel} className='mt-3 flex flex-col gap-4'>
        <input type='hidden' name='subjectId' value={subjectId} />
        <input type='hidden' name='spaceId' value={spaceId} />
        <label className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
          Nombre
          <span className='flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'>
            <span aria-hidden='true' className='pl-3 text-[0.9375rem] font-bold text-muted-foreground'>
              #
            </span>
            <input
              name='name'
              required
              maxLength={60}
              autoComplete='off'
              aria-describedby='canal-nuevo-ayuda'
              placeholder='parciales-viejos'
              className='min-h-11 w-full bg-transparent px-1.5 text-[0.9375rem] font-normal outline-none'
            />
          </span>
          <span id='canal-nuevo-ayuda' className='font-normal text-muted-foreground'>
            En minúsculas y con guiones en vez de espacios.
          </span>
        </label>
        <fieldset className='flex flex-col gap-1'>
          <legend className='mb-1 text-[0.8125rem] font-semibold'>¿Quién lo ve?</legend>
          {[
            { value: 'materia', label: 'Toda la materia' },
            ...sections.map((s) => ({ value: `comision:${s.sectionId}`, label: `Solo la Comisión ${s.name}` }))
          ].map((option, i) => (
            <label
              key={option.value}
              className='flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent has-[:checked]:font-semibold'
            >
              <input
                type='radio'
                name='scope'
                value={option.value}
                defaultChecked={i === 0}
                className='size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')}>
            Crear canal
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
