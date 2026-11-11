'use client'

import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

/* Pestañas en pastilla que se deslizan de costado si no entran. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none]', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex min-h-10 flex-none items-center gap-1.5 rounded-full bg-card px-4 text-[0.8125rem] font-semibold text-muted-foreground shadow-[0_1px_2px_rgb(11_17_80/0.08)] focus-ring-inset data-[state=active]:bg-blue data-[state=active]:text-white [&[data-state=active]>span]:bg-white [&[data-state=active]>span]:text-blue',
        className
      )}
      {...props}
    />
  )
}
