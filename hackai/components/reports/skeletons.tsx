/* La forma de Reportes mientras carga: la usan los loading.tsx y el Suspense de
   cada pantalla, que vuelve a mostrarla cada vez que cambian los filtros (así
   se nota que los números se están volviendo a contar). */
import { Skeleton } from '@/components/ui/states'

export function FiltersSkeleton() {
  return (
    <div aria-hidden='true' className='flex flex-col gap-3'>
      <Skeleton className='h-12 w-full max-w-lg rounded-full' />
      <div className='flex gap-2'>
        <Skeleton className='h-10 w-44 rounded-full' />
        <Skeleton className='h-10 w-28 rounded-full lg:w-[36rem]' />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div aria-busy='true' className='flex flex-col gap-4'>
      <span role='status' className='sr-only'>
        Contando los alumnos…
      </span>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className='h-32 rounded-[22px]' />
        ))}
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-80 rounded-[22px]' />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div aria-busy='true' className='flex flex-col gap-3'>
      <span role='status' className='sr-only'>
        Buscando alumnos…
      </span>
      <Skeleton className='h-11 rounded-xl' />
      <Skeleton className='h-5 w-40 rounded-full' />
      <div className='flex flex-col gap-2'>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className='h-20 rounded-[18px] lg:h-14' />
        ))}
      </div>
    </div>
  )
}

export function StudentSkeleton() {
  return (
    <div aria-busy='true' className='flex flex-col gap-4'>
      <span role='status' className='sr-only'>
        Armando la ficha…
      </span>
      <Skeleton className='h-12 w-full max-w-2xl rounded-full' />
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-24 rounded-[22px]' />
        ))}
      </div>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
        <Skeleton className='h-96 rounded-[22px]' />
        <Skeleton className='h-96 rounded-[22px]' />
      </div>
    </div>
  )
}
