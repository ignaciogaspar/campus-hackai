'use client'
/* Las solicitudes reales del SIU (Trámites > Solicitudes de la Autogestión) y
   «Nueva solicitud» de una constancia. La lista va como la escribe el SIU: tipo,
   fecha, a quién se presenta, dónde se pidió, copias, estado y vencimiento; lo
   que no dice queda sin mostrar. Pedir la de alumno regular va al SIU de
   verdad (`HACKAI_SIU_ESCRITURAS=si`); la de examen final, o sin escrituras,
   se pide en la Autogestión. */
import { CircleCheck, ExternalLink, FilePlus2 } from 'lucide-react'
import { useActionState } from 'react'
import { requestCertificateAction } from '@/app/(app)/tramites/actions'
import { shortDate } from '@/components/dates'
import { INITIAL_REQUEST_STATE } from '@/components/procedures/request-state'
import { Button } from '@/components/ui/button'
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

function NewRequest({ selfServiceUrl }: { selfServiceUrl: string }) {
  const [state, submit, pending] = useActionState(requestCertificateAction, INITIAL_REQUEST_STATE)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size='lg' className='min-h-10 gap-1.5 font-semibold'>
          <FilePlus2 aria-hidden='true' data-icon='inline-start' />
          Nueva solicitud
        </Button>
      </SheetTrigger>
      <SheetContent side='right' title='Nueva solicitud' description='Se pide en el SIU con tu cuenta.'>
        {state.kind === 'pedida' ? (
          <div role='status' className='flex flex-col gap-3'>
            <p className='flex items-start gap-2.5 rounded-xl bg-success-background px-3 py-3 text-[0.875rem] text-ink'>
              <CircleCheck aria-hidden='true' className='mt-px size-5 flex-none text-success' strokeWidth={2} />
              <span>
                <b>El SIU recibió tu solicitud.</b> {state.message}
              </span>
            </p>
            <SheetClose asChild>
              <Button variant='outline' size='lg' className='min-h-11 self-start'>
                Listo
              </Button>
            </SheetClose>
          </div>
        ) : state.kind === 'autogestion' ? (
          <div role='status' className='flex flex-col gap-3 text-[0.875rem] text-ink'>
            <p>Esta constancia se pide en la Autogestión del SIU.</p>
            <a
              href={selfServiceUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg border border-border px-3 font-semibold text-blue hover:bg-accent focus-ring'
            >
              Pedirla en el SIU
              <ExternalLink aria-hidden='true' className='size-4' />
            </a>
          </div>
        ) : (
          <form action={submit} className='flex flex-col gap-4'>
            {state.kind === 'error' && (
              <p role='alert' className='rounded-xl bg-danger-background px-3 py-2.5 text-[0.875rem] text-ink'>
                {state.message}
              </p>
            )}
            <label className={LABEL}>
              Qué constancia
              <select name='type' className={FIELD} defaultValue='alumno-regular'>
                <option value='alumno-regular'>Constancia de alumno regular</option>
                <option value='examen-final'>Constancia de examen final (se pide en el SIU)</option>
              </select>
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
              {pending ? 'Pidiendo…' : 'Pedir en el SIU'}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function SiuRequests({
  requests,
  selfServiceUrl
}: {
  requests: SiuCertificateRequest[]
  selfServiceUrl: string
}) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
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
                  className='inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-semibold text-blue hover:bg-accent focus-ring'
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
