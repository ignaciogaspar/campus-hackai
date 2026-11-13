'use client'

import { SquarePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type InstallPrompt = Event & { prompt: () => Promise<void> }

const PILL =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-white/15 px-2.5 text-xs font-bold text-white hover:bg-white/25 focus-ring lg:hidden'

/* La hoja con los pasos para instalar la app desde el navegador del iPhone o el iPad. */
export function IosInstallSteps() {
  return (
    <SheetContent title='Tené la app en tu celular' description='Se abre desde el ícono, sin el navegador.'>
      <ol className='flex list-decimal flex-col gap-1.5 pl-5 text-[0.8125rem]'>
        <li>
          Tocá <b>Compartir</b> en la barra del navegador.
        </li>
        <li>
          Elegí <b>Agregar a inicio</b>.
        </li>
        <li>
          Abrila desde el ícono <b>Austral</b>.
        </li>
      </ol>
    </SheetContent>
  )
}

/* Botón «Instalar» del encabezado, solo en el navegador del celular. En Android
   abre el aviso del navegador; en el iPhone y el iPad, una hoja con los pasos.
   Instalada la app, o en un navegador que no la instala, no aparece. En los
   celulares de menos de 400 px va solo el ícono: con la campana y el perfil,
   el texto no deja lugar a la facultad de la marca. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return
    // El iPad con iPadOS 13 o más se presenta como Mac: se lo reconoce por la pantalla táctil.
    setIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    )
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    addEventListener('beforeinstallprompt', onPrompt)
    return () => removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (prompt) {
    return (
      <button type='button' className={PILL} onClick={() => prompt.prompt().finally(() => setPrompt(null))}>
        <SquarePlus aria-hidden='true' className='size-4' />
        <span className='max-[399px]:sr-only'>Instalar</span>
      </button>
    )
  }
  if (!ios) return null
  return (
    <Sheet>
      <SheetTrigger className={PILL}>
        <SquarePlus aria-hidden='true' className='size-4' />
        <span className='max-[399px]:sr-only'>Instalar</span>
      </SheetTrigger>
      <IosInstallSteps />
    </Sheet>
  )
}
