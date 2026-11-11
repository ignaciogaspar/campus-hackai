/* Botón para salir: cierra la sesión y vuelve al ingreso. */
import { signOut } from '@/app/actions/session'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type='submit' variant='outline' className='h-11 px-4'>Salir</Button>
    </form>
  )
}
