'use client'

/* Un panel chico que sale de un botón, como el menú de la cuenta al pie de la
   barra lateral. Es Radix Popover, que ya viene en `radix-ui`: se abre con
   Enter o Espacio, se cierra con Escape o tocando afuera y devuelve el foco al
   botón. Se ve como el menú de los desplegables (components/ui/select.tsx). */
import { Popover as Radix } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Popover = Radix.Root
export const PopoverTrigger = Radix.Trigger

export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-40 rounded-2xl bg-card text-ink shadow-[0_0_0_1px_rgb(11_17_80/0.05),0_12px_32px_-8px_rgb(11_17_80/0.18),0_4px_10px_-4px_rgb(11_17_80/0.08)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none',
          className
        )}
        {...props}
      />
    </Radix.Portal>
  )
}
