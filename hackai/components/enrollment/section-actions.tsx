'use client'
/* Acciones de una comisión de la oferta: inscribirse en un paso o darse de
   baja (con confirmación), y lo que pasó después: el comprobante, el paso que
   falta en la Autogestión del SIU o el error. Solo muestra lo que devuelve la
   server action. */
import { CheckCircle2, ExternalLink, Info } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { EnrollmentAction, EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorNotice } from '@/components/ui/states'
import { cn } from '@/lib/utils'

const INITIAL: EnrollmentState = { kind: 'inicial' }

const STEP_TEXT: Record<EnrollmentStep, string> = { inscripcion: 'inscribirte', baja: 'darte de baja' }

function Outcome({ state }: { state: EnrollmentState }) {
  if (state.kind === 'inscripto') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
        <div className='flex flex-col gap-2'>
          <p>
            <b>Listo, quedaste inscripto.</b> Ya estás en el SIU y en el aula del Campus Virtual.
          </p>
          <p className='text-xs text-muted-foreground'>Comprobante del SIU n.º {state.transactionNumber}</p>
          <Link
            href='/materias'
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11 self-start')}
          >
            Ver en Mis materias
          </Link>
        </div>
      </div>
    )
  }
  if (state.kind === 'baja') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-border bg-muted p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div>
          <p>
            <b>Te diste de baja.</b> Saliste de la comisión y de su aula del Campus Virtual.
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>Comprobante del SIU n.º {state.transactionNumber}</p>
        </div>
      </div>
    )
  }
  if (state.kind === 'requiere-autogestion') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
        <Info aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
        <div className='flex flex-col gap-2'>
          <p>
            <b>Te falta un paso.</b> Para {STEP_TEXT[state.step]} hay que confirmarlo en la Autogestión del SIU. Te
            llevamos directo a esta comisión.
          </p>
          <a
            href={state.url}
            target='_blank'
            rel='noopener noreferrer'
            className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 self-start')}
          >
            Seguir en la Autogestión
            <ExternalLink aria-hidden data-icon='inline-end' />
            <span className='sr-only'>(se abre en otra pestaña)</span>
          </a>
        </div>
      </div>
    )
  }
  if (state.kind === 'error') {
    return <ErrorNotice>{state.message}</ErrorNotice>
  }
  return null
}

type Props = {
  sectionId: string
  label: string
  /** Ya está inscripto en la comisión. */
  enrolled: boolean
  /** La inscripción está abierta. */
  open: boolean
  /** Otra comisión de la materia en la que ya está inscripto: no se puede inscribir en esta. */
  enrolledElsewhere: string | null
  /** Las server actions llegan desde la página del servidor: importadas acá
      quedarían en otra capa del bundle, con otra copia del sistema en memoria. */
  enrollAction: EnrollmentAction
  dropAction: EnrollmentAction
}

/** Los dos estados viven acá porque, al inscribirse, la página se vuelve a
    cargar con `enrolled` y el comprobante no se tiene que perder. */
export function SectionActions({
  sectionId,
  label,
  enrolled,
  open,
  enrolledElsewhere,
  enrollAction,
  dropAction
}: Props) {
  const [enrollState, enroll, enrolling] = useActionState(enrollAction, INITIAL)
  const [dropState, drop, dropping] = useActionState(dropAction, INITIAL)
  const [confirming, setConfirming] = useState(false)
  const [lastAction, setLastAction] = useState<'enroll' | 'drop' | null>(null)
  if (!open) return null

  const visibleOutcome = lastAction === 'drop' ? dropState : lastAction === 'enroll' ? enrollState : INITIAL
  const justEnrolled = visibleOutcome.kind === 'inscripto'

  return (
    <div className='flex flex-col gap-3'>
      {!enrolled && enrolledElsewhere && visibleOutcome.kind !== 'baja' && (
        <p className='text-sm text-muted-foreground'>
          Ya estás inscripto en la comisión {enrolledElsewhere}. Para cambiarte, primero date de baja de esa.
        </p>
      )}

      {!enrolled && !enrolledElsewhere && (
        <form action={enroll} onSubmit={() => setLastAction('enroll')}>
          <input type='hidden' name='sectionId' value={sectionId} />
          <Button type='submit' size='lg' disabled={enrolling} className='min-h-11 w-full sm:w-auto'>
            {enrolling ? 'Inscribiéndote…' : 'Inscribirme'}
            <span className='sr-only'> en {label}</span>
          </Button>
        </form>
      )}

      {enrolled &&
        !justEnrolled &&
        (confirming ? (
          <form
            action={drop}
            onSubmit={() => {
              setLastAction('drop')
              setConfirming(false)
            }}
            className='flex flex-col gap-2 rounded-lg border border-border p-3'
          >
            <input type='hidden' name='sectionId' value={sectionId} />
            <p className='text-sm'>¿Te das de baja de {label}? Vas a salir de la comisión y de su aula.</p>
            <div className='flex flex-wrap gap-2'>
              <Button type='submit' variant='destructive' size='lg' className='min-h-11'>
                Sí, darme de baja
              </Button>
              <Button type='button' variant='ghost' size='lg' className='min-h-11' onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type='button'
            variant='outline'
            size='lg'
            disabled={dropping}
            className='min-h-11 self-start'
            onClick={() => setConfirming(true)}
          >
            {dropping ? 'Dándote de baja…' : 'Darme de baja'}
            <span className='sr-only'> de {label}</span>
          </Button>
        ))}

      <Outcome state={visibleOutcome} />
    </div>
  )
}
