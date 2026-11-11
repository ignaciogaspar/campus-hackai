/* Encabezado de página de la dirección visual «B, Profundo»: franja navy con
   las esquinas de abajo redondeadas, la marca arriba, las acciones a la
   derecha y el título de la pantalla. */
import type { ReactNode } from 'react'
import { Brand } from '@/components/shell/brand'

type Props = {
  title: string
  /** Una línea debajo del título. */
  sub?: string
  /** Lo que va debajo de «Universidad Austral»: la facultad o el sistema. */
  brandSub: string
  /** Lo que va arriba a la derecha: avatar, salir. */
  actions?: ReactNode
  /** Lo que va debajo del título, todavía sobre el navy. */
  children?: ReactNode
}

export function PageHeader({ title, sub, brandSub, actions, children }: Props) {
  return (
    <header className='rounded-b-header bg-navy text-white'>
      <div className='mx-auto w-full max-w-5xl px-4 pt-3 pb-6 lg:px-10 lg:pt-5 lg:pb-8'>
        <div className='flex min-h-10 items-center gap-2'>
          <Brand sub={brandSub} />
          {actions && <div className='ml-auto flex items-center gap-2'>{actions}</div>}
        </div>
        <h1 className='mt-5 text-[1.875rem] leading-[1.2] font-extrabold text-balance lg:text-4xl'>{title}</h1>
        {sub && <p className='mt-1.5 max-w-[60ch] text-sm text-pretty text-header-sub lg:text-[0.9375rem]'>{sub}</p>}
        {children && <div className='mt-4 flex flex-wrap gap-2'>{children}</div>}
      </div>
    </header>
  )
}
