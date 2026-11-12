'use client'

import { CircleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'

/* Un error inesperado en una pantalla de adentro: sin detalles técnicos y con Reintentar. */
export default function ScreenError({ reset }: { reset: () => void }) {
  const router = useRouter()
  const retry = () =>
    startTransition(() => {
      router.refresh()
      reset()
    })
  return (
    <main className='flex w-full flex-col items-center gap-4 px-4 pt-6 pb-16 lg:px-6'>
      <EmptyState icon={CircleAlert} title='No pudimos mostrar esta pantalla'>
        Algo falló de nuestro lado. Probá de nuevo y, si sigue igual, volvé en un rato.
      </EmptyState>
      <Button onClick={retry}>Reintentar</Button>
    </main>
  )
}
