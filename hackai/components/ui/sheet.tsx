'use client'

import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

const SIDES = {
  /** Sube desde abajo: menús cortos y acciones. */
  bottom:
    'inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(11_17_80/0.2)] data-[state=open]:slide-in-from-bottom',
  /** En el celular sube desde abajo; en compu es un panel a la derecha, a todo lo alto, para leer un detalle sin perder la lista. */
  right:
    'inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(11_17_80/0.2)] data-[state=open]:slide-in-from-bottom lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-3xl lg:pt-6 lg:pb-6 lg:shadow-[-8px_0_30px_rgb(11_17_80/0.18)] lg:data-[state=open]:slide-in-from-right'
}

/* Hoja con fondo oscuro detrás. Se cierra con «Cerrar», arriba a la derecha
   (en el celular no hay Escape), con Escape o tocando afuera. «Cerrar» va
   antes que el contenido, así que es lo primero que recibe el foco al abrir:
   nunca un botón que hace algo, como «Cerrar sesión». Al cerrar, el foco vuelve al
   disparador (SheetTrigger) o adonde diga `onCloseAutoFocus`. */
export function SheetContent({
  title,
  description,
  side = 'bottom',
  closeButton = true,
  onCloseAutoFocus,
  children
}: {
  title: string
  description?: string
  side?: keyof typeof SIDES
  /** `false` en una hoja que ya trae su propio botón para cerrar. */
  closeButton?: boolean
  /** Al cerrarse, a dónde va el foco: por defecto vuelve al botón que la abrió; `preventDefault` lo deja a cargo
      de quien la usa, como la tarjeta de Notas que abrió la hoja. */
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>['onCloseAutoFocus']
  children: ReactNode
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className='fixed inset-0 z-20 bg-navy/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none' />
      <Dialog.Content
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          'fixed z-30 flex flex-col gap-4 bg-card px-5 outline-none data-[state=open]:animate-in motion-reduce:animate-none',
          SIDES[side]
        )}
      >
        <span
          aria-hidden='true'
          className={cn('mx-auto h-1 w-10 flex-none rounded-full bg-border', side === 'right' && 'lg:hidden')}
        />
        <div className='flex items-start gap-3'>
          <div className='min-w-0 flex-1 pt-1.5'>
            <Dialog.Title className='text-lg leading-snug font-extrabold text-pretty'>{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className='text-[0.8125rem] text-muted-foreground'>{description}</Dialog.Description>
            ) : (
              <Dialog.Description className='sr-only'>{title}</Dialog.Description>
            )}
          </div>
          {closeButton && (
            <Dialog.Close
              aria-label='Cerrar'
              title='Cerrar'
              className='-mr-2 grid size-11 flex-none cursor-pointer place-items-center rounded-full text-ink transition-colors hover:bg-accent focus-ring'
            >
              <X aria-hidden='true' className='size-5' strokeWidth={2} />
            </Dialog.Close>
          )}
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
