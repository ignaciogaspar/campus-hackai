/* Cargando de una pantalla de adentro: el encabezado con su título y la forma
   de lo que va a aparecer. La campana va sin número para no leer nada.

   El encabezado tiene que medir lo mismo que el de la pantalla que llega: si es
   más bajo, al terminar de cargar todo lo de abajo pega un salto. Por eso cada
   loading.tsx le pasa lo mismo que su page.tsx (subtítulo, ilustración, flecha
   de volver) y, donde el texto depende de los datos, un marcador del mismo alto
   (`HeaderLine`, `HeaderChip`). Si cambiás el encabezado de una pantalla,
   cambiá también el de su loading.tsx. */
import type { ComponentProps } from 'react'
import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/utils'

type HeaderProps = Pick<
  ComponentProps<typeof PageHeader>,
  'subtitle' | 'icon' | 'art' | 'backHref' | 'hideBackOnDesktop' | 'desktopBell' | 'children'
>

/** En el lugar de un subtítulo que depende de los datos: ocupa una línea, como el texto que llega. */
export function HeaderLine({ className }: { className?: string }) {
  return (
    <span aria-hidden='true' className={cn('inline-block h-3 w-44 rounded-full bg-white/15 align-middle', className)} />
  )
}

/** En el lugar del chip o del botón de abajo del título. El alto va por `className`, igual al de lo que llega. */
export function HeaderChip({ className }: { className?: string }) {
  return <span aria-hidden='true' className={cn('h-10 w-56 max-w-full rounded-full bg-white/12', className)} />
}

/** En el lugar del ícono de la izquierda del título, del tamaño del de Hoy. */
export function HeaderIcon() {
  return <span aria-hidden='true' className='size-11 flex-none rounded-xl bg-white/10' />
}

/** La forma del contenido mientras carga. La usan el loading.tsx y el `Suspense` de la misma pantalla, así entre
    uno y otro no se mueve nada. */
export function SkeletonRows({
  label = 'Cargando…',
  tiles = false,
  lead = false
}: {
  label?: string
  tiles?: boolean
  lead?: boolean
}) {
  return (
    <>
      <span role='status' className='sr-only'>
        {label}
      </span>
      {lead && <Skeleton className='h-32 rounded-[22px]' />}
      <div className={cn('gap-3', tiles ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cn('rounded-[22px]', tiles ? 'h-36' : 'h-20')} />
        ))}
      </div>
    </>
  )
}

export function ScreenSkeleton({
  title,
  tiles = false,
  lead = false,
  children,
  ...header
}: {
  title: string
  tiles?: boolean
  lead?: boolean
} & HeaderProps) {
  return (
    <>
      <PageHeader title={title} unread={0} {...header}>
        {children}
      </PageHeader>
      <main aria-busy='true' className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        <SkeletonRows tiles={tiles} lead={lead} />
      </main>
    </>
  )
}
