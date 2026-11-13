'use client'

/* El aviso de que la tarea recién creada quedó publicada, arriba de la lista.
   Saca `?creada=` de la dirección apenas se muestra: al recargar o al volver a
   la lista, el aviso ya no está y no parece que se creó otra. */
import { useEffect } from 'react'
import { SuccessNotice } from '@/components/ui/states'

export function CreatedNotice({ name, audience }: { name: string; audience: string }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('creada')) return
    url.searchParams.delete('creada')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  return (
    <SuccessNotice>
      <p>
        <strong className='font-bold'>Publicaste «{name}».</strong> Ya la ven los alumnos de {audience}.
      </p>
    </SuccessNotice>
  )
}
