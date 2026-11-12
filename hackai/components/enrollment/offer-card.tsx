/* La tarjeta de una comisión o una mesa de la oferta: su título y período, la
   etiqueta «Inscripto», sus datos en filas con ícono (las de cada una y el
   cupo), la ventana de inscripción y las acciones. Entre una comisión y una
   mesa cambian el título y las filas: el resto lo dice la oferta de Cursada. */
import { type LucideIcon, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { EnrollmentActions } from '@/components/enrollment/enrollment-actions'
import { capacityText } from '@/components/enrollment/format'
import type { EnrollmentAction } from '@/components/enrollment/state'
import { WindowNote } from '@/components/enrollment/window-note'
import type { OfferItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

/** Un dato de la tarjeta: el ícono hace de rótulo, que queda para el lector de pantalla. */
export function InfoRow({
  icon: Icon,
  label,
  className,
  children
}: {
  icon: LucideIcon
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className='flex gap-2'>
      <dt>
        <Icon aria-hidden className='mt-0.5 size-4 text-muted-foreground' />
        <span className='sr-only'>{label}</span>
      </dt>
      <dd className={className}>{children}</dd>
    </div>
  )
}

type Props = {
  item: OfferItem
  title: ReactNode
  /** Cómo se nombra en los botones para el lector de pantalla: «Álgebra, comisión A». */
  label: string
  /** Las server actions llegan desde la página del servidor (ver enrollment-actions.tsx). */
  enrollAction: EnrollmentAction
  dropAction: EnrollmentAction
  /** Las filas propias de una comisión o de una mesa (`InfoRow`); el cupo va siempre al final. */
  children: ReactNode
}

export function OfferCard({ item, title, label, enrollAction, dropAction, children }: Props) {
  const capacity = capacityText(item)
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-[22px] bg-card p-4 shadow-card',
        item.enrollmentWindow !== 'abierta' && 'bg-muted/60 shadow-none'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 className='text-base leading-snug font-semibold'>{title}</h2>
          <p className='text-sm text-muted-foreground'>{item.period}</p>
        </div>
        {item.alreadyEnrolled && (
          <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary'>
            Inscripto
          </span>
        )}
      </div>

      <dl className='flex flex-col gap-1.5 text-sm'>
        {children}
        <InfoRow icon={Users} label='Cupo' className={cn(capacity.full && 'font-semibold text-destructive')}>
          {capacity.text}
        </InfoRow>
      </dl>

      <p className='text-xs text-muted-foreground'>
        <WindowNote item={item} />
      </p>

      <EnrollmentActions
        target={item.target}
        subjectId={item.subjectId}
        label={label}
        status={item}
        enrollAction={enrollAction}
        dropAction={dropAction}
      />
    </li>
  )
}
