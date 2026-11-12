'use client'

/* Baja los no leídos de la barra lateral apenas se lee un canal. Next.js no
   vuelve a dibujar el layout al pasar de un canal a otro, así que sus
   contadores quedaban viejos. Si el canal que se abrió tenía no leídos, la
   página del espacio deja la marca `data-just-read` en su <main>, y acá se
   vuelve a leer la página una vez (`router.refresh()`), que redibuja también
   la barra. En las otras pantallas no hace nada.

   Lo nuevo que llega mientras el canal está abierto lo trae ChannelUpdates,
   en la página del espacio. Este vive en el layout de (app): puesto en la
   página, en el build de producción las navegaciones entre canales quedaban
   colgadas. */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { isSpacePath } from '@/components/spaces/format'

/** La marca que deja la página del espacio cuando el canal que abrió tenía no leídos. */
const JUST_READ_SELECTOR = '[data-just-read]'

export function UnreadRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()

  // Cada vez que se abre algo en el espacio (otro canal, un hilo, un filtro), después de dibujarlo.
  const opened = isSpacePath(pathname) ? `${pathname}?${search}` : null
  useEffect(() => {
    if (opened !== null && document.querySelector(JUST_READ_SELECTOR)) router.refresh()
  }, [opened, router])

  return null
}
