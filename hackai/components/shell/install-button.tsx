'use client'

import { SquarePlus } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { createInstallStore, HIDDEN, type InstallPrompt } from '@/components/shell/install-state'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

/* Uno por carga, para todos los encabezados (install-state.ts). */
const store = createInstallStore(() => ({
  standalone:
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints,
  onInstallPrompt: (listener) =>
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      listener(e as InstallPrompt)
    })
}))

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
  const { prompt, ios } = useSyncExternalStore(store.subscribe, store.snapshot, () => HIDDEN)

  if (prompt) {
    return (
      <button type='button' className={PILL} onClick={() => prompt.prompt().finally(store.clearPrompt)}>
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
