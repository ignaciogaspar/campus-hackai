import { cn } from '@/lib/utils'

/* La nota en un recuadro, como en «Aprobadas» de los mocks. Sin nota (ausente
   o todavía sin cargar) se ve una raya y se lee «sin nota». */
export function GradeBadge({ grade, size = 'md' }: { grade: number | null; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-[12px] bg-origin-siu-background font-extrabold text-origin-siu tabular-nums',
        size === 'lg' ? 'size-16 text-[2rem]' : 'size-10 text-lg'
      )}
    >
      {grade === null ? (
        <>
          <span aria-hidden='true'>—</span>
          <span className='sr-only'>Sin nota</span>
        </>
      ) : (
        <>
          <span className='sr-only'>Nota </span>
          {grade.toLocaleString('es-AR')}
        </>
      )}
    </span>
  )
}
