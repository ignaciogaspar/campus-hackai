'use client'

/* El botón de una persona en el ingreso de demo. Mientras se abre la sesión se
   desactiva y lo dice, para que un toque de más no mande el formulario dos
   veces. */
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function PersonButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <Button
      type='submit'
      variant='outline'
      disabled={pending}
      aria-busy={pending}
      className='h-auto min-h-14 w-full flex-col items-start justify-start gap-0.5 rounded-xl bg-card px-4 py-3 text-left whitespace-normal shadow-xs'
    >
      {children}
      {pending && <span className='text-xs font-normal text-muted-foreground'>Entrando…</span>}
    </Button>
  )
}
