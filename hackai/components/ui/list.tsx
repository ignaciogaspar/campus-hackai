import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function List({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('divide-y divide-border', className)} {...props} />
}

type ListItemProps = {
  title: ReactNode
  description?: ReactNode
  /** Línea chica debajo: origen, materia, hora. */
  meta?: ReactNode
  /** A la izquierda: ícono, día, sigla. */
  start?: ReactNode
  /** A la derecha: contador, botón, etiqueta. */
  end?: ReactNode
  /** Si la fila lleva a algún lado: toda la fila es el enlace, con foco visible y una flecha. */
  href?: string
  className?: string
}

export function ListItem({ href, className, ...content }: ListItemProps) {
  if (!href) {
    return (
      <li className={cn('flex items-start gap-3 px-4 py-3.5', className)}>
        <ItemContent {...content} />
      </li>
    )
  }
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex items-start gap-3 px-4 py-3.5 text-foreground transition-colors duration-150 hover:bg-blue/[0.04] focus-ring-inset',
          className
        )}
      >
        <ItemContent {...content} />
        <ChevronRight
          aria-hidden='true'
          className='size-5 flex-none self-center text-gray-light transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-blue motion-reduce:transition-none'
          strokeWidth={1.8}
        />
      </Link>
    </li>
  )
}

function ItemContent({ title, description, meta, start, end }: Omit<ListItemProps, 'href' | 'className'>) {
  return (
    <>
      {start}
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='font-semibold'>{title}</span>
        {description && <span className='line-clamp-2 text-[0.8125rem] text-muted-foreground'>{description}</span>}
        {meta && (
          <span className='mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>{meta}</span>
        )}
      </div>
      {end && <div className='flex flex-none flex-col items-end gap-1.5'>{end}</div>}
    </>
  )
}
