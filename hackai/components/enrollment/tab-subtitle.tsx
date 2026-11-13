'use client'
/* El subtítulo de Inscripciones, según la pestaña: en exámenes no hay comisión
   ni aula. Lee la URL en el navegador porque las pestañas cambian sin volver al
   servidor. Con una materia elegida, en el celular no va: así el detalle y su
   botón quedan más arriba. */
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export function TabSubtitle() {
  const params = useSearchParams()
  const exams = params.get('tab') === 'examenes'
  return (
    <span className={cn(params.get('materia') && 'max-lg:hidden')}>
      {exams
        ? 'Elegí la materia y la mesa: quedás inscripto al final en el SIU.'
        : 'Elegí la materia y la comisión: quedás inscripto en el SIU y en el aula del Campus Virtual a la vez.'}
    </span>
  )
}
