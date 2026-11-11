'use client'

import { ChevronRight } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import type { ReactNode } from 'react'

/* Tarjeta que se pliega: secciones de material, aprobadas por año. */
export function CollapsibleCard({ title, count, defaultOpen, children }: { title: string; count?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className='group overflow-hidden rounded-[22px] bg-card shadow-card'>
      <Collapsible.Trigger className='flex w-full items-center gap-2 px-4 py-3.5 text-left font-bold outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-azul-claro'>
        <ChevronRight aria-hidden='true' className='size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none' />
        {title}
        {count && <span className='ml-auto text-xs font-semibold text-muted-foreground'>{count}</span>}
      </Collapsible.Trigger>
      <Collapsible.Content className='border-t border-border'>{children}</Collapsible.Content>
    </Collapsible.Root>
  )
}
