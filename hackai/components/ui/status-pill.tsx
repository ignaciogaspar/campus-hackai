/* Un estado como chip: aprobada, inscripto, en trámite, rechazada. El mismo
   estilo que los chips de estado de Notas (components/grades/status.tsx):
   fondo suave y texto del mismo tono, con contraste AA. El texto dice el
   estado, para quien no distingue colores. Solo presentación: el estado lo
   decide cada módulo. */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const TONES: Record<StatusTone, string> = {
  /** Resuelto a favor: aprobada, entregada, inscripto. */
  success: 'bg-success-background text-success',
  /** En marcha: en curso, recibida. */
  info: 'bg-accent text-blue',
  /** Falta algo de quien mira: el final, que se resuelva el trámite. */
  warning: 'bg-kind-recuperatorio-background text-kind-recuperatorio',
  /** No salió: rechazada, sin cupo. */
  danger: 'bg-error-background text-destructive',
  /** Sin estado todavía. */
  neutral: 'bg-muted text-muted-foreground'
}

export function StatusPill({
  tone,
  children,
  className
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[0.75rem] leading-5 font-semibold whitespace-nowrap',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
