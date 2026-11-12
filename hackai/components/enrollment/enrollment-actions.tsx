'use client'
/* Acciones de una comisión o una mesa de examen de la oferta: inscribirse en
   un paso o darse de baja (con confirmación), y lo que pasó después: el
   comprobante, el paso que falta en la Autogestión del SIU o el error. Las dos
   van por el mismo flujo; cambian las palabras y adónde lleva el éxito: la
   comisión, al espacio de la materia; la mesa, a Hoy, donde sale el final.
   Sin lugares, el botón dice «Sin cupo» y no se puede tocar. Si a un final le
   falta la regularidad, lo avisa antes de inscribirse y lo repite en el
   resultado. Solo muestra lo que dicen la oferta y la server action. */
import { CheckCircle2, CircleAlert, ExternalLink, Info } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useActionState, useEffect, useRef, useState } from 'react'
import { REGULARITY_NOTE } from '@/components/enrollment/format'
import { INITIAL_ENROLLMENT_STATE, visibleOutcome } from '@/components/enrollment/outcome'
import type { EnrollmentAction, EnrollmentState, EnrollmentStep } from '@/components/enrollment/state'
import { targetFields } from '@/components/enrollment/target'
import { spaceHref } from '@/components/spaces/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorNotice } from '@/components/ui/states'
import type { OfferItem, Target } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

const STEP_TEXT: Record<EnrollmentStep, string> = { inscripcion: 'inscribirte', baja: 'darte de baja' }

/** Las palabras que cambian entre una comisión y una mesa. */
const TARGET_TEXT: Record<Target['kind'], { what: string; dropped: string; dropWarning: string }> = {
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

type EnrolledProps = {
  inClassroom: boolean
  subjectId: string
  transactionNumber: string
  needsRegularity: boolean
  /** La semana del calendario donde se ve lo nuevo: la primera clase de la cursada. */
  calendarHref: string
}

/** La comisión: quedó en el SIU, en el aula (si se pudo) y en el espacio, adonde lleva. */
function SectionEnrolled({ inClassroom, subjectId, transactionNumber, calendarHref }: EnrolledProps) {
  return (
    <>
      <p>
        <b>Listo, quedaste inscripto.</b>{' '}
        {inClassroom
          ? 'Ya estás en el SIU y en el aula del Campus Virtual.'
          : 'Ya estás en el SIU. Al aula del Campus Virtual todavía no te pudimos sumar desde HackAI.'}
      </p>
      <p>
        Tus clases ya están en el calendario y quedaste en el espacio de la materia, con sus avisos, consultas y
        material.
      </p>
      <Receipt transactionNumber={transactionNumber} />
      <div className='flex flex-wrap gap-2'>
        <Link href={spaceHref(subjectId)} className={linkButton}>
          Ir al espacio de la materia
        </Link>
        <Link href={calendarHref} className={outlineLinkButton}>
          Ver en el calendario
        </Link>
      </div>
    </>
  )
}

/** La mesa: quedó en el SIU y el final sale en Hoy, adonde lleva. Si le falta la regularidad, se lo recuerda. */
function BoardEnrolled({ transactionNumber, needsRegularity }: EnrolledProps) {
  return (
    <>
      <p>
        <b>Listo, quedaste inscripto al final.</b> Ya estás en el SIU y lo vas a ver en Hoy, entre tus próximos.
      </p>
      {needsRegularity && <p className='font-semibold text-warning-foreground'>{REGULARITY_NOTE}</p>}
      <Receipt transactionNumber={transactionNumber} />
      <div className='flex flex-wrap gap-2'>
        <Link href='/hoy' className={linkButton}>
          Ver en Hoy
        </Link>
      </div>
    </>
  )
}

const ENROLLED: Record<Target['kind'], (props: EnrolledProps) => ReactNode> = {
  comision: SectionEnrolled,
  mesa: BoardEnrolled
}

type OutcomeProps = { target: Target; subjectId: string; needsRegularity: boolean; calendarHref: string }

function Enrolled({
  state,
  target,
  subjectId,
  needsRegularity,
  calendarHref
}: OutcomeProps & { state: Extract<EnrollmentState, { kind: 'inscripto' }> }) {
  const Done = ENROLLED[target.kind]
  return (
    <div role='status' className='flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
      <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-primary' />
      <div className='flex flex-col gap-2'>
        <Done
          inClassroom={state.inClassroom}
          subjectId={subjectId}
          transactionNumber={state.transactionNumber}
          needsRegularity={needsRegularity}
          calendarHref={calendarHref}
        />
      </div>
    </div>
  )
}

function Outcome({ state, ...props }: OutcomeProps & { state: EnrollmentState }) {
  if (state.kind === 'inscripto') return <Enrolled state={state} {...props} />
  if (state.kind === 'baja') {
    return (
      <div role='status' className='flex gap-3 rounded-lg border border-border bg-muted p-3 text-sm'>
        <CheckCircle2 aria-hidden className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div className='flex flex-col gap-1'>
          <p>
            <b>Te diste de baja.</b> {TARGET_TEXT[props.target.kind].dropped}
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
            llevamos directo a {TARGET_TEXT[props.target.kind].what}.
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
type EnrollmentStatus = Pick<
  OfferItem,
  'alreadyEnrolled' | 'enrollmentWindow' | 'enrolledElsewhere' | 'spotsLeft' | 'needsRegularity'
>

type Props = {
  target: Target
  /** La materia: el espacio al que lleva el mensaje de éxito de una comisión. */
  subjectId: string
  label: string
  status: EnrollmentStatus
  /** Adónde lleva «Ver en el calendario» al inscribirse a una comisión. Sin esto, a la semana actual. */
  calendarHref?: string
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

/** Lo que comparten los dos formularios: a qué apuntan, cómo se nombra para
    un lector de pantalla, si su acción está en curso y qué hacen al enviarse. */
type FormControlProps = {
  target: Target
  label: string
  pending: boolean
  action: (formData: FormData) => void
  onSubmit: () => void
}

/** Inscribirse: el aviso de la regularidad, si falta, y el botón, que sin lugares dice «Sin cupo» y no se puede tocar. */
function EnrollForm({
  target,
  label,
  status,
  pending: enrolling,
  action,
  onSubmit
}: FormControlProps & { status: EnrollmentStatus }) {
  const full = status.spotsLeft === 0
  return (
    <form action={action} onSubmit={onSubmit} className='flex flex-col gap-3'>
      <TargetInputs target={target} />
      {status.needsRegularity && (
        <p className='flex gap-2 text-sm text-warning-foreground'>
          <CircleAlert aria-hidden className='mt-0.5 size-4 shrink-0 text-warning-icon' />
          {REGULARITY_NOTE}
        </p>
      )}
      <Button type='submit' size='lg' disabled={enrolling || full} className='min-h-11 w-full sm:w-auto sm:self-start'>
        {full ? 'Sin cupo' : enrolling ? 'Inscribiéndote…' : 'Inscribirme'}
        <span className='sr-only'> en {label}</span>
      </Button>
    </form>
  )
}

/** Darse de baja: el botón y, al tocarlo, la confirmación. */
function DropControls({ target, label, pending: dropping, action, onSubmit }: FormControlProps) {
  const [confirming, setConfirming] = useState(false)
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

  if (!confirming) {
    return (
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
    )
  }
  return (
    <form
      action={action}
      onSubmit={() => {
        onSubmit()
        closeConfirmation()
      }}
      className='flex flex-col gap-2 rounded-lg border border-border p-3'
    >
      <TargetInputs target={target} />
      <p className='text-sm'>
        ¿Te das de baja de {label}? {TARGET_TEXT[target.kind].dropWarning}
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
  )
}

/** Los dos estados viven acá porque, al inscribirse, la página se vuelve a
    cargar con `alreadyEnrolled` y el comprobante no se tiene que perder. El de
    una acción anterior, en cambio, no se muestra mientras va la siguiente. */
export function EnrollmentActions({
  target,
  subjectId,
  label,
  status,
  calendarHref = '/calendario',
  enrollAction,
  dropAction
}: Props) {
  const { alreadyEnrolled: enrolled, enrolledElsewhere } = status
  const [enrollState, enroll, enrolling] = useActionState(enrollAction, INITIAL_ENROLLMENT_STATE)
  const [dropState, drop, dropping] = useActionState(dropAction, INITIAL_ENROLLMENT_STATE)
  const [lastAction, setLastAction] = useState<EnrollmentStep | null>(null)
  const [superseded, setSuperseded] = useState<EnrollmentState | null>(null)
  if (status.enrollmentWindow !== 'abierta') return null

  const shown = visibleOutcome({ lastAction, enrollState, dropState, superseded, pending: enrolling || dropping })
  const startAction = (step: EnrollmentStep) => {
    setLastAction(step)
    setSuperseded(step === 'baja' ? dropState : enrollState)
  }

  return (
    <div className='flex flex-col gap-3'>
      {!enrolled && enrolledElsewhere && shown.kind !== 'baja' && (
        <p className='text-sm text-muted-foreground'>
          Ya estás inscripto en la comisión {enrolledElsewhere}. Para cambiarte, primero date de baja de esa.
        </p>
      )}

      {!enrolled && !enrolledElsewhere && (
        <EnrollForm
          target={target}
          label={label}
          status={status}
          pending={enrolling}
          action={enroll}
          onSubmit={() => startAction('inscripcion')}
        />
      )}

      <Outcome
        state={shown}
        target={target}
        subjectId={subjectId}
        needsRegularity={status.needsRegularity}
        calendarHref={calendarHref}
      />

      {enrolled && (
        <DropControls
          target={target}
          label={label}
          pending={dropping}
          action={drop}
          onSubmit={() => startAction('baja')}
        />
      )}
    </div>
  )
}
