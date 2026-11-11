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
  className?: string
}

export function ListItem({ title, description, meta, start, end, className }: ListItemProps) {
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3.5', className)}>
      {start}
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='font-semibold'>{title}</span>
        {description && <span className='line-clamp-2 text-[0.8125rem] text-muted-foreground'>{description}</span>}
        {meta && <span className='mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>{meta}</span>}
      </div>
      {end && <div className='flex flex-none flex-col items-end gap-1.5'>{end}</div>}
    </li>
  )
}
