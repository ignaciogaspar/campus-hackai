'use client'
/* Solicitudes a la secretaría, simuladas: una lista de pedidos de ejemplo con
   su estado y «Nueva solicitud», que suma un pedido con el número que sigue.
   No llega a ningún lado: vive en esta pestaña hasta que se recarga, y el éxito
   lo dice así. En el SIU real, las solicitudes se hacen en la Autogestión. */
import { CircleCheck, FilePlus2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
import { fullDate } from '@/components/dates'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'
import { dayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

type RequestStatus = 'entregada' | 'en-tramite' | 'recibida' | 'rechazada'

/** `date`: instante ISO de cuándo se pidió. */
type PendingRequest = { id: string; type: string; date: string; status: RequestStatus }

const STATUSES: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  entregada: { label: 'Entregada', tone: 'success' },
  'en-tramite': { label: 'En trámite', tone: 'warning' },
  recibida: { label: 'Recibida', tone: 'info' },
  rechazada: { label: 'Rechazada', tone: 'danger' }
}

/** Lo que se le pide a la secretaría. Las constancias no: se piden en la Autogestión, en Constancias. */
const TYPES = [
  'Certificado analítico parcial',
  'Certificado de materias aprobadas',
  'Equivalencia de materias',
  'Cambio de comisión',
  'Reincorporación'
]

const SAMPLE: PendingRequest[] = [
  {
    id: 'S-2026-01842',
    type: 'Certificado analítico parcial',
    date: '2026-11-04T10:15:00-03:00',
    status: 'en-tramite'
  },
  { id: 'S-2026-01563', type: 'Cambio de comisión', date: '2026-09-02T09:40:00-03:00', status: 'rechazada' },
  {
    id: 'S-2026-01217',
    type: 'Certificado de materias aprobadas',
    date: '2026-08-18T16:05:00-03:00',
    status: 'entregada'
  },
  { id: 'S-2026-00305', type: 'Equivalencia de materias', date: '2026-03-12T11:30:00-03:00', status: 'entregada' }
]

/** El número que sigue al más alto de la lista, con el año de la fecha: «S-2026-01843». */
function nextId(requests: PendingRequest[], now: string): string {
  const last = Math.max(0, ...requests.map((r) => Number(r.id.split('-').at(-1))))
  return `S-${dayKey(now).slice(0, 4)}-${String(last + 1).padStart(5, '0')}`
}

const rowId = (id: string) => `solicitud-${id}`

function NewRequest({
  requests,
  now,
  onCreate,
  onShow
}: {
  requests: PendingRequest[]
  now: string
  onCreate: (request: PendingRequest) => void
  /** Después de cerrar la hoja con «Ver mi solicitud»: lleva a la fila nueva. */
  onShow: (id: string) => void
}) {
  const [created, setCreated] = useState<PendingRequest | null>(null)
  // La fila a mostrar al cerrar: un ref, porque la hoja se cierra antes de que se vuelva a dibujar.
  const toShow = useRef<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const type = String(new FormData(event.currentTarget).get('type') ?? TYPES[0])
    const request: PendingRequest = { id: nextId(requests, now), type, date: now, status: 'recibida' }
    onCreate(request)
    setCreated(request)
  }

  function closeAutoFocus(event: Event) {
    const id = toShow.current
    if (!id) return
    toShow.current = null
    event.preventDefault()
    onShow(id)
  }

  return (
    <Sheet onOpenChange={(open) => !open && setCreated(null)}>
      <SheetTrigger asChild>
        <Button size='lg' className='min-h-10 flex-none gap-1.5 font-semibold'>
          <FilePlus2 aria-hidden='true' data-icon='inline-start' />
          Nueva solicitud
        </Button>
      </SheetTrigger>
      <SheetContent
        side='right'
        title='Nueva solicitud'
        description='Es una simulación: no se manda a la secretaría.'
        onCloseAutoFocus={closeAutoFocus}
      >
        {created ? (
          <div role='status' className='flex flex-col gap-3'>
            <p className='flex items-start gap-2.5 rounded-xl bg-success-background px-3 py-3 text-[0.875rem] text-ink'>
              <CircleCheck aria-hidden='true' className='mt-px size-5 flex-none text-success' strokeWidth={2} />
              <span>
                <b>
                  Quedó registrada con el <span className='whitespace-nowrap'>n.º {created.id}</span>.
                </b>{' '}
                {created.type}. Es una simulación: se borra al recargar.
              </span>
            </p>
            <SheetClose asChild>
              <Button
                size='lg'
                className='min-h-11 w-full font-semibold lg:w-auto lg:self-start'
                onClick={() => {
                  toShow.current = created.id
                }}
              >
                Ver mi solicitud
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
            <Button type='submit' size='lg' className='min-h-11 w-full font-semibold lg:w-auto lg:self-start'>
              Enviar solicitud
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** `heading`: el título y la explicación de la sección, que van a la izquierda de «Nueva solicitud».
    `now`: el reloj de la app, para la fecha de lo que se pide. */
export function Requests({ heading, now }: { heading: ReactNode; now: string }) {
  const [requests, setRequests] = useState(SAMPLE)
  const [shown, setShown] = useState<string | null>(null)

  function show(id: string) {
    setShown(id)
    const row = document.getElementById(rowId(id))
    if (!row) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    row.focus({ preventScroll: true })
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        {heading}
        <NewRequest requests={requests} now={now} onCreate={(r) => setRequests((list) => [r, ...list])} onShow={show} />
      </div>
      <ul className='divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card'>
        {requests.map((r) => (
          <li
            key={r.id}
            id={rowId(r.id)}
            // Fuera del orden del Tab, pero se puede enfocar: «Ver mi solicitud» deja el foco en la fila nueva.
            tabIndex={-1}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors outline-none motion-reduce:transition-none',
              r.id === shown && 'bg-success-background shadow-[inset_4px_0_0_var(--color-success)]'
            )}
          >
            <div className='min-w-0 flex-1'>
              <p className='text-[0.875rem] font-semibold text-ink'>{r.type}</p>
              <p className='text-[0.75rem] text-muted-foreground tabular-nums'>
                <span className='whitespace-nowrap'>N.º {r.id}</span> ·{' '}
                <time dateTime={r.date} className='whitespace-nowrap'>
                  {fullDate(r.date)}
                </time>
              </p>
            </div>
            <StatusPill tone={STATUSES[r.status].tone}>{STATUSES[r.status].label}</StatusPill>
          </li>
        ))}
      </ul>
    </div>
  )
}
