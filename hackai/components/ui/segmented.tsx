'use client'

import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/* Selector segmentado: pocas vistas de lo mismo (Cursando · Falta final · Aprobadas).
   Va dentro de un <Tabs> y comparte su <TabsContent>. */
export function SegmentedList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 rounded-[14px] bg-hielo p-1', className)} {...props} />
}

export function SegmentedTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1.5 text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-azul-claro data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgb(16_20_44/0.1)]',
        className,
      )}
      {...props}
    />
  )
}
