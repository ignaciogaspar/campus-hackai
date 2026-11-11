import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot='card'
      className={cn('overflow-hidden rounded-[22px] bg-card text-card-foreground shadow-card', className)}
      {...props}
    />
  )
}
