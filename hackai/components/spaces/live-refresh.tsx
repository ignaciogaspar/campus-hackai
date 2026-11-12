'use client'

/* El espacio abierto se actualiza solo: mientras la pestaña está a la vista se
   vuelve a leer cada 10 segundos, y enseguida al volver a ella (la tarea T3,
   «enterarme», pide ver lo nuevo en 15 segundos como mucho). Volver a leer es
   `router.refresh()`: el servidor arma la página de nuevo, con lo que trajo
   del canal externo y de Moodle, y lo que se está escribiendo no se pierde.

   También la barra lateral: Next.js no vuelve a dibujar el layout al pasar de
   un canal a otro, así que sus no leídos quedaban viejos. Cuando el canal que
   se abrió tenía no leídos (`readChannel`), se vuelve a leer una vez para que
   la barra los baje sin esperar al próximo refresco. */
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { refreshWhileVisible } from '@/components/spaces/live-refresh-schedule'

/** Por debajo de los 15 segundos, con margen para lo que tarda el servidor en responder. */
const EVERY_MS = 10_000

export function LiveRefresh({ readChannel }: { readChannel: string | null }) {
  const router = useRouter()

  useEffect(() => refreshWhileVisible(document, () => router.refresh(), EVERY_MS), [router])

  useEffect(() => {
    if (readChannel) router.refresh()
  }, [readChannel, router])

  return null
}
