/* Una ruta que no existe. Se dibuja fuera de las pantallas de adentro, sin
   barra de navegación, así que el encabezado va como sin sesión: con la marca
   y sin campana. Ofrece un solo camino que siempre existe: con sesión, la
   pantalla de inicio de su rol; sin sesión, el ingreso. */
import { Compass } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'
import { getSession, homeFor } from '@/lib/auth'

export default async function NotFound() {
  const session = await getSession()

  return (
    <>
      <PageHeader title='No encontramos esta pantalla' signedOut />
      <main className='flex w-full flex-col items-center gap-4 px-4 pt-6 pb-8 lg:px-6'>
        <EmptyState icon={Compass} title='Este enlace no lleva a ningún lado'>
          Puede que esté mal escrito o que lo que buscabas ya no esté. Seguí desde{' '}
          {session ? 'tu inicio' : 'el ingreso'}.
        </EmptyState>
        <Link href={session ? homeFor(session.role) : '/'} className={buttonVariants()}>
          {session ? 'Ir al inicio' : 'Ir al ingreso'}
        </Link>
      </main>
    </>
  )
}
