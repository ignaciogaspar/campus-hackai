'use client'
/* Solicitudes a la secretaría, simuladas: una lista de pedidos de ejemplo con
   su estado y «Nueva solicitud», que suma un pedido con un número inventado.
   No llega a ningún lado: vive en esta pestaña hasta que se recarga. En el SIU
   real, las solicitudes se hacen en la Autogestión. */
import { CircleCheck, FilePlus2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'

type RequestStatus = 'entregada' | 'en-tramite' | 'recibida' | 'rechazada'

type PendingRequest = { id: string; type: string; date: string; status: RequestStatus }

const STATUSES: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  entregada: { label: 'Entregada', tone: 'success' },
  'en-tramite': { label: 'En trámite', tone: 'warning' },
  recibida: { label: 'Recibida', tone: 'info' },
  rechazada: { label: 'Rechazada', tone: 'danger' }
}

const TYPES = [
  'Constancia de alumno regular',
  'Certificado analítico parcial',
  'Certificado de materias aprobadas',
  'Equivalencia de materias',
  'Cambio de comisión',
  'Reincorporación'
]

const SAMPLE: PendingRequest[] = [
  { id: 'S-2026-01842', type: 'Certificado analítico parcial', date: '4 nov 2026', status: 'en-tramite' },
  { id: 'S-2026-01563', type: 'Cambio de comisión', date: '2 sep 2026', status: 'rechazada' },
  { id: 'S-2026-01217', type: 'Constancia de alumno regular', date: '18 ago 2026', status: 'entregada' },
  { id: 'S-2026-00305', type: 'Equivalencia de materias', date: '12 mar 2026', status: 'entregada' }
]

const today = () =>
  new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')

function NewRequest({ onCreate }: { onCreate: (request: PendingRequest) => void }) {
  const [created, setCreated] = useState<PendingRequest | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const type = String(new FormData(event.currentTarget).get('type') ?? TYPES[0])
    const request: PendingRequest = {
      id: `S-2026-0${Math.floor(1900 + Math.random() * 99)}`,
      type,
      date: today(),
      status: 'recibida'
    }
    onCreate(request)
    setCreated(request)
  }

  return (
    <Sheet onOpenChange={(open) => !open && setCreated(null)}>
      <SheetTrigger asChild>
        <Button size='lg' className='min-h-10 flex-none gap-1.5 font-semibold'>
          <FilePlus2 aria-hidden='true' data-icon='inline-start' />
          Nueva solicitud
        </Button>
      </SheetTrigger>
      <SheetContent side='right' title='Nueva solicitud' description='Es una simulación: no se manda a la secretaría.'>
        {created ? (
          <div role='status' className='flex flex-col gap-3'>
            <p className='flex items-start gap-2.5 rounded-xl bg-success-background px-3 py-3 text-[0.875rem] text-ink'>
              <CircleCheck aria-hidden='true' className='mt-px size-5 flex-none text-success' strokeWidth={2} />
              <span>
                <b>Recibimos tu solicitud.</b> {created.type}, n.º {created.id}. Te avisamos cuando cambie de estado.
              </span>
            </p>
            <SheetClose asChild>
              <Button variant='outline' size='lg' className='min-h-11 self-start'>
                Listo
              </Button>
            </SheetClose>
          </div>
        ) : (
          <form onSubmit={submit} className='flex flex-col gap-4'>
            <label className='flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-ink'>
              Qué necesitás
              <Select
                name='type'
                defaultValue={TYPES[0]}
                options={TYPES.map((t) => ({ value: t, label: t }))}
                className='h-11 pl-3 font-normal'
              />
            </label>
            <label className='flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-ink'>
              Comentario <span className='font-normal text-muted-foreground'>(opcional)</span>
              <textarea
                name='comment'
                rows={4}
                placeholder='Por ejemplo, para qué la necesitás o a quién va dirigida.'
                className='rounded-xl border border-border bg-card px-3 py-2.5 text-[0.875rem] font-normal focus-ring'
              />
            </label>
            <Button type='submit' size='lg' className='min-h-11 self-start font-semibold'>
              Enviar solicitud
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** `heading`: el título y la explicación de la sección, que van a la izquierda de «Nueva solicitud». */
export function Requests({ heading }: { heading: ReactNode }) {
  const [requests, setRequests] = useState(SAMPLE)
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        {heading}
        <NewRequest onCreate={(r) => setRequests((list) => [r, ...list])} />
      </div>
      <ul className='divide-y divide-border rounded-2xl border border-border bg-card'>
        {requests.map((r) => (
          <li key={r.id} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3'>
            <div className='min-w-0 flex-1'>
              <p className='text-[0.875rem] font-semibold text-ink'>{r.type}</p>
              <p className='text-[0.75rem] text-muted-foreground tabular-nums'>
                N.º {r.id} · {r.date}
              </p>
            </div>
            <StatusPill tone={STATUSES[r.status].tone}>{STATUSES[r.status].label}</StatusPill>
          </li>
        ))}
      </ul>
    </div>
  )
}
