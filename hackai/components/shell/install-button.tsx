'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type InstallPrompt = Event & { prompt: () => Promise<void> }

const PILL = 'inline-flex min-h-8 items-center gap-1 rounded-full bg-white/15 px-2.5 text-xs font-bold text-white hover:bg-white/25 focus-visible:ring-3 focus-visible:ring-azul-claro focus-visible:outline-none lg:hidden'

/* Botón «Instalar» del encabezado, solo en el navegador del celular. En Android
   abre el aviso del navegador; en el iPhone, una hoja con los pasos de Safari.
   Instalada la app, o en un navegador que no la instala, no aparece. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    addEventListener('beforeinstallprompt', onPrompt)
    return () => removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (prompt) {
    return (
      <button type='button' className={PILL} onClick={() => prompt.prompt().then(() => setPrompt(null))}>
        <Download aria-hidden='true' className='size-4' /> Instalar
      </button>
    )
  }
  if (!ios) return null
  return (
    <Sheet>
      <SheetTrigger className={PILL}>
        <Download aria-hidden='true' className='size-4' /> Instalar
      </SheetTrigger>
      <SheetContent title='Tené la app en tu celular' description='Se abre desde el ícono, sin el navegador.'>
        <ol className='flex list-decimal flex-col gap-1.5 pl-5 text-[0.8125rem]'>
          <li>Tocá <b>Compartir</b> en la barra de Safari.</li>
          <li>Elegí <b>Agregar a inicio</b>.</li>
          <li>Abrila desde el ícono <b>Austral</b>.</li>
        </ol>
        <SheetClose asChild>
          <Button variant='outline'>Listo</Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}
