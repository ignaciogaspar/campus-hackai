'use client'

import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

/* Selector segmentado: pocas vistas de lo mismo (Cursando · Falta final · Aprobadas),
   con la forma del riel chico (components/ui/rail.tsx). Va dentro de un <Tabs>
   y comparte su <TabsContent>. */
export function SegmentedList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn(railTrack({ size: 'sm' }), className)} {...props} />
}

export function SegmentedTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={railItem({ size: 'sm', className })} {...props} />
}
