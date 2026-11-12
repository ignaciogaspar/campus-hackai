'use client'

/* El espacio abierto se actualiza solo: mientras la pestaña está a la vista se
   vuelve a leer cada 6 segundos, y enseguida al volver a ella (la tarea T3,
   «enterarme», pide ver lo nuevo en 15 segundos como mucho). Volver a leer es
   `router.refresh()`: el servidor arma la página y la barra lateral de nuevo,
   con lo nuevo de HackAI y lo que trajo de Moodle, y lo que se está
   escribiendo no se pierde. En las otras pantallas no hace nada. Lo del canal
   externo entra por el mismo camino cuando exista la sincronización (#15).

   Vive en el layout de (app), no en la página: así sigue andando, sin volver a
   empezar, al pasar de un canal a otro. Puesto en la página, en el build de
   producción las navegaciones entre canales quedaban colgadas hasta el
   siguiente refresco.

   La barra lateral: Next.js no la vuelve a dibujar al pasar de un canal a otro,
   así que sus no leídos quedaban viejos. Si el canal que se abrió tenía no
   leídos, la página lo marca (JUST_READ_SELECTOR) y se vuelve a leer una vez
   para que la barra los baje sin esperar al próximo refresco. */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { isSpacePath } from '@/components/spaces/format'
import { JUST_READ_SELECTOR, refreshWhileVisible } from '@/components/spaces/live-refresh-schedule'

/** Espacios no vuelve a Moodle más de una vez cada 10 segundos por espacio
    (`open`): con un refresco cada 6, lo nuevo llega en 12 como mucho, por
    debajo de los 15, con margen para lo que tarda el servidor. */
const EVERY_MS = 6_000

export function LiveRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const inSpace = isSpacePath(pathname)

  useEffect(
    () => (inSpace ? refreshWhileVisible(document, () => router.refresh(), EVERY_MS) : undefined),
    [inSpace, router]
  )

  // Cada vez que se abre algo en el espacio (otro canal, un hilo, un filtro), después de dibujarlo.
  const opened = inSpace ? `${pathname}?${search}` : null
  useEffect(() => {
    if (opened !== null && document.querySelector(JUST_READ_SELECTOR)) router.refresh()
  }, [opened, router])

  return null
}
