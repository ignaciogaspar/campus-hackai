/* Mientras se abre el espacio: la forma de lo que va a aparecer, sin spinner.
   El encabezado navy, las pestañas y dos tarjetas de mensaje. */
import { Skeleton } from '@/components/ui/states'

function MessageSkeleton() {
  return (
    <div className='flex gap-3 rounded-[22px] bg-card p-4 shadow-card'>
      <Skeleton className='size-9 flex-none rounded-full' />
      <div className='flex flex-1 flex-col gap-2'>
        <Skeleton className='h-3.5 w-40' />
        <Skeleton className='h-3.5 w-full' />
        <Skeleton className='h-3.5 w-2/3' />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div role='status' aria-label='Abriendo el espacio de la materia'>
      <div className='rounded-b-[28px] bg-navy'>
        <div className='mx-auto flex max-w-280 flex-col gap-3 px-4 pt-[calc(4.25rem+env(safe-area-inset-top))] pb-6 lg:px-10 lg:pt-5'>
          <div aria-hidden='true' className='h-3 w-32 rounded-md bg-white/15 motion-safe:animate-pulse' />
          <div aria-hidden='true' className='h-8 w-64 max-w-full rounded-md bg-white/15 motion-safe:animate-pulse' />
          <div aria-hidden='true' className='h-6 w-48 rounded-full bg-white/10 motion-safe:animate-pulse' />
        </div>
      </div>
      <div className='mx-auto grid w-full max-w-280 gap-4 px-4 pt-5 lg:grid-cols-[220px_minmax(0,1fr)_280px] lg:gap-6 lg:px-10 lg:pt-8'>
        <div className='flex gap-2 overflow-hidden lg:flex-col'>
          <Skeleton className='h-10 w-24 flex-none rounded-full lg:w-full' />
          <Skeleton className='h-10 w-28 flex-none rounded-full lg:w-full' />
          <Skeleton className='h-10 w-24 flex-none rounded-full lg:w-full' />
        </div>
        <div className='flex flex-col gap-3'>
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
        <Skeleton className='hidden h-48 rounded-[22px] lg:block' />
      </div>
    </div>
  )
}
