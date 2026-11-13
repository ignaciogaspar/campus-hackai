'use client'

/* «Cerrar sesión»: cierra la sesión y vuelve al ingreso, que avisa que se
   cerró. Va en la hoja del perfil (celular), en el menú de la cuenta al pie de
   la barra lateral (compu) o sobre el navy cuando no hay perfil que mostrar. Es un componente de cliente para avisar mientras
   sale, y porque `Button` trae a `radix-ui` entero cuando se importa desde un
   componente de servidor. */
import { LoaderCircle, LogOut } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { signOut } from '@/app/actions/session'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONES = {
  navy: 'h-10 rounded-full bg-white/[0.14] px-4 text-[0.8125rem] text-white hover:bg-white/25 hover:text-white',
  light: 'w-full'
}

function Submit({ tone }: { tone: keyof typeof TONES }) {
  const { pending } = useFormStatus()
  const Icon = pending ? LoaderCircle : LogOut
  return (
    <Button
      type='submit'
      variant={tone === 'light' ? 'outline' : 'ghost'}
      disabled={pending}
      aria-busy={pending}
      className={cn('cursor-pointer gap-1.5 font-semibold', TONES[tone])}
    >
      <Icon aria-hidden='true' strokeWidth={1.8} className={cn(pending && 'motion-safe:animate-spin')} />
      {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </Button>
  )
}

export function SignOutButton({ tone = 'navy', className }: { tone?: keyof typeof TONES; className?: string }) {
  return (
    <form action={signOut} className={className}>
      <Submit tone={tone} />
    </form>
  )
}
