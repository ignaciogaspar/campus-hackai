'use client'

/* La fila de una persona en el ingreso de demo: toda la fila es el botón que
   abre su sesión. Mientras entra se desactiva y lo dice, para que un toque de
   más no mande el formulario dos veces. */
import { ChevronRight } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Avatar } from '@/components/shell/avatar'
import type { Person } from '@/lib/core/people'

export function PersonRow({ person, detail }: { person: Person; detail?: string }) {
  const { pending } = useFormStatus()
  const second = pending ? 'Entrando…' : detail

  return (
    <button
      type='submit'
      disabled={pending}
      aria-busy={pending}
      className='group flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 outline-none hover:bg-azul/[0.04] focus-visible:bg-azul-suave focus-visible:inset-ring-2 focus-visible:inset-ring-azul-claro disabled:cursor-progress disabled:opacity-60'
    >
      <Avatar person={person} />
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='leading-snug font-semibold'>{person.name}</span>
        {second && <span className='text-[0.8125rem] leading-snug text-muted-foreground'>{second}</span>}
      </span>
      <ChevronRight
        aria-hidden='true'
        className='size-5 flex-none text-gris-claro transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-azul motion-reduce:transition-none'
        strokeWidth={1.8}
      />
    </button>
  )
}
