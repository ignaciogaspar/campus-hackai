/* Avisos de página: el de error y el de estado vacío. Son provisorios, con el
   mismo aspecto que los de Mis materias, hasta que el sistema visual (#8)
   traiga los componentes base. */
import type { ReactNode } from 'react'

/** Algo salió mal y la pantalla no puede mostrar lo que le pidieron. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm'>
      {children}
    </p>
  )
}

/** No hay nada para mostrar, y dice por qué. */
export function EmptyNotice({ children }: { children: ReactNode }) {
  return (
    <p className='rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
      {children}
    </p>
  )
}
