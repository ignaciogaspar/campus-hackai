/* Dónde va el campo para escribir. En el celular, pegado al borde de abajo: el
   campo queda justo encima de la barra de vidrio (`--tabbar-space`,
   globals.css) y su fondo opaco sigue detrás de ella hasta el borde, así entre
   el campo y la barra no se asoman los mensajes. Mide su alto (DockHeight) y
   la página deja ese lugar abajo para que no tape el último mensaje. Con el
   teclado abierto sube hasta quedar encima del teclado (`--keyboard-inset`, lo mide
   KeyboardInset), que de paso tapa la navegación. En compu, al pie de la
   columna de la conversación, pegado al borde de la ventana mientras se
   scrollea. */
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { DockHeight } from '@/components/spaces/dock-height'
import { KeyboardInset } from '@/components/spaces/keyboard-inset'

export function ComposerDock({ children }: { children: ReactNode }) {
  return (
    <div className='fixed inset-x-0 bottom-[var(--keyboard-inset,0px)] z-10 border-t border-border bg-background px-4 pt-2 pb-[max(0.5rem,calc(var(--tabbar-space)+0.5rem-var(--keyboard-inset,0px)))] lg:sticky lg:bottom-0 lg:z-auto lg:mt-auto lg:border-t-0 lg:bg-card lg:px-0 lg:py-3'>
      <KeyboardInset />
      <DockHeight />
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
