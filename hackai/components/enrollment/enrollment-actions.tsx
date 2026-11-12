'use client'
/* Acciones de una comisión o una mesa de la oferta: inscribirse en un paso o
   darse de baja (con confirmación), y lo que pasó después: el comprobante, el
   paso que falta en la Autogestión del SIU o el error. Solo muestra lo que
   devuelve la server action. */
import { CheckCircle2, ExternalLink, Info } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import type {
  EnrollmentAction,
  EnrollmentState,
  EnrollmentStep,
  EnrollmentTargetKind
} from '@/components/enrollment/state'
import { spaceHref } from '@/components/spaces/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorNotice } from '@/components/ui/states'
import type { OfferItem } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const INITIAL: EnrollmentState = { kind: 'inicial' }

const STEP_TEXT: Record<EnrollmentStep, string> = { inscripcion: 'inscribirte', baja: 'darte de baja' }

function Enrolled({
  state,
  subjectId,
  calendarHref
}: {
  state: Extract<EnrollmentState, { kind: 'inscripto' }>
  subjectId: string
  calendarHref?: string
}) {
  if (state.target === 'mesa') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
        <div className='flex flex-col gap-2'>
          <p>
            <b>Listo, quedaste inscripto al final.</b> Ya está en el SIU y en tu calendario.
          </p>
          <p className='text-xs text-muted-foreground'>Comprobante del SIU n.º {state.transactionNumber}</p>
          {calendarHref && (
            <Link href={calendarHref} className={cn(buttonVariants({ size: 'lg' }), 'min-h-11 self-start')}>
              Ver en el calendario
            </Link>
          )}
        </div>
      </div>
    )
  }
  return (
    <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
      <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
      <div className='flex flex-col gap-2'>
        <p>
          <b>Listo, quedaste inscripto.</b>{' '}
          {state.inClassroom
            ? 'Ya estás en el SIU y en el aula del Campus Virtual.'
            : 'Ya estás en el SIU. Al aula del Campus Virtual todavía no te pudimos sumar desde HackAI.'}
        </p>
        <p>Tus clases ya están en el calendario y quedaste en el espacio de la materia.</p>
        <p className='text-xs text-muted-foreground'>Comprobante del SIU n.º {state.transactionNumber}</p>
        <div className='flex flex-wrap gap-2'>
          {calendarHref && (
            <Link href={calendarHref} className={cn(buttonVariants({ size: 'lg' }), 'min-h-11')}>
              Ver mis clases en el calendario
            </Link>
          )}
          <Link
            href={spaceHref(subjectId)}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11')}
          >
            Ir al espacio de la materia
          </Link>
        </div>
      </div>
    </div>
  )
}

function Outcome({
  state,
  subjectId,
  calendarHref
}: {
  state: EnrollmentState
  subjectId: string
  calendarHref?: string
}) {
  if (state.kind === 'inscripto') return <Enrolled state={state} subjectId={subjectId} calendarHref={calendarHref} />
  if (state.kind === 'baja') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-border bg-muted p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div>
          <p>
            <b>Te diste de baja.</b>{' '}
            {state.target === 'mesa'
              ? 'Ya no estás inscripto a la mesa.'
              : 'Saliste de la comisión y de su aula del Campus Virtual.'}
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
            llevamos directo a donde es.
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

/** Lo que la oferta dice de la comisión para esta persona. */
type SectionStatus = Pick<OfferItem, 'alreadyEnrolled' | 'enrollmentOpen' | 'enrolledElsewhere' | 'spotsLeft'>

type Props = {
  /** La comisión o la mesa. */
  target: { kind: EnrollmentTargetKind; id: string }
  /** La materia: el espacio al que lleva el mensaje de éxito. */
  subjectId: string
  label: string
  status: SectionStatus
  /** La semana del calendario en la que se ve lo nuevo: el inicio de la cursada o el día del final. */
  calendarHref?: string
  /** Las server actions llegan desde la página del servidor: importadas acá
      quedarían en otra capa del bundle, con otra copia del sistema en memoria. */
  enrollAction: EnrollmentAction
  dropAction: EnrollmentAction
}

/** Los dos estados viven acá porque, al inscribirse, la página se vuelve a
    cargar con `alreadyEnrolled` y el comprobante no se tiene que perder. */
export function EnrollmentActions({ target, subjectId, label, status, calendarHref, enrollAction, dropAction }: Props) {
  const { alreadyEnrolled: enrolled, enrollmentOpen: open, enrolledElsewhere, spotsLeft } = status
  // Sin cupo no se ofrece el botón: el SIU lo rechazaría igual.
  const full = spotsLeft === 0
  const [enrollState, enroll, enrolling] = useActionState(enrollAction, INITIAL)
  const [dropState, drop, dropping] = useActionState(dropAction, INITIAL)
  const [confirming, setConfirming] = useState(false)
  const [lastAction, setLastAction] = useState<EnrollmentStep | null>(null)
  // El foco sigue a la confirmación: al abrirla va a «Cancelar», la opción que
  // no borra nada; al cerrarla vuelve a «Darme de baja». Así no se pierde con
  // teclado ni con lector de pantalla cuando los botones se reemplazan.
  const dropButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  useEffect(() => {
    if (confirming) {
      cancelButton.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      dropButton.current?.focus()
    }
  }, [confirming])
  const closeConfirmation = () => {
    returnFocus.current = true
    setConfirming(false)
  }
  if (!open) return null

  const visibleOutcome = lastAction === 'baja' ? dropState : lastAction === 'inscripcion' ? enrollState : INITIAL

  return (
    <div className='flex flex-col gap-3'>
      {!enrolled && enrolledElsewhere && visibleOutcome.kind !== 'baja' && target.kind === 'comision' && (
        <p className='text-sm text-muted-foreground'>
          Ya estás inscripto en la comisión {enrolledElsewhere}. Para cambiarte, primero date de baja de esa.
        </p>
      )}

      {!enrolled && !enrolledElsewhere && full && (
        <p className='text-sm text-muted-foreground'>
          No quedan lugares {target.kind === 'mesa' ? 'en esta mesa' : 'en esta comisión'}. Si alguien se da de baja, se
          libera uno.
        </p>
      )}

      {!enrolled && !enrolledElsewhere && !full && (
        <form action={enroll} onSubmit={() => setLastAction('inscripcion')}>
          <input type='hidden' name='kind' value={target.kind} />
          <input type='hidden' name='id' value={target.id} />
          <Button type='submit' size='lg' disabled={enrolling} className='min-h-11 w-full px-4 font-semibold sm:w-auto'>
            {enrolling ? 'Inscribiéndote…' : 'Inscribirme'}
            <span className='sr-only'> en {label}</span>
          </Button>
        </form>
      )}

      <Outcome state={visibleOutcome} subjectId={subjectId} calendarHref={calendarHref} />

      {enrolled &&
        (confirming ? (
          <form
            action={drop}
            onSubmit={() => {
              setLastAction('baja')
              closeConfirmation()
            }}
            className='flex flex-col gap-2 rounded-lg border border-border p-3'
          >
            <input type='hidden' name='kind' value={target.kind} />
            <input type='hidden' name='id' value={target.id} />
            <p className='text-sm'>
              ¿Te das de baja de {label}?{' '}
              {target.kind === 'mesa' ? 'Vas a dejar tu lugar en la mesa.' : 'Vas a salir de la comisión y de su aula.'}
            </p>
            <div className='flex flex-wrap gap-2'>
              <Button type='submit' variant='destructive' size='lg' className='min-h-11'>
                Sí, darme de baja
              </Button>
              <Button
                ref={cancelButton}
                type='button'
                variant='ghost'
                size='lg'
                className='min-h-11'
                onClick={closeConfirmation}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            ref={dropButton}
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
    </div>
  )
}
