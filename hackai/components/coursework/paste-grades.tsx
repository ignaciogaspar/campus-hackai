'use client'

/* Pegar notas desde Excel o Google Sheets en una columna de Calificaciones, en
   dos pasos: se pega el texto y se ve la vista previa (a quién reconoció, a
   quién no y cómo leyó cada nota), y recién después se guarda. Nada se guarda
   hasta confirmar. Pensada primero para el celular: una lista de filas, sin
   tablas anchas. Qué se reconoce y cómo se convierte lo decide Seguimiento. */
import { ClipboardPaste } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { previewPastedGrades, savePastedGrades } from '@/app/actions/coursework'
import { GradeBadge } from '@/components/academic/grade-badge'
import { gradeInputValue, notesLabel, pastedText } from '@/components/coursework/format'
import { ActionForm, FormFeedback, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { StatusPill, type StatusTone } from '@/components/ui/status-pill'
import type { GradeScale, PasteOutcome, PastePreview, PasteRow } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

const LABEL = 'flex flex-col gap-1 text-[0.8125rem] font-semibold'
const BOX =
  'flex min-h-11 items-center rounded-[10px] border border-border bg-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
const HELP = 'font-normal text-muted-foreground'
const CHOICE =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[0.9375rem] hover:bg-muted has-[:checked]:bg-accent has-[:checked]:font-semibold'
const RADIO = 'size-4 accent-blue focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
const PRIMARY = cn(buttonVariants(), 'rounded-[10px] px-4 text-[0.9375rem] font-bold')

const SCALES: { value: GradeScale; label: string }[] = [
  { value: '1-10', label: 'De 1 a 10' },
  { value: '0-100', label: 'De 0 a 100 (se pasa a de 1 a 10)' }
]

const OUTCOMES: Record<PasteOutcome, { tone: StatusTone; label: string; why?: string }> = {
  nota: { tone: 'success', label: 'Nota' },
  ausente: { tone: 'info', label: 'Ausente' },
  invalida: { tone: 'danger', label: 'Nota inválida', why: 'La nota no es un número de la escala ni «A».' },
  'sin-nota': { tone: 'neutral', label: 'Sin nota', why: 'La línea no trae nota: no cambia nada.' },
  'no-reconocido': {
    tone: 'danger',
    label: 'No reconocido',
    why: 'Nadie de esta comisión tiene ese legajo, mail o nombre: no se guarda.'
  },
  formato: {
    tone: 'danger',
    label: 'Formato',
    why: 'No se pudo separar alumno y nota: copiá las dos columnas de la planilla.'
  },
  ambiguo: { tone: 'warning', label: 'Varios alumnos', why: 'El nombre coincide con más de un alumno: usá el legajo.' },
  'sin-cuenta': { tone: 'warning', label: 'Sin cuenta', why: 'Todavía no entró a HackAI: no se le puede cargar nota.' },
  repetido: { tone: 'neutral', label: 'Repetido', why: 'Ya venía en una línea anterior: usamos esa.' }
}

const BY = { legajo: 'por legajo', mail: 'por mail', nombre: 'por nombre' } as const

/** Primero lo que hay que revisar, después lo que se guarda. */
const needsReview = (row: PasteRow) => row.outcome !== 'nota' && row.outcome !== 'ausente'

/** Por qué la línea no se guarda, en dos renglones como mucho (la lista corta el resto). Un repetido dice en qué
    línea venía el alumno y, si esa nota no servía, que no se guarda ninguna de las dos. */
function whyOf(row: PasteRow): string | undefined {
  if (row.outcome !== 'repetido' || !row.repeats) return OUTCOMES[row.outcome].why
  const { line, invalid } = row.repeats
  return invalid
    ? `Ya venía en la línea ${line} con nota inválida: no se guarda ninguna.`
    : `Ya venía en la línea ${line}: usamos esa.`
}

function PreviewRow({ row, scale }: { row: PasteRow; scale: GradeScale }) {
  const { tone, label } = OUTCOMES[row.outcome]
  const why = whyOf(row)
  const converted = scale === '0-100' && row.outcome === 'nota' && row.raw !== ''
  return (
    <ListItem
      title={<span className='break-words'>{row.name ?? (row.key || 'Sin identificar')}</span>}
      description={why}
      meta={
        <>
          <span>Línea {row.line}</span>
          {row.legajo && row.by && (
            <span>
              · Legajo {row.legajo} ({BY[row.by]})
            </span>
          )}
          {!row.name && row.key && <span>· «{row.key}»</span>}
          {converted && (
            <span>
              · {row.raw} → {gradeInputValue(row.value)}
            </span>
          )}
        </>
      }
      end={row.outcome === 'nota' ? <GradeBadge grade={row.value} /> : <StatusPill tone={tone}>{label}</StatusPill>}
    />
  )
}

function Summary({ preview }: { preview: PastePreview }) {
  const { ready, absent, unmatched, invalid, skipped } = preview.counts
  return (
    <div className='flex flex-wrap gap-2'>
      <StatusPill tone='success'>{ready === 1 ? '1 nota' : `${ready} notas`}</StatusPill>
      {absent > 0 && <StatusPill tone='info'>{absent === 1 ? '1 ausente' : `${absent} ausentes`}</StatusPill>}
      {unmatched > 0 && (
        <StatusPill tone='danger'>{unmatched === 1 ? '1 sin reconocer' : `${unmatched} sin reconocer`}</StatusPill>
      )}
      {invalid > 0 && (
        <StatusPill tone='danger'>{invalid === 1 ? '1 nota inválida' : `${invalid} notas inválidas`}</StatusPill>
      )}
      {skipped > 0 && (
        <StatusPill tone='neutral'>{skipped === 1 ? '1 sin cambios' : `${skipped} sin cambios`}</StatusPill>
      )}
    </div>
  )
}

export function PasteGrades({
  subjectId,
  sectionId,
  columnId,
  columnName,
  published,
  cancelHref
}: {
  subjectId: string
  sectionId: string
  columnId: string
  columnName: string
  /** Si la columna ya está publicada: las notas que se guarden las ve el alumno al toque. */
  published: boolean
  cancelHref: string
}) {
  const [state, preview, pending] = useActionState(previewPastedGrades, { status: 'idle' })
  const heading = useRef<HTMLHeadingElement>(null)
  const previewAt = state.status === 'preview' ? state.at : null
  // Cada vista previa nueva queda a la vista y con el foco: en el celular, si no, sale debajo del pliegue.
  useEffect(() => {
    if (previewAt === null || !heading.current) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    heading.current.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    heading.current.focus({ preventScroll: true })
  }, [previewAt])
  const [text, setText] = useState('')
  const [scale, setScale] = useState<GradeScale>('1-10')
  const shown = state.status === 'preview' ? state : null
  const stale = shown !== null && (shown.text !== pastedText(text) || shown.scale !== scale)
  const toSave = shown ? shown.preview.counts.ready + shown.preview.counts.absent : 0
  const rows = shown
    ? [...shown.preview.rows.filter(needsReview), ...shown.preview.rows.filter((r) => !needsReview(r))]
    : []

  return (
    <div className='flex flex-col gap-4'>
      <Card className='p-4'>
        <p className='text-xs font-semibold text-muted-foreground'>Pegar notas</p>
        <h2 className='text-lg font-extrabold text-balance'>{columnName}</h2>
        <form action={preview} className='mt-3 flex flex-col gap-4'>
          <input type='hidden' name='sectionId' value={sectionId} />
          <input type='hidden' name='columnId' value={columnId} />
          <label className={LABEL}>
            Lo que copiaste de la planilla
            <span className={BOX}>
              <textarea
                name='text'
                rows={8}
                required
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-describedby='pegar-ayuda'
                autoComplete='off'
                spellCheck={false}
                className='min-h-40 w-full resize-y bg-transparent px-3 py-2 font-mono text-[0.875rem] font-normal outline-none'
              />
            </span>
            <span id='pegar-ayuda' className={HELP}>
              Copiá dos columnas en Excel o Google Sheets: el legajo (o el mail, o el apellido y nombre) y la nota. Por
              ejemplo, «30101» en una celda y «8,5» en la de al lado. Para un ausente, escribí «A». Coma o punto
              decimal.
            </span>
          </label>
          <fieldset className='flex flex-col'>
            <legend className='mb-1 text-[0.8125rem] font-semibold'>Escala de la planilla</legend>
            {SCALES.map((s) => (
              <label key={s.value} className={CHOICE}>
                <input
                  type='radio'
                  name='scale'
                  value={s.value}
                  checked={scale === s.value}
                  onChange={() => setScale(s.value)}
                  className={RADIO}
                />
                {s.label}
              </label>
            ))}
          </fieldset>
          <div className='flex flex-wrap gap-2'>
            <button type='submit' disabled={pending} aria-busy={pending || undefined} className={PRIMARY}>
              <ClipboardPaste aria-hidden='true' className='size-4' strokeWidth={2} />
              Ver vista previa
            </button>
            <Link
              href={cancelHref}
              className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-[10px] px-4 text-[0.9375rem]')}
            >
              Volver a Calificaciones
            </Link>
          </div>
          <FormFeedback error={state.status === 'error' ? state.message : null} />
        </form>
      </Card>

      {shown && (
        <section aria-labelledby='vista-previa' className='flex flex-col gap-3'>
          <Card className='flex flex-col gap-3 p-4'>
            <h2
              id='vista-previa'
              ref={heading}
              tabIndex={-1}
              className='scroll-mt-4 rounded-md text-lg font-extrabold outline-none focus-visible:outline-none'
            >
              Vista previa
            </h2>
            <Summary preview={shown.preview} />
            <p className='text-[0.8125rem] text-muted-foreground'>
              Todavía no se guardó nada. Lo que no reconocimos o no entendimos queda afuera; si querés, corregí el texto
              y volvé a ver la vista previa.
            </p>
            {published && (
              <p className='rounded-xl bg-ice/70 px-3 py-2 text-[0.8125rem] text-ink'>
                Esta columna ya está publicada: los alumnos ven enseguida las notas que guardes.
              </p>
            )}
            {stale && (
              <p
                role='status'
                className='rounded-xl bg-error-background px-3 py-2 text-[0.8125rem] font-semibold text-destructive'
              >
                Cambiaste el texto o la escala: volvé a ver la vista previa antes de guardar
              </p>
            )}
            <ActionForm action={savePastedGrades} className='flex flex-col gap-2'>
              <input type='hidden' name='subjectId' value={subjectId} />
              <input type='hidden' name='sectionId' value={sectionId} />
              <input type='hidden' name='columnId' value={columnId} />
              <input type='hidden' name='text' value={shown.text} />
              <input type='hidden' name='scale' value={shown.scale} />
              <div className='flex flex-wrap gap-2'>
                <SubmitButton disabled={toSave === 0 || stale} className={PRIMARY}>
                  {toSave === 0 ? 'No hay notas para guardar' : `Guardar ${notesLabel(toSave)}`}
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
          {rows.length > 0 && (
            <Card>
              <List aria-label='Líneas pegadas'>
                {rows.map((row) => (
                  <PreviewRow key={row.line} row={row} scale={shown.scale} />
                ))}
              </List>
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
