import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Brand } from '@/components/shell/brand'

type Props = {
  title: string
  /** Línea chica arriba del título, por ejemplo la fecha o la facultad. */
  kicker?: string
  /** La facultad de quien entra, para la marca. */
  school: string
  /** Pantallas que no son de primer nivel: en la app instalada no hay atrás del navegador. */
  backHref?: string
  /** Arriba a la derecha: novedades, perfil. */
  actions?: ReactNode
  /** Debajo del título, sobre el navy: chips de comisión, docente. */
  children?: ReactNode
}

export function PageHeader({ title, kicker, school, backHref, actions, children }: Props) {
  return (
    <header className='rounded-b-[28px] bg-navy text-white'>
      <div className='mx-auto grid max-w-280 grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 pt-3 pb-6 lg:px-10 lg:pt-5'>
        <div className='flex min-h-10 items-center lg:hidden'>
          {backHref ? (
            <Link
              href={backHref}
              aria-label='Volver'
              className='-ml-2 grid size-10 place-items-center rounded-full text-white hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-azul-claro focus-visible:outline-none'
            >
              <ChevronLeft aria-hidden='true' className='size-5' />
            </Link>
          ) : (
            <Brand school={school} />
          )}
        </div>
        {actions && <div className='col-start-2 row-start-1 flex items-center gap-1 lg:row-span-3'>{actions}</div>}
        <div className='col-start-1 mt-2 lg:mt-0'>
          {kicker && <p className='text-[0.8125rem] text-white/75'>{kicker}</p>}
          <h1 className='mt-0.5 text-3xl leading-tight font-extrabold text-balance lg:text-[1.75rem]'>{title}</h1>
        </div>
        {children && <div className='col-start-1 mt-3 flex flex-wrap gap-2'>{children}</div>}
      </div>
    </header>
  )
}
