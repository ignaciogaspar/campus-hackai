/* Los indicadores de riesgo de un alumno como chips: el texto dice cuál es, así no depende del color, y la
   explicación va en el título. La inhabilitación administrativa va en rojo porque bloquea al alumno; el resto, en
   el naranja de «falta algo». */
import { StatusPill } from '@/components/ui/status-pill'
import type { RiskKind } from '@/lib/core/reports'
import { RISK_HELP, RISK_LABEL } from '@/lib/reports-labels'
import { cn } from '@/lib/utils'

export function RiskBadges({ risks, className }: { risks: RiskKind[]; className?: string }) {
  if (risks.length === 0) return null
  return (
    <ul aria-label='Indicadores de riesgo' className={cn('flex flex-wrap gap-1', className)}>
      {risks.map((risk) => (
        <li key={risk} title={RISK_HELP[risk]}>
          <StatusPill tone={risk === 'inhabilitado' ? 'danger' : 'warning'}>{RISK_LABEL[risk]}</StatusPill>
        </li>
      ))}
    </ul>
  )
}
