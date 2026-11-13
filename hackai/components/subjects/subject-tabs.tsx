/* Las pestañas de la materia, debajo del título: el Espacio (canales) y las
   Tareas. Son enlaces con `aria-current`, así andan sin JavaScript. A 375 px
   caben porque cada pestaña ocupa la mitad. */
import Link from 'next/link'
import { type SubjectTabKey, subjectTabs } from '@/components/subjects/subject-tabs-model'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export function SubjectTabs({
  subjectId,
  current,
  comision
}: {
  subjectId: string
  current: SubjectTabKey
  comision?: string
}) {
  return (
    <nav aria-label='Secciones de la materia' className={cn(railTrack({ size: 'sm' }), 'w-full max-w-md')}>
      {subjectTabs(subjectId, current, comision).map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.current ? 'page' : undefined}
          className={cn(railItem({ size: 'sm' }), 'max-sm:gap-1 max-sm:px-2')}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
