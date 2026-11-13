import { cn } from '@/lib/utils'

export type Origin = 'hackai' | 'discord' | 'moodle' | 'siu'

export const ORIGINS: Record<Origin, { label: string; className: string }> = {
  hackai: { label: 'HackAI', className: 'bg-origin-hackai-background text-origin-hackai' },
  discord: { label: 'Discord', className: 'bg-origin-discord-background text-origin-discord' },
  moodle: { label: 'Moodle', className: 'bg-origin-moodle-background text-origin-moodle' },
  siu: { label: 'SIU', className: 'bg-origin-siu-background text-origin-siu' }
}

/* De dónde viene un material o una fecha. En los mensajes no va. Con
   `dotOnMobile`, en el celular queda solo el punto de color y el nombre lo lee
   el lector de pantalla («Fecha del SIU»), para dejarle el ancho al texto. */
export function OriginBadge({
  origin,
  className,
  dotOnMobile = false
}: {
  origin: Origin
  className?: string
  dotOnMobile?: boolean
}) {
  const { label, className: colors } = ORIGINS[origin]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[0.6875rem] font-bold whitespace-nowrap',
        dotOnMobile && 'max-sm:px-1 max-sm:py-1',
        colors,
        className
      )}
    >
      <span aria-hidden='true' className='size-1.5 rounded-full bg-current' />
      {dotOnMobile ? (
        <>
          <span className='max-sm:hidden'>{label}</span>
          <span className='sr-only sm:hidden'>{origin === 'siu' ? 'Fecha del SIU' : `Fecha de ${label}`}</span>
        </>
      ) : (
        label
      )}
    </span>
  )
}
