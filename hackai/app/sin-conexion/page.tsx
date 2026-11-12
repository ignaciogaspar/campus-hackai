/* Lo que muestra el service worker (public/sw.js) cuando no hay red, en lugar
   de la pantalla que se pidió. Es estática y no lee la sesión: se guarda una
   vez al instalarse y se sirve igual a cualquiera. */
import { WifiOff } from 'lucide-react'
import type { Metadata } from 'next'
import { OfflineRetry } from '@/components/shell/offline-retry'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState } from '@/components/ui/states'

export const dynamic = 'force-static'

export const metadata: Metadata = { title: 'Sin conexión · Campus HackAI' }

export default function Offline() {
  return (
    <>
      <PageHeader title='Sin conexión' signedOut />
      <main className='flex w-full flex-col items-center gap-4 px-4 pt-6 pb-8 lg:px-6'>
        <EmptyState icon={WifiOff} title='No hay internet'>
          Para ver tus materias, tus notas y los avisos de la cátedra, HackAI necesita conexión. Revisá el wifi o los
          datos: cuando vuelva, la pantalla se recarga sola.
        </EmptyState>
        <OfflineRetry />
      </main>
    </>
  )
}
