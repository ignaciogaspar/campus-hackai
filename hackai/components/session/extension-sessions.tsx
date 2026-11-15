'use client'
/* Las piezas de entrar con la extensión de HackAI (ADR 0011): saber si está, avisar mientras la persona inicia
   sesión en la pestaña que abrió la extensión, y el paso a paso para copiar la cookie a mano, que con la extensión
   queda plegado. */
import { type ReactNode, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { hasSessionExtension } from '@/components/session/session-extension'
import { Button } from '@/components/ui/button'

/** Si la extensión está: `null` mientras no se sabe (en el servidor y antes de hidratar). */
export function useHasExtension(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null)
  useEffect(() => setHas(hasSessionExtension()), [])
  return has
}

/** El paso a paso para copiar la cookie. Con la extensión queda plegado, como alternativa. */
export function ManualSteps({ folded, children }: { folded: boolean; children: ReactNode }) {
  if (!folded) return <>{children}</>
  return (
    <details className='flex flex-col gap-3 text-[0.875rem] text-ink'>
      <summary className='cursor-pointer font-semibold text-blue focus-ring'>Pegar la sesión a mano</summary>
      <div className='mt-3 flex flex-col gap-5'>{children}</div>
    </details>
  )
}

/** Sin extensión, que existe y qué resuelve. */
export function ExtensionHint() {
  return (
    <p className='text-[0.8125rem] text-pretty text-steel'>
      Con la extensión de HackAI para Chrome no hace falta copiar nada: te lleva a iniciar sesión en la Austral y entrás
      solo.
    </p>
  )
}

/** Mientras la extensión espera que la persona entre con su cuenta en la otra pestaña. */
export function SignInNotice({ show }: { show: boolean }) {
  const { pending } = useFormStatus()
  if (!show || !pending) return null
  return (
    <p role='status' className='rounded-xl bg-accent px-3 py-2.5 text-[0.875rem] text-pretty text-ink'>
      Si se abrió una pestaña de la Austral, iniciá sesión ahí con tu cuenta de Microsoft. Cuando entres, se cierra sola
      y volvés acá.
    </p>
  )
}

/** El botón de enviar, ocupado mientras la acción corre, incluido el inicio de sesión con la extensión. */
export function SubmitButton({ idle, busy, disabled }: { idle: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type='submit' size='lg' disabled={pending || disabled} className='min-h-11 self-start font-semibold'>
      {pending ? busy : idle}
    </Button>
  )
}
