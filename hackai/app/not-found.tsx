import { Compass } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shell/page-header'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'

export default function NotFound() {
  return (
    <>
      <PageHeader title='Esta pantalla todavía no está' />
      <main className='flex w-full flex-col items-center gap-4 px-4 pt-6 pb-8 lg:px-6'>
        <EmptyState icon={Compass} title='No encontramos lo que buscabas'>
          Puede que la estemos armando o que el enlace esté mal. Volvé al inicio y seguí desde ahí.
        </EmptyState>
        <Link href='/' className={buttonVariants()}>
          Ir al inicio
        </Link>
      </main>
    </>
  )
}
