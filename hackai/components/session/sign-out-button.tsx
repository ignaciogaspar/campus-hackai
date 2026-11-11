'use client'

/* Botón para salir: cierra la sesión y vuelve al ingreso. Es un componente de
   cliente para avisar mientras sale, y porque `Button` trae a `radix-ui`
   entero cuando se importa desde un componente de servidor. */
import { useFormStatus } from 'react-dom'
import { signOut } from '@/app/actions/session'
import { Button } from '@/components/ui/button'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type='submit' variant='outline' disabled={pending} aria-busy={pending} className='h-11 px-4'>
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
