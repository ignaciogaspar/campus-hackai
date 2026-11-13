'use client'
/* Las solicitudes reales del SIU (Trámites > Solicitudes de la Autogestión) y
   «Nueva solicitud» de una constancia. La lista va como la escribe el SIU: tipo,
   fecha, a quién se presenta, dónde se pidió, copias, estado y vencimiento; lo
   que no dice queda sin mostrar. Pedir la de alumno regular va al SIU de
   verdad (`HACKAI_SIU_ESCRITURAS=si`), en dos pasos: primero se ve qué se va a
   pedir y después se confirma, porque una solicitud no se deshace desde HackAI.
   La de examen final, o sin escrituras, se pide en la Autogestión. */
import { CircleCheck, ExternalLink, FilePlus2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useActionState, useState } from 'react'
import { requestCertificateAction } from '@/app/(app)/tramites/actions'
import { shortDate } from '@/components/dates'
import { INITIAL_REQUEST_STATE } from '@/components/procedures/request-state'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'
import type { SiuCertificateRequest } from '@/lib/ports/siu'

/** El color del estado, por lo que dice el SIU. El texto es el del SIU. */
function toneOf(status: string): StatusTone {
  if (/rechaz|anulad|vencid/i.test(status)) return 'danger'
  if (/pendiente|tr[aá]mite|proceso/i.test(status)) return 'warning'
  if (/online|impres|entregad|emitid/i.test(status)) return 'success'
  return 'info'
}

const FIELD = 'h-11 rounded-xl border border-border bg-card px-3 text-[0.875rem] font-normal focus-ring'
const LABEL = 'flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-ink'

const TYPE_NAMES: Record<string, string> = {
  'alumno-regular': 'la constancia de alumno regular',
  'examen-final': 'la constancia de examen final'
}

type Draft = { type: string; presentTo: string; copies: string; notes: string }

/** Lo que se va a pedir, para confirmarlo antes de mandarlo al SIU. */
function Review({
  draft,
  submit,
  pending,
  error,
  onBack
}: {
  draft: Draft
  submit: (form: FormData) => void
  pending: boolean
  /** Lo que respondió el SIU si no aceptó el pedido. */
  error: string | null
  onBack: () => void
}) {
  const copies = Number(draft.copies)
  return (
    <form action={submit} className='flex flex-col gap-4 text-[0.875rem] text-ink'>
      {Object.entries(draft).map(([name, value]) => (
        <input key={name} type='hidden' name={name} value={value} />
      ))}
      <input type='hidden' name='confirmed' value='si' />
      {error && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5'>
          {error}
        </p>
      )}
      <p className='rounded-xl bg-accent px-3 py-3 text-pretty'>
        Vas a pedir <b>{TYPE_NAMES[draft.type] ?? 'una constancia'}</b>, {copies} {copies === 1 ? 'copia' : 'copias'},
        para presentar a <b>{draft.presentTo}</b>. Se pide en el SIU con tu cuenta y no se puede deshacer desde HackAI.
      </p>
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' size='lg' disabled={pending} className='min-h-11 font-semibold'>
          {pending ? 'Pidiendo…' : 'Confirmar y pedir'}
        </Button>
        <Button type='button' variant='outline' size='lg' disabled={pending} onClick={onBack} className='min-h-11'>
          Volver
        </Button>
      </div>
    </form>
  )
}

/** El SIU aceptó la solicitud: su mensaje, tal cual. */
function Requested({ message }: { message: string }) {
  return (
    <div role='status' className='flex flex-col gap-3'>
      <p className='flex items-start gap-2.5 rounded-xl bg-success-background px-3 py-3 text-[0.875rem] text-ink'>
        <CircleCheck aria-hidden='true' className='mt-px size-5 flex-none text-success' strokeWidth={2} />
        <span>
          <b>El SIU recibió tu solicitud.</b> {message}
        </span>
      </p>
      <SheetClose asChild>
        <Button variant='outline' size='lg' className='min-h-11 self-start'>
          Listo
        </Button>
      </SheetClose>
    </div>
  )
}

/** Esta constancia se pide en la Autogestión. Sin dirección (el SIU no respondió al armar la pantalla), sin
    enlace: uno vacío recargaría Trámites. */
function InSelfService({ url }: { url: string }) {
  return (
    <div role='status' className='flex flex-col gap-3 text-[0.875rem] text-ink'>
      <p>Esta constancia se pide en la Autogestión del SIU.</p>
      {url && (
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className='inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-border px-3 font-semibold text-blue hover:bg-accent focus-ring'
        >
          Pedirla en el SIU
          <ExternalLink aria-hidden='true' className='size-4' />
        </a>
      )}
    </div>
  )
}

/** El formulario: la de alumno regular pasa al resumen para confirmar; la de examen final va a la acción, que
    responde que se pide en la Autogestión. */
function RequestForm({
  submit,
  pending,
  error,
  onReview
}: {
  submit: (form: FormData) => void
  pending: boolean
  error: string | null
  onReview: (draft: Draft) => void
}) {
  function review(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget)
    if (form.get('type') !== 'alumno-regular') return
    event.preventDefault()
    const field = (name: string) => String(form.get(name) ?? '').trim()
    onReview({ type: field('type'), presentTo: field('presentTo'), copies: field('copies'), notes: field('notes') })
  }

  return (
    <form onSubmit={review} action={submit} className='flex flex-col gap-4'>
      {error && (
        <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
          {error}
        </p>
      )}
      <label className={LABEL}>
        Qué constancia
        <Select
          name='type'
          defaultValue='alumno-regular'
          options={[
            { value: 'alumno-regular', label: 'Constancia de alumno regular' },
            { value: 'examen-final', label: 'Constancia de examen final (se pide en el SIU)' }
          ]}
          className='h-11 pl-3 font-normal'
        />
      </label>
      <label className={LABEL}>
        Presentar a
        <input name='presentTo' required placeholder='Por ejemplo, Quien corresponda' className={FIELD} />
      </label>
      <label className={LABEL}>
        Copias
        <input name='copies' type='number' min={1} defaultValue={1} required className={FIELD} />
      </label>
      <label className={LABEL}>
        Observaciones <span className='font-normal text-muted-foreground'>(opcional)</span>
        <textarea
          name='notes'
          rows={3}
          className='rounded-xl border border-border bg-card px-3 py-2.5 text-[0.875rem] font-normal focus-ring'
        />
      </label>
      <Button type='submit' size='lg' disabled={pending} className='min-h-11 self-start font-semibold'>
        {pending ? 'Un momento…' : 'Seguir'}
      </Button>
    </form>
  )
}

function NewRequest({ selfServiceUrl }: { selfServiceUrl: string }) {
  const [state, submit, pending] = useActionState(requestCertificateAction, INITIAL_REQUEST_STATE)
  const [draft, setDraft] = useState<Draft | null>(null)
  const error = state.kind === 'error' ? state.message : null

  let body: ReactNode
  if (state.kind === 'pedida') body = <Requested message={state.message} />
  else if (state.kind === 'autogestion') body = <InSelfService url={selfServiceUrl} />
  else if (draft)
    body = <Review draft={draft} submit={submit} pending={pending} error={error} onBack={() => setDraft(null)} />
  else body = <RequestForm submit={submit} pending={pending} error={error} onReview={setDraft} />

  return (
    <Sheet onOpenChange={(open) => !open && setDraft(null)}>
      <SheetTrigger asChild>
        <Button size='lg' className='min-h-10 flex-none gap-1.5 font-semibold'>
          <FilePlus2 aria-hidden='true' data-icon='inline-start' />
          Nueva solicitud
        </Button>
      </SheetTrigger>
      <SheetContent side='right' title='Nueva solicitud' description='Se pide en el SIU con tu cuenta.'>
        {body}
      </SheetContent>
    </Sheet>
  )
}

export function SiuRequests({
  requests,
  selfServiceUrl,
  heading
}: {
  requests: SiuCertificateRequest[]
  selfServiceUrl: string
  /** El título y la explicación de la sección, a la izquierda de «Nueva solicitud». */
  heading: ReactNode
}) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        {heading}
        <NewRequest selfServiceUrl={selfServiceUrl} />
      </div>
      {requests.length === 0 ? (
        <p className='rounded-2xl border border-border bg-card px-4 py-3 text-[0.875rem] text-muted-foreground'>
          No tenés solicitudes en el SIU.
        </p>
      ) : (
        <ul className='divide-y divide-border rounded-2xl border border-border bg-card'>
          {requests.map((r) => (
            <li key={r.id} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='text-[0.875rem] font-semibold text-ink'>{r.type}</p>
                <p className='text-[0.75rem] text-muted-foreground tabular-nums'>
                  {[
                    r.requestedAt && `Pedida el ${shortDate(r.requestedAt)}`,
                    r.presentTo && `para ${r.presentTo}`,
                    r.requestedIn && `en ${r.requestedIn}`,
                    r.copies !== null && `${r.copies} ${r.copies === 1 ? 'copia' : 'copias'}`,
                    r.expiresAt && `vence el ${shortDate(r.expiresAt)}`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <StatusPill tone={toneOf(r.status)}>{r.status}</StatusPill>
              {r.url && (
                <a
                  href={r.url}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-semibold text-blue hover:bg-accent focus-ring'
                >
                  Ver en el SIU
                  <ExternalLink aria-hidden='true' className='size-3.5' />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
