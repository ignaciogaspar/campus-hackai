'use client'

/* El asistente del Planning, para secretaría: se escribe el cambio como se lo
   diría a alguien («suspendé Termodinámica del viernes 13», «AM1 comisión A
   pasa los lunes al Aula A10») y el asistente propone qué sumar y qué sacar.
   La propuesta pasa por los mismos chequeos que la planilla: lo que choca dice
   por qué y no deja guardar. Nada se guarda hasta confirmar. Si el asistente
   necesita un dato, pregunta; se responde escribiendo el pedido de nuevo con
   ese dato. Qué se entiende y qué choca lo decide Planning. */
import { Sparkles, Trash2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { type AssistantState, applyPlanningProposal, askPlanningAssistant } from '@/app/actions/planning'
import type { SpaceActionState } from '@/app/actions/spaces'
import { placeOf, whenLabel } from '@/components/planning/format'
import { PreviewRow } from '@/components/planning/planning-upload'
import { FormFeedback } from '@/components/spaces/action-form'
import { hhmm } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { StatusPill } from '@/components/ui/status-pill'
import type { PlanningEntry } from '@/lib/core/planning'
import { cn } from '@/lib/utils'

const PRIMARY = cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

const EXAMPLES = [
  'Suspendé Termodinámica comisión A del viernes 13',
  'El miércoles 18, Análisis Matemático I comisión A va al Aula A10',
  'Sacá del planning Negocios Digitales'
]

function RemovalRow({ entry }: { entry: PlanningEntry }) {
  return (
    <ListItem
      title={
        <span className='break-words'>
          {entry.section ? `${entry.subject} · Comisión ${entry.section}` : entry.subject}
        </span>
      }
      meta={
        <>
          <span>
            {whenLabel(entry)}, {hhmm(entry.start)} a {hhmm(entry.end)}
          </span>
          <span>· {[entry.room, placeOf(entry), entry.school].filter(Boolean).join(' · ')}</span>
        </>
      }
      end={
        <StatusPill tone='danger'>
          <Trash2 aria-hidden='true' className='size-3.5' strokeWidth={2} />
          Se saca
        </StatusPill>
      }
    />
  )
}

function Proposal({ state }: { state: Extract<AssistantState, { status: 'proposal' }> }) {
  const [saved, confirm, saving] = useActionState<SpaceActionState, FormData>(applyPlanningProposal, {
    status: 'idle'
  })
  const { proposal } = state
  if (saved.status === 'ok') {
    return (
      <p role='status' className='rounded-xl bg-success/10 px-4 py-3 text-[0.875rem] font-semibold text-success'>
        {saved.message}
      </p>
    )
  }
  if (proposal.question) {
    return (
      <p role='status' className='rounded-xl bg-ice/70 px-4 py-3 text-[0.875rem] text-ink'>
        <b>El asistente pregunta:</b> {proposal.question} Sumá ese dato al pedido y volvé a enviarlo.
      </p>
    )
  }
  const { errors, ok } = proposal.preview.counts
  const nothing = ok === 0 && proposal.removals.length === 0
  return (
    <section aria-label='Lo que propone el asistente' className='flex flex-col gap-3'>
      {errors > 0 && (
        <p
          role='alert'
          className='rounded-xl bg-destructive/10 px-3 py-2 text-[0.8125rem] font-semibold text-destructive'
        >
          No se puede guardar: algo choca con lo cargado. Cada fila dice qué le pasa; corregí el pedido y volvé a
          escribirlo.
        </p>
      )}
      {nothing && errors === 0 && (
        <p role='status' className='rounded-xl bg-muted px-3 py-2 text-[0.8125rem] font-semibold text-ink'>
          No hay nada nuevo para guardar: lo que pediste ya está así en el planning.
        </p>
      )}
      <List>
        {proposal.removals.map((e) => (
          <RemovalRow key={e.id} entry={e} />
        ))}
        {proposal.preview.rows.map((r) => (
          <PreviewRow key={r.line} row={r} />
        ))}
      </List>
      <form action={confirm} className='flex flex-col gap-2'>
        <input type='hidden' name='rows' value={state.rows} />
        <input type='hidden' name='removals' value={state.removals} />
        <button
          type='submit'
          disabled={saving || errors > 0 || nothing}
          aria-busy={saving || undefined}
          className={cn(PRIMARY, 'self-start')}
        >
          Confirmar los cambios
        </button>
        <FormFeedback error={saved.status === 'error' ? saved.message : null} />
      </form>
    </section>
  )
}

export function PlanningAssistant() {
  const [state, ask, pending] = useActionState(askPlanningAssistant, { status: 'idle' })
  // Controlado: React vacía el formulario al enviarlo, y si el asistente pregunta algo, se completa el mismo pedido.
  const [message, setMessage] = useState('')
  return (
    <Card className='flex flex-col gap-4 p-4'>
      <div>
        <p className='text-xs font-semibold text-muted-foreground'>Asistente</p>
        <h2 className='text-lg font-extrabold'>Pedíselo al asistente</h2>
        <p className='pt-1 text-[0.8125rem] text-muted-foreground'>
          Escribí el cambio como se lo dirías a alguien. Te muestra qué entendió y no guarda nada hasta que confirmes.
        </p>
      </div>
      <form action={ask} className='flex flex-col gap-3'>
        <label className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
          Qué querés cambiar
          <span className={BOX}>
            <textarea
              name='message'
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              required
              maxLength={1000}
              autoComplete='off'
              aria-describedby='asistente-ejemplos'
              placeholder={EXAMPLES[0]}
              className='min-h-20 w-full resize-y bg-transparent px-3 py-2 text-[0.9375rem] font-normal outline-none'
            />
          </span>
          <span id='asistente-ejemplos' className='font-normal text-muted-foreground'>
            Por ejemplo: «{EXAMPLES[1]}» o «{EXAMPLES[2]}».
          </span>
        </label>
        <div className='flex flex-wrap items-center gap-3'>
          <button type='submit' disabled={pending} aria-busy={pending || undefined} className={PRIMARY}>
            <Sparkles aria-hidden='true' className='size-4' strokeWidth={2} />
            {pending ? 'Pensando…' : 'Ver qué entiende'}
          </button>
          {state.status === 'proposal' && (
            <span className='text-[0.8125rem] text-muted-foreground'>
              Te quedan {state.proposal.remaining} pedidos hoy.
            </span>
          )}
        </div>
        <FormFeedback error={state.status === 'error' ? state.message : null} />
      </form>
      {state.status === 'proposal' && <Proposal key={state.at} state={state} />}
    </Card>
  )
}
