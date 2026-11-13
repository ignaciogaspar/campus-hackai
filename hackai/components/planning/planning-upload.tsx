'use client'

/* Cargar el planning, para secretaría: se elige si la planilla reemplaza todo
   o se suma a lo cargado, se sube (.xlsx o .csv) o se pegan las filas copiadas
   de Excel o Google Sheets, y se ve qué pasó con cada fila antes de guardar.
   Las filas con problemas van primero y dicen qué les pasa (un aula ocupada,
   la misma clase dos veces, algo que no se entendió); mientras haya alguna no
   se guarda nada. Las repetidas se cargan una sola vez. Qué se entiende y qué
   choca lo decide Planning. */
import { Download, FileSpreadsheet } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { type PlanningPreviewState, previewPlanning, savePlanning } from '@/app/actions/planning'
import { whenLabel } from '@/components/planning/format'
import { ActionForm, FormFeedback, SubmitButton } from '@/components/spaces/action-form'
import { hhmm } from '@/components/today/calendar-layout'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { StatusPill } from '@/components/ui/status-pill'
import type { PlanningEntryInput, PlanningMode, PlanningPreviewRow } from '@/lib/core/planning'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'
const PRIMARY = cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')
const SECONDARY = cn(buttonVariants({ variant: 'outline' }), 'rounded-[10px] px-4 text-[0.9375rem] font-semibold')
const CHOICE =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] px-2 py-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent'
const RADIO =
  'mt-1 size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'

const MODES: { value: PlanningMode; label: string; help: string }[] = [
  {
    value: 'agregar',
    label: 'Sumar a lo cargado',
    help: 'Para cambios de último momento o clases nuevas. Se controla que no choquen con lo que ya está.'
  },
  {
    value: 'reemplazar',
    label: 'Reemplazar todo el planning',
    help: 'Para la planilla del cuatrimestre entero: lo cargado antes se borra.'
  }
]

const classTitle = (e: PlanningEntryInput) => (e.section ? `${e.subject} · Comisión ${e.section}` : e.subject)

function EntryMeta({ line, e }: { line: number; e: PlanningEntryInput }) {
  return (
    <>
      <span>Línea {line}</span>
      <span>
        · {whenLabel(e)}, {hhmm(e.start)} a {hhmm(e.end)}
      </span>
      <span>· {[e.room, e.building, e.school].filter(Boolean).join(' · ')}</span>
    </>
  )
}

function kindPill(e: PlanningEntryInput) {
  if (e.cancelled) return <StatusPill tone='warning'>Suspendida</StatusPill>
  return e.date ? <StatusPill tone='info'>Ese día</StatusPill> : <StatusPill tone='success'>Semanal</StatusPill>
}

function PreviewRow({ row }: { row: PlanningPreviewRow }) {
  if (row.status === 'error') {
    return (
      <ListItem
        title={`Línea ${row.line}`}
        description={<span className='text-destructive'>{row.error}</span>}
        end={<StatusPill tone='danger'>Con problemas</StatusPill>}
      />
    )
  }
  return (
    <ListItem
      title={<span className='break-words'>{classTitle(row.entry)}</span>}
      description={row.note ?? undefined}
      meta={<EntryMeta line={row.line} e={row.entry} />}
      end={
        row.status === 'repetida' ? (
          <StatusPill tone='neutral'>Repetida</StatusPill>
        ) : row.note ? (
          <StatusPill tone='warning'>Clase extra</StatusPill>
        ) : (
          kindPill(row.entry)
        )
      }
    />
  )
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

function Preview({ state }: { state: Extract<PlanningPreviewState, { status: 'preview' }> }) {
  const { ok, duplicates, errors } = state.preview.counts
  const order: PlanningPreviewRow['status'][] = ['error', 'repetida', 'ok']
  const rows = order.flatMap((status) => state.preview.rows.filter((r) => r.status === status))
  const heading = useRef<HTMLHeadingElement>(null)
  // La vista previa aparece debajo del formulario: se baja hasta ella y se le da el foco, así se ve el botón de
  // guardar sin buscarlo y el lector de pantalla la anuncia.
  useEffect(() => {
    heading.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    heading.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section aria-labelledby='vista-previa' className='flex scroll-mt-4 flex-col gap-3'>
      <Card className='flex flex-col gap-3 p-4'>
        <h2 id='vista-previa' ref={heading} tabIndex={-1} className='scroll-mt-4 text-lg font-extrabold outline-none'>
          Vista previa de {state.source}
        </h2>
        <div className='flex flex-wrap gap-2'>
          <StatusPill tone='success'>{plural(ok, 'clase para guardar', 'clases para guardar')}</StatusPill>
          {duplicates > 0 && <StatusPill tone='neutral'>{plural(duplicates, 'repetida', 'repetidas')}</StatusPill>}
          {errors > 0 && (
            <StatusPill tone='danger'>{plural(errors, 'fila con problemas', 'filas con problemas')}</StatusPill>
          )}
        </div>
        {errors > 0 ? (
          <p
            role='alert'
            className='rounded-xl bg-destructive/10 px-3 py-2 text-[0.8125rem] font-semibold text-destructive'
          >
            No se puede guardar todavía: {plural(errors, 'fila tiene', 'filas tienen')} problemas. Cada una dice qué le
            pasa; corregilas en la planilla y volvé a ver la vista previa.
          </p>
        ) : (
          <p className='text-[0.8125rem] text-muted-foreground'>
            Todavía no se guardó nada.
            {duplicates > 0 && ' Las repetidas se cargan una sola vez.'}
            {state.mode === 'reemplazar' && ' Al guardar, lo cargado antes se reemplaza por esta planilla.'}
          </p>
        )}
        <ActionForm action={savePlanning} className='flex flex-col gap-2'>
          <input type='hidden' name='rows' value={state.rows} />
          <input type='hidden' name='mode' value={state.mode} />
          <SubmitButton disabled={errors > 0 || ok === 0} className={cn(PRIMARY, 'self-start')}>
            {state.mode === 'reemplazar' ? 'Reemplazar el planning' : 'Sumar al planning'}
          </SubmitButton>
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
          <fieldset className='flex flex-col'>
            <legend className='mb-1 text-[0.8125rem] font-semibold'>Qué hacer con la planilla</legend>
            {MODES.map((m, i) => (
              <label key={m.value} className={CHOICE}>
                <input type='radio' name='mode' value={m.value} defaultChecked={i === 0} className={RADIO} />
                <span className='flex flex-col'>
                  <span className='font-semibold'>{m.label}</span>
                  <span className='text-[0.8125rem] text-muted-foreground'>{m.help}</span>
                </span>
              </label>
            ))}
          </fieldset>
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
              aula. Para suspender la clase de un día, poné la fecha y escribí «suspendida» en «Estado». Si elegiste un
              archivo, se usa el archivo.
            </span>
          </label>
          <div className='flex flex-wrap gap-2'>
            <button type='submit' disabled={pending} aria-busy={pending || undefined} className={PRIMARY}>
              <FileSpreadsheet aria-hidden='true' className='size-4' strokeWidth={2} />
              Revisar la planilla
            </button>
            <span className={cn('self-center text-[0.8125rem]', HELP)}>
              Primero se revisa; el botón para guardar aparece en la vista previa.
            </span>
          </div>
          <FormFeedback error={state.status === 'error' ? state.message : null} />
        </form>
      </Card>
      {state.status === 'preview' && <Preview key={state.at} state={state} />}
    </div>
  )
}
