'use client'

/* Baja los no leídos de la barra lateral apenas se lee un canal. Next.js no
   vuelve a dibujar el layout al pasar de un canal a otro, así que sus
   contadores quedaban viejos. Si el canal que se abrió tenía no leídos, la
   página del espacio deja la marca `data-just-read` en su <main>, y acá se
   vuelve a leer la página una vez (`router.refresh()`), que redibuja también
   la barra. En las otras pantallas no hace nada.

   Lo nuevo que llega mientras el canal está abierto lo trae ChannelUpdates,
   en la página del espacio: vuelve a pedir la página, que lo marca leído y
   pone la marca otra vez sin que cambie la ruta. Por eso, además de al abrir
   algo, se vuelve a leer cuando la marca aparece en la página. Al releer, el
   canal ya no tiene no leídos, la marca se va y no hay vuelta.

   Este vive en el layout de (app): puesto en la página, en el build de
   producción las navegaciones entre canales quedaban colgadas. */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { isSpacePath } from '@/components/spaces/format'

/** La marca que deja la página del espacio cuando el canal que abrió tenía no leídos. */
const JUST_READ_ATTRIBUTE = 'data-just-read'
const JUST_READ_SELECTOR = `[${JUST_READ_ATTRIBUTE}]`

export function UnreadRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()

  // Cada vez que se abre algo en el espacio (otro canal, un hilo, un filtro), después de dibujarlo.
  const opened = isSpacePath(pathname) ? `${pathname}?${search}` : null
  useEffect(() => {
    if (opened === null) return
    const refreshIfJustRead = () => {
      if (document.querySelector(JUST_READ_SELECTOR)) router.refresh()
    }
    refreshIfJustRead()
    // Con el canal abierto, la marca vuelve a aparecer cuando ChannelUpdates trae algo nuevo.
    const observer = new MutationObserver(refreshIfJustRead)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: [JUST_READ_ATTRIBUTE] })
    return () => observer.disconnect()
  }, [opened, router])

  return null
}
