'use client'

/* Cargar el planning, para secretaría: se sube la planilla (.xlsx o .csv) o se
   pegan las filas copiadas de Excel o Google Sheets, se ve qué se entendió de
   cada fila y recién después se guarda, reemplazando todo el planning o
   sumando las clases. Nada se guarda hasta confirmar. Qué se entiende de cada
   fila lo decide Planning. */
import { Download, FileSpreadsheet } from 'lucide-react'
import { useActionState } from 'react'
import { type PlanningPreviewState, previewPlanning, savePlanning } from '@/app/actions/planning'
import { whenLabel } from '@/components/planning/format'
import { ActionForm, FormFeedback, SubmitButton } from '@/components/spaces/action-form'
import { hhmm } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { StatusPill } from '@/components/ui/status-pill'
import type { PlanningPreviewRow } from '@/lib/core/planning'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'
const PRIMARY = cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')
const SECONDARY = cn(buttonVariants({ variant: 'outline' }), 'rounded-[10px] px-4 text-[0.9375rem] font-semibold')

function PreviewRow({ row }: { row: PlanningPreviewRow }) {
  if ('error' in row) {
    return (
      <ListItem
        title={`Línea ${row.line}`}
        description={row.error}
        end={<StatusPill tone='danger'>No se guarda</StatusPill>}
      />
    )
  }
  const e = row.entry
  return (
    <ListItem
      title={<span className='break-words'>{e.section ? `${e.subject} · Comisión ${e.section}` : e.subject}</span>}
      meta={
        <>
          <span>Línea {row.line}</span>
          <span>
            · {whenLabel(e)}, {hhmm(e.start)} a {hhmm(e.end)}
          </span>
          <span>· {[e.room, e.building, e.school].filter(Boolean).join(' · ')}</span>
        </>
      }
      end={
        e.cancelled ? (
          <StatusPill tone='warning'>Suspendida</StatusPill>
        ) : e.date ? (
          <StatusPill tone='info'>Ese día</StatusPill>
        ) : (
          <StatusPill tone='success'>Semanal</StatusPill>
        )
      }
    />
  )
}

function Preview({ state }: { state: Extract<PlanningPreviewState, { status: 'preview' }> }) {
  const { ok, errors } = state.preview.counts
  const rows = [...state.preview.rows.filter((r) => 'error' in r), ...state.preview.rows.filter((r) => !('error' in r))]
  return (
    <section aria-labelledby='vista-previa' className='flex flex-col gap-3'>
      <Card className='flex flex-col gap-3 p-4'>
        <h2 id='vista-previa' className='text-lg font-extrabold'>
          Vista previa de {state.source}
        </h2>
        <div className='flex flex-wrap gap-2'>
          <StatusPill tone='success'>{ok === 1 ? '1 clase' : `${ok} clases`}</StatusPill>
          {errors > 0 && (
            <StatusPill tone='danger'>
              {errors === 1 ? '1 fila con problemas' : `${errors} filas con problemas`}
            </StatusPill>
          )}
        </div>
        <p className='text-[0.8125rem] text-muted-foreground'>
          Todavía no se guardó nada. Las filas con problemas quedan afuera; si querés, corregí la planilla y volvé a ver
          la vista previa.
        </p>
        <ActionForm action={savePlanning} className='flex flex-col gap-2'>
          <input type='hidden' name='rows' value={state.rows} />
          <div className='flex flex-wrap gap-2'>
            <SubmitButton name='mode' value='reemplazar' disabled={ok === 0} className={PRIMARY}>
              Reemplazar el planning
            </SubmitButton>
            <SubmitButton name='mode' value='agregar' disabled={ok === 0} className={SECONDARY}>
              Sumar al planning
            </SubmitButton>
          </div>
          <p className={cn('text-[0.8125rem]', HELP)}>
            «Reemplazar» es para la planilla del cuatrimestre entero; «Sumar», para cambios de último momento.
          </p>
        </ActionForm>
      </Card>
      <List>
        {rows.map((r) => (
          <PreviewRow key={r.line} row={r} />
        ))}
      </List>
    </section>
  )
}

export function PlanningUpload() {
  const [state, preview, pending] = useActionState(previewPlanning, { status: 'idle' })
  return (
    <div className='flex flex-col gap-4'>
      <Card className='p-4'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <p className='text-xs font-semibold text-muted-foreground'>Planilla de clases</p>
            <h2 className='text-lg font-extrabold text-balance'>Subí o pegá la planilla</h2>
          </div>
          <a href='/planning/plantilla' download className={cn(SECONDARY, 'min-h-11')}>
            <Download aria-hidden='true' className='size-4' strokeWidth={2} />
            Planilla de ejemplo
          </a>
        </div>
        <form action={preview} className='mt-3 flex flex-col gap-4'>
          <label className={LABEL}>
            Archivo
            <span className={cn(BOX, 'px-3')}>
              <input
                type='file'
                name='file'
                accept='.xlsx,.csv,.tsv,.txt'
                className='w-full py-2 text-[0.875rem] font-normal file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:font-semibold file:text-blue'
              />
            </span>
            <span className={HELP}>Un .xlsx de Excel o un .csv. Se lee la primera hoja.</span>
          </label>
          <label className={LABEL}>
            O pegá lo que copiaste de la planilla
            <span className={BOX}>
              <textarea
                name='text'
                rows={6}
                aria-describedby='planning-ayuda'
                autoComplete='off'
                spellCheck={false}
                placeholder={
                  'Materia\tComisión\tFacultad\tEdificio\tAula\tDía\tFecha\tInicio\tFin\tEstado\nAnálisis Matemático I\tA\tFI\tPilar - Edificio Olivo\tAula A9\tlunes\t\t9:00\t13:00\t'
                }
                className='min-h-36 w-full resize-y bg-transparent px-3 py-2 font-mono text-[0.8125rem] font-normal outline-none'
              />
            </span>
            <span id='planning-ayuda' className={HELP}>
              Una fila por clase. Con «Día» se repite cada semana; con «Fecha» es de ese día solo, como un cambio de
              aula. Para suspender la clase de un día, escribí «suspendida» en «Estado». Si elegiste un archivo, se usa
              el archivo.
            </span>
          </label>
          <div className='flex flex-wrap gap-2'>
            <button type='submit' disabled={pending} aria-busy={pending || undefined} className={PRIMARY}>
              <FileSpreadsheet aria-hidden='true' className='size-4' strokeWidth={2} />
              Ver vista previa
            </button>
          </div>
          <FormFeedback error={state.status === 'error' ? state.message : null} />
        </form>
      </Card>
      {state.status === 'preview' && <Preview key={state.at} state={state} />}
    </div>
  )
}
