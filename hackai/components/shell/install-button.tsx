'use client'

import { Download } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type InstallPrompt = Event & { prompt: () => Promise<void> }

/* Si la app se puede instalar se averigua una vez por carga y queda acá, afuera
   del componente: el encabezado se monta de nuevo en cada pantalla, y si cada
   botón lo averiguara al montarse aparecería tarde en cada navegación. En
   Android además se perdería, porque el navegador avisa una sola vez. */
type Install = { prompt: InstallPrompt | null; ios: boolean }

const HIDDEN: Install = { prompt: null, ios: false }
let install = HIDDEN
let watching = false
const listeners = new Set<() => void>()

function update(next: Partial<Install>) {
  install = { ...install, ...next }
  for (const listener of listeners) listener()
}

function watch() {
  if (watching) return
  watching = true
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return
  // El iPad con iPadOS 13 o más se presenta como Mac: se lo reconoce por la pantalla táctil.
  update({
    ios:
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  })
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    update({ prompt: e as InstallPrompt })
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  watch()
  return () => {
    listeners.delete(listener)
  }
}

const PILL =
  'inline-flex min-h-8 items-center gap-1 rounded-full bg-white/15 px-2.5 text-xs font-bold text-white hover:bg-white/25 focus-ring lg:hidden'

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
      <SheetClose asChild>
        <Button variant='outline'>Listo</Button>
      </SheetClose>
    </SheetContent>
  )
}

/* Botón «Instalar» del encabezado, solo en el navegador del celular. En Android
   abre el aviso del navegador; en el iPhone y el iPad, una hoja con los pasos.
   Instalada la app, o en un navegador que no la instala, no aparece. En los
   celulares de menos de 400 px va solo el ícono: con la campana y el perfil,
   el texto no deja lugar a la facultad de la marca. */
export function InstallButton() {
  const { prompt, ios } = useSyncExternalStore(
    subscribe,
    () => install,
    () => HIDDEN
  )

  if (prompt) {
    return (
      <button type='button' className={PILL} onClick={() => prompt.prompt().finally(() => update({ prompt: null }))}>
        <Download aria-hidden='true' className='size-4' />
        <span className='max-[399px]:sr-only'>Instalar</span>
      </button>
    )
  }
  if (!ios) return null
  return (
    <Sheet>
      <SheetTrigger className={PILL}>
        <Download aria-hidden='true' className='size-4' />
        <span className='max-[399px]:sr-only'>Instalar</span>
      </SheetTrigger>
      <IosInstallSteps />
    </Sheet>
  )
}
