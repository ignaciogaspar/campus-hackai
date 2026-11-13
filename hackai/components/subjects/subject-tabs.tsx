import Link from 'next/link'
import { subjectTabHref, tabsFor } from '@/components/subjects/subject-nav'
import { railItem, railTrack } from '@/components/ui/rail'
import { RailScroller } from '@/components/ui/rail-scroller'
import { cn } from '@/lib/utils'

/* Barra de pestañas de la materia: el espacio, los alumnos y las calificaciones (solo el docente) y las
   tareas. Cada una es una ruta
   debajo de la materia y todas conservan la comisión elegida (`?comision=`).
   Son enlaces. Cada pestaña mide al menos lo que su nombre: si con la letra grande no entran todas, el riel se
   desliza de costado (RailScroller deja a la vista la elegida) en vez de pisar un nombre con el otro. */
export function SubjectTabs({
  subjectId,
  current,
  comision,
  role = 'profesor'
}: {
  subjectId: string
  current: string
  comision?: string
  role?: 'alumno' | 'profesor'
}) {
  return (
    <nav aria-label='Secciones de la materia' className='w-full lg:max-w-xl'>
      <RailScroller className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto [scrollbar-width:none]')}>
        {tabsFor(role).map((tab) => (
          <Link
            key={tab.id}
            href={subjectTabHref(subjectId, tab, comision)}
            aria-current={tab.id === current ? 'page' : undefined}
            className={cn(
              railItem({ size: 'sm' }),
              'min-h-11 min-w-max max-sm:flex-auto max-sm:gap-1 max-sm:px-2 max-sm:text-[0.75rem]'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </RailScroller>
    </nav>
  )
}
