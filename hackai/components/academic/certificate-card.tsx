/* Una constancia: si cumple las condiciones y el enlace directo a pedirla en
   la Autogestión del SIU, donde se emite. Si no cumple, por qué, con lo que le
   dice Cursada. No decide nada: solo muestra el estado. */
import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CertificateReason, CertificateStatus, CertificateType } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const TITLES: Record<CertificateType, string> = {
  'alumno-regular': 'Constancia de alumno regular',
  'examen-final': 'Constancia de examen final'
}

const REASONS: Record<CertificateReason, string> = {
  'sin-propuesta-activa': 'Tu carrera figura como pasiva en el SIU.',
  'sin-inscripcion-vigente': 'No tenés materias inscriptas en este cuatrimestre.',
  'sin-examenes-rendidos': 'Todavía no rendiste ningún final.'
}

export function certificateTitle(type: CertificateType): string {
  return TITLES[type]
}

export function CertificateCard({ status }: { status: CertificateStatus }) {
  const { meetsConditions, reasons, url, type } = status
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <h3 className='font-bold'>{TITLES[type]}</h3>
      {meetsConditions ? (
        <p className='flex items-center gap-2 text-[0.8125rem] font-semibold text-success'>
          <CircleCheck aria-hidden='true' className='size-5 flex-none' strokeWidth={2} />
          Cumplís las condiciones para pedirla.
        </p>
      ) : (
        <div className='flex flex-col gap-1.5 text-[0.8125rem]'>
          <p className='flex items-center gap-2 font-semibold text-warning-foreground'>
            <CircleAlert aria-hidden='true' className='size-5 flex-none text-warning-icon' strokeWidth={2} />
            Todavía no podés pedirla.
          </p>
          {reasons.length > 0 ? (
            <ul className='flex list-disc flex-col gap-1 pl-11 text-foreground'>
              {reasons.map((r) => (
                <li key={r}>{REASONS[r]}</li>
              ))}
            </ul>
          ) : (
            <p className='pl-7 text-foreground'>El SIU no nos dice el motivo: consultalo en la Autogestión.</p>
          )}
        </div>
      )}
      <a
        href={url}
        target='_blank'
        rel='noopener noreferrer'
        className={cn(
          buttonVariants({ variant: meetsConditions ? 'default' : 'outline' }),
          'w-full justify-center font-semibold'
        )}
      >
        {meetsConditions ? 'Pedirla en el SIU' : 'Ver en la Autogestión'}
        <ExternalLink aria-hidden='true' data-icon='inline-end' />
        <span className='sr-only'>(se abre en otra pestaña)</span>
      </a>
    </Card>
  )
}
