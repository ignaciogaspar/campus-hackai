import Link from 'next/link'
import { railItem, railTrack } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

/* Selector de comisión: con dos o más comisiones de la materia, el docente
   elige cuál ver. La elegida va en `?comision=`; cada opción es un enlace, sin
   JavaScript. Con una sola comisión no hace falta y no se muestra. */
export function SectionPicker({
  sections,
  selectedId,
  hrefFor
}: {
  sections: { sectionId: string; name: string }[]
  selectedId: string
  hrefFor: (sectionId: string) => string
}) {
  if (sections.length < 2) return null
  return (
    <nav aria-label='Comisión' className='flex flex-col gap-1.5 lg:max-w-xl'>
      <span aria-hidden='true' className='px-1 text-xs font-semibold text-muted-foreground'>
        Comisión
      </span>
      <div className={cn(railTrack({ size: 'sm' }), 'w-full overflow-x-auto')}>
        {sections.map((s) => (
          <Link
            key={s.sectionId}
            href={hrefFor(s.sectionId)}
            aria-current={s.sectionId === selectedId ? 'page' : undefined}
            className={cn(railItem({ size: 'sm' }), 'min-h-11 max-sm:px-2')}
          >
            <span className='truncate'>{s.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
