import { cn } from '@/lib/utils'

/* La nota en un recuadro, como en «Aprobadas» de los mocks. Sin nota (ausente
   o todavía sin cargar) lo dice con texto, no con una raya muda. */
export function GradeBadge({ grade, size = 'md' }: { grade: number | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-16' : 'size-10'
  if (grade === null) {
    return (
      <span
        className={cn(
          'grid flex-none place-items-center rounded-[14px] bg-muted text-center leading-tight font-bold text-muted-foreground',
          box,
          size === 'lg' ? 'text-xs' : 'text-[10px]'
        )}
      >
        Sin nota
      </span>
    )
  }
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-[14px] bg-origin-siu-background font-extrabold text-origin-siu tabular-nums',
        box,
        size === 'lg' ? 'text-[2rem]' : 'text-lg'
      )}
    >
      <span className='sr-only'>Nota </span>
      {grade.toLocaleString('es-AR')}
    </span>
  )
}
