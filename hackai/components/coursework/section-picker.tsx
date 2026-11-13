/* Elegir la comisión de la que se ven las tareas, para el docente que dicta
   varias de una materia. Son enlaces a `?comision=`: andan sin JavaScript y el
   riel es el mismo de las demás pestañas. Con una sola comisión no se muestra. */
import Link from 'next/link'
import { sectionLabel, tasksHref } from '@/components/coursework/format'
import { railItem, railTrack } from '@/components/ui/rail'
import type { TaskSection } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

export function SectionPicker({
  subjectId,
  sections,
  selectedId
}: {
  subjectId: string
  sections: TaskSection[]
  selectedId: string
}) {
  if (sections.length < 2) return null
  return (
    <nav aria-label='Comisión' className={cn(railTrack({ size: 'sm' }), 'w-full max-w-md')}>
      {sections.map((s) => (
        <Link
          key={s.sectionId}
          href={tasksHref(subjectId, s.sectionId)}
          aria-current={s.sectionId === selectedId ? 'page' : undefined}
          className={cn(railItem({ size: 'sm' }), 'max-sm:px-2 max-sm:text-[0.75rem]')}
        >
          <span className='truncate'>{sectionLabel(s.name)}</span>
        </Link>
      ))}
    </nav>
  )
}
