'use client'

import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

/* Hoja que sube desde abajo, con fondo oscuro detrás. Se cierra con Escape o tocando afuera. */
export function SheetContent({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className='fixed inset-0 z-20 bg-navy/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none' />
      <Dialog.Content className='fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg flex-col gap-4 rounded-t-3xl bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(11_17_80/0.2)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none'>
        <span aria-hidden='true' className='mx-auto h-1 w-10 rounded-full bg-border' />
        <div>
          <Dialog.Title className='text-lg font-extrabold'>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className='text-[0.8125rem] text-muted-foreground'>{description}</Dialog.Description>
          ) : (
            <Dialog.Description className='sr-only'>{title}</Dialog.Description>
          )}
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
