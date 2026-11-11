'use client'
/* Acciones de una comisión o una mesa de examen de la oferta: inscribirse en
   un paso o darse de baja (con confirmación), y lo que pasó después: el
   comprobante, el paso que falta en la Autogestión del SIU o el error. Las dos
   van por el mismo flujo; cambian las palabras y adónde lleva el éxito: la
   comisión, al espacio de la materia; la mesa, a Hoy, donde sale el final.
   Solo muestra lo que devuelve la server action. */
import { CheckCircle2, ExternalLink, Info } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { EnrollmentAction, EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'
import { targetFields } from '@/components/enrollment/target'
import { spaceHref } from '@/components/spaces/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorNotice } from '@/components/ui/states'
import type { OfferItem, Target } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const INITIAL: EnrollmentState = { kind: 'inicial' }

const STEP_TEXT: Record<EnrollmentStep, string> = { inscripcion: 'inscribirte', baja: 'darte de baja' }

/** Las palabras que cambian entre una comisión y una mesa. */
const TEXT: Record<Target['kind'], { what: string; dropped: string; dropWarning: string }> = {
  comision: {
    what: 'esta comisión',
    dropped: 'Saliste de la comisión y de su aula del Campus Virtual.',
    dropWarning: 'Vas a salir de la comisión y de su aula.'
  },
  mesa: {
    what: 'esta mesa',
    dropped: 'Dejaste tu lugar en la mesa.',
    dropWarning: 'Vas a dejar tu lugar en la mesa.'
  }
}

const linkButton = cn(buttonVariants({ size: 'lg' }), 'min-h-11')
const outlineLinkButton = cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'min-h-11')

function Receipt({ transactionNumber }: { transactionNumber: string }) {
  return <p className='text-xs text-muted-foreground'>Comprobante del SIU n.º {transactionNumber}</p>
}

function SectionEnrolled({ inClassroom }: { inClassroom: boolean }) {
  return (
    <>
      <p>
        <b>Listo, quedaste inscripto.</b>{' '}
        {inClassroom
          ? 'Ya estás en el SIU y en el aula del Campus Virtual.'
          : 'Ya estás en el SIU. Al aula del Campus Virtual todavía no te pudimos sumar desde HackAI.'}
      </p>
      <p>Y quedaste en el espacio de la materia, con sus avisos, consultas y material.</p>
    </>
  )
}

function Enrolled({
  state,
  target,
  subjectId
}: {
  state: Extract<EnrollmentState, { kind: 'inscripto' }>
  target: Target
  subjectId: string
}) {
  return (
    <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
      <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
      <div className='flex flex-col gap-2'>
        {target.kind === 'comision' ? (
          <SectionEnrolled inClassroom={state.inClassroom} />
        ) : (
          <p>
            <b>Listo, quedaste inscripto al final.</b> Ya estás en el SIU y lo vas a ver en Hoy, entre tus próximos.
          </p>
        )}
        <Receipt transactionNumber={state.transactionNumber} />
        <div className='flex flex-wrap gap-2'>
          {target.kind === 'comision' ? (
            <>
              <Link href={spaceHref(subjectId)} className={linkButton}>
                Ir al espacio de la materia
              </Link>
              <Link href='/materias' className={outlineLinkButton}>
                Ver en Mis materias
              </Link>
            </>
          ) : (
            <Link href='/hoy' className={linkButton}>
              Ver en Hoy
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function Outcome({ state, target, subjectId }: { state: EnrollmentState; target: Target; subjectId: string }) {
  if (state.kind === 'inscripto') return <Enrolled state={state} target={target} subjectId={subjectId} />
  if (state.kind === 'baja') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-border bg-muted p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div className='flex flex-col gap-1'>
          <p>
            <b>Te diste de baja.</b> {TEXT[target.kind].dropped}
          </p>
          <Receipt transactionNumber={state.transactionNumber} />
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
            llevamos directo a {TEXT[target.kind].what}.
          </p>
          <a href={state.url} target='_blank' rel='noopener noreferrer' className={cn(linkButton, 'self-start')}>
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

/** Lo que la oferta dice de la comisión o la mesa para esta persona. */
type EnrollmentStatus = Pick<OfferItem, 'alreadyEnrolled' | 'enrollmentOpen' | 'enrolledElsewhere'>

type Props = {
  target: Target
  /** La materia: el espacio al que lleva el mensaje de éxito de una comisión. */
  subjectId: string
  label: string
  status: EnrollmentStatus
  /** Las server actions llegan desde la página del servidor: importadas acá
      quedarían en otra capa del bundle, con otra copia del sistema en memoria. */
  enrollAction: EnrollmentAction
  dropAction: EnrollmentAction
}

function TargetInputs({ target }: { target: Target }) {
  const { targetKind, targetId } = targetFields(target)
  return (
    <>
      <input type='hidden' name='targetKind' value={targetKind} />
      <input type='hidden' name='targetId' value={targetId} />
    </>
  )
}

/** Los dos estados viven acá porque, al inscribirse, la página se vuelve a
    cargar con `alreadyEnrolled` y el comprobante no se tiene que perder. */
export function EnrollmentActions({ target, subjectId, label, status, enrollAction, dropAction }: Props) {
  const { alreadyEnrolled: enrolled, enrollmentOpen: open, enrolledElsewhere } = status
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
      {!enrolled && enrolledElsewhere && visibleOutcome.kind !== 'baja' && (
        <p className='text-sm text-muted-foreground'>
          Ya estás inscripto en la comisión {enrolledElsewhere}. Para cambiarte, primero date de baja de esa.
        </p>
      )}

      {!enrolled && !enrolledElsewhere && (
        <form action={enroll} onSubmit={() => setLastAction('inscripcion')}>
          <TargetInputs target={target} />
          <Button type='submit' size='lg' disabled={enrolling} className='min-h-11 w-full sm:w-auto'>
            {enrolling ? 'Inscribiéndote…' : 'Inscribirme'}
            <span className='sr-only'> en {label}</span>
          </Button>
        </form>
      )}

      <Outcome state={visibleOutcome} target={target} subjectId={subjectId} />

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
            <TargetInputs target={target} />
            <p className='text-sm'>
              ¿Te das de baja de {label}? {TEXT[target.kind].dropWarning}
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
