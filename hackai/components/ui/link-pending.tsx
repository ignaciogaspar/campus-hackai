'use client'

/* Lo que muestra un enlace mientras carga la página a la que lleva: una
   ruedita en lugar de lo que tenía (el ícono del canal, el contador de no
   leídos) o, con `overlay`, un velo con la ruedita sobre toda la tarjeta.
   Va adentro de un <Link>: usa `useLinkStatus`, que solo ve el enlace que lo
   contiene. No usamos loading.tsx en el espacio de la materia porque, con él,
   cambiar de canal a veces no se aplicaba en la build de producción.
   Es solo visual: no suma texto al enlace, así su nombre accesible no cambia
   al tocarlo. El «Cargando» para lectores de pantalla lo anuncia la región
   viva de NavigationProgress, que está siempre montada. */
import { LoaderCircle } from 'lucide-react'
import { useLinkStatus } from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle aria-hidden='true' strokeWidth={2} className={cn('flex-none motion-safe:animate-spin', className)} />
  )
}

export function LinkPending({
  children,
  overlay = false,
  className
}: {
  children?: ReactNode
  /** Un velo sobre la tarjeta en vez de cambiar lo de adentro: se posiciona contra el contenedor
      `relative` más cercano, con las esquinas de una tarjeta (`rounded-2xl`). */
  overlay?: boolean
  className?: string
}) {
  const { pending } = useLinkStatus()
  if (overlay) {
    return (
      <>
        {children}
        {pending && (
          <span
            aria-hidden='true'
            className='absolute inset-0 z-10 grid place-items-center rounded-2xl bg-card/70 text-blue motion-safe:animate-in motion-safe:fade-in'
          >
            <Spinner className={cn('size-6', className)} />
          </span>
        )}
      </>
    )
  }
  return pending ? <Spinner className={cn('size-4 text-current', className)} /> : children
}
