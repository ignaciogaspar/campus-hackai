/* Dónde va el campo para escribir. En el celular, pegado abajo, justo encima
   de la navegación inferior (AppNav: 67 px más el borde seguro del teléfono);
   la página deja lugar abajo para que no tape el último mensaje. En compu, al
   pie de la columna de la conversación, pegado al borde de la ventana mientras
   se scrollea. */
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'

export function ComposerDock({ children }: { children: ReactNode }) {
  return (
    <div className='fixed inset-x-0 bottom-[calc(67px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-background px-4 py-2 lg:sticky lg:bottom-0 lg:z-auto lg:mt-auto lg:border-t-0 lg:bg-card lg:px-0 lg:py-3'>
      <div>{children}</div>
    </div>
  )
}

/** En lugar del campo, cuando la persona no puede escribir en el canal. */
export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className='flex items-center gap-2 rounded-[14px] bg-muted p-3 text-[0.8125rem] text-muted-foreground'>
      <Lock aria-hidden='true' className='size-4 flex-none' strokeWidth={1.8} />
      {children}
    </p>
  )
}
