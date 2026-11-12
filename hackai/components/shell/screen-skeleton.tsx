/* Cargando de una pantalla de adentro: el encabezado con su título y la forma
   de lo que va a aparecer. La campana va sin número para no leer nada. */
import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

export function ScreenSkeleton({
  title,
  tiles = false,
  lead = false
}: {
  title: string
  tiles?: boolean
  lead?: boolean
}) {
  return (
    <>
      <PageHeader title={title} unread={0} />
      <main aria-busy='true' className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <span role='status' className='sr-only'>
          Cargando…
        </span>
        {lead && <Skeleton className='h-32 rounded-[22px]' />}
        <div className={cn('gap-3', tiles ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={cn('rounded-[22px]', tiles ? 'h-36' : 'h-20')} />
          ))}
        </div>
      </main>
    </>
  )
}
