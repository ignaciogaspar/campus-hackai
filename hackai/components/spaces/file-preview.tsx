'use client'
/* Vista previa de un archivo del espacio sin salir de HackAI: un PDF o una
   imagen se abren en un panel grande, con «Descargar» y «Abrir en otra
   pestaña». En compu es una ventana centrada; en el celular ocupa toda la
   pantalla. Solo se previsualiza lo que sale de nuestro origen (los archivos
   de /archivos/ y el material de Moodle de la demo): un enlace a otro sitio
   no se deja embeber, así que se abre en otra pestaña como antes. */
import { Download, ExternalLink, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import type { PreviewKind } from '@/components/spaces/preview-kind'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FilePreview({
  url,
  name,
  kind,
  detail,
  className,
  children
}: {
  url: string
  name: string
  kind: PreviewKind
  /** Debajo del nombre, en el panel: el origen, el tamaño, la fecha. */
  detail?: ReactNode
  className?: string
  /** Lo que se toca para abrirlo: la fila del material o el adjunto. */
  children: ReactNode
}) {
  // El material de Moodle se llama como el recurso («Guía de ejercicios 1»): al bajarlo, que lleve la extensión.
  const fileName = kind === 'pdf' && !/\.pdf$/i.test(name) ? `${name}.pdf` : name
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn('w-full cursor-pointer text-left', className)}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 z-20 bg-navy/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none' />
        <Dialog.Content className='fixed inset-0 z-30 flex flex-col bg-card outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none lg:inset-x-[max(2rem,calc((100vw-72rem)/2))] lg:inset-y-8 lg:overflow-hidden lg:rounded-3xl lg:shadow-[0_24px_60px_rgb(11_17_80/0.35)]'>
          <div className='flex flex-wrap items-center gap-3 border-b border-border px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:px-6 lg:pt-4'>
            <div className='min-w-0 flex-1'>
              <Dialog.Title className='truncate text-base font-extrabold text-ink lg:text-lg'>{name}</Dialog.Title>
              <Dialog.Description asChild>
                <div className='flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted-foreground'>
                  {detail ?? 'Vista previa del archivo'}
                </div>
              </Dialog.Description>
            </div>
            <div className='flex items-center gap-2'>
              <a
                href={url}
                download={fileName}
                className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 font-semibold')}
              >
                <Download aria-hidden='true' data-icon='inline-start' />
                Descargar
              </a>
              <a
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 max-sm:hidden')}
              >
                <ExternalLink aria-hidden='true' data-icon='inline-start' />
                Abrir en otra pestaña
              </a>
              <Dialog.Close
                aria-label='Cerrar la vista previa'
                className='grid size-11 cursor-pointer place-items-center rounded-full text-ink hover:bg-muted focus-ring'
              >
                <X aria-hidden='true' className='size-5' />
              </Dialog.Close>
            </div>
          </div>
          <div className='min-h-0 flex-1 bg-ice'>
            {kind === 'pdf' ? (
              <iframe src={url} title={`Vista previa de ${name}`} className='size-full border-0' />
            ) : (
              <div className='grid size-full place-items-center overflow-auto p-4'>
                {/* biome-ignore lint/performance/noImgElement: un archivo subido, de tamaño desconocido: next/image no aplica. */}
                <img src={url} alt={name} className='max-h-full max-w-full rounded-lg object-contain shadow-card' />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
