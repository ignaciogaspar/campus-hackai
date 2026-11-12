'use client'

import { RotateCw } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/* «Reintentar» de la pantalla sin conexión. La barra sigue mostrando la
   dirección que se había pedido, así que recargar abre esa pantalla si volvió
   la red. También recarga sola cuando el navegador avisa que volvió. */
export function OfflineRetry() {
  useEffect(() => {
    const reload = () => location.reload()
    addEventListener('online', reload)
    return () => removeEventListener('online', reload)
  }, [])

  return (
    <Button onClick={() => location.reload()}>
      <RotateCw aria-hidden='true' />
      Reintentar
    </Button>
  )
}
