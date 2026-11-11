/* Avisos de página: el de error y el de estado vacío, con el aspecto de la
   dirección visual «B, Profundo». */
import { TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Algo salió mal y la pantalla no puede mostrar lo que le pidieron. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div role='alert' className='flex items-start gap-3 rounded-[14px] bg-error-suave px-4 py-3 text-[0.8125rem] text-error-tinta'>
      <TriangleAlert aria-hidden='true' className='mt-px size-5 flex-none text-error' strokeWidth={1.8} />
      <p>{children}</p>
    </div>
  )
}

/** No hay nada para mostrar, y dice por qué. */
export function EmptyNotice({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-card bg-card px-4 py-8 text-center text-[0.8125rem] text-muted-foreground'>
      <Icon aria-hidden='true' className='size-7 text-gris-claro' strokeWidth={1.8} />
      <strong className='text-[0.9375rem] text-foreground'>{title}</strong>
      <p className='max-w-[46ch]'>{children}</p>
    </div>
  )
}
