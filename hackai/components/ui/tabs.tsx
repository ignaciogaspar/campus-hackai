'use client'

import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

/* Pestañas con la forma del riel (components/ui/rail.tsx): la elegida en
   relieve sobre el carril gris. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn(railTrack({ size: 'sm' }), className)} {...props} />
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={railItem({ size: 'sm', className })} {...props} />
}
