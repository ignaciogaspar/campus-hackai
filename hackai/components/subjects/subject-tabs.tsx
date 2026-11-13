import Link from 'next/link'
import { SUBJECT_TABS, subjectTabHref } from '@/components/subjects/subject-nav'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

/* Barra de pestañas de la materia del docente: el espacio, los alumnos y, a
   medida que se suman, las tareas y las calificaciones. Cada una es una ruta
   debajo de la materia y todas conservan la comisión elegida (`?comision=`).
   Son enlaces, sin JavaScript. */
export function SubjectTabs({
  subjectId,
  current,
  comision
}: {
  subjectId: string
  current: string
  comision?: string
}) {
  return (
    <nav aria-label='Secciones de la materia' className={cn(railTrack({ size: 'sm' }), 'w-full lg:max-w-xl')}>
      {SUBJECT_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={subjectTabHref(subjectId, tab, comision)}
          aria-current={tab.id === current ? 'page' : undefined}
          className={cn(railItem({ size: 'sm' }), 'min-h-11 max-sm:gap-1 max-sm:px-2 max-sm:text-[0.75rem]')}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
