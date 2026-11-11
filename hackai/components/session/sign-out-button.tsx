'use client'

/* Botón para salir: cierra la sesión y vuelve al ingreso. Va sobre el navy del
   encabezado o, en la hoja del perfil, sobre blanco. Es un componente de
   cliente para avisar mientras sale, y porque `Button` trae a `radix-ui` entero
   cuando se importa desde un componente de servidor. */
import { LogOut } from 'lucide-react'
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
  return (
    <Button
      type='submit'
      variant={tone === 'navy' ? 'ghost' : 'outline'}
      disabled={pending}
      aria-busy={pending}
      className={cn('cursor-pointer gap-1.5 font-semibold', TONES[tone])}
    >
      <LogOut aria-hidden='true' strokeWidth={1.8} />
      {pending ? 'Saliendo…' : 'Salir'}
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
