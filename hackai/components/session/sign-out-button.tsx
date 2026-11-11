'use client'

/* Botón para salir: cierra la sesión y vuelve al ingreso. Va sobre el navy del
   encabezado. Es un componente de cliente para avisar mientras sale, y porque
   `Button` trae a `radix-ui` entero cuando se importa desde un componente de
   servidor. */
import { LogOut } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { signOut } from '@/app/actions/session'
import { Button } from '@/components/ui/button'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button
      type='submit'
      variant='ghost'
      disabled={pending}
      aria-busy={pending}
      className='h-10 cursor-pointer gap-1.5 rounded-full bg-white/[0.14] px-4 text-[0.8125rem] font-semibold text-white hover:bg-white/25 hover:text-white focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-white'
    >
      <LogOut aria-hidden='true' strokeWidth={1.8} />
      {pending ? 'Saliendo…' : 'Salir'}
    </Button>
  )
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Submit />
    </form>
  )
}
