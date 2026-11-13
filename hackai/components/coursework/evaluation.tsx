/* Cómo se evalúa la comisión, para el docente: las instancias de examen (las
   del SIU, a las que les puede corregir el nombre, el tipo y la fecha, y las que
   suma en HackAI), y si la materia se promociona. Cada instancia se edita en el
   lugar, desplegándola: sin ventanas encima. Agregar va arriba de la lista y
   borrar, en el panel de cada una, con confirmación. */
import { CalendarClock, ChevronDown, Lock, Plus, Trash2 } from 'lucide-react'
import { deleteExam, saveExam, savePromotion } from '@/app/actions/coursework'
import { DateTimeFields } from '@/components/coursework/date-time-fields'
import { BOX, GHOST, HELP, INPUT, LABEL, PRIMARY } from '@/components/coursework/fields'
import { gradeInputValue } from '@/components/coursework/format'
import { dueTime } from '@/components/dates'
import { ActionForm, FieldError, SubmitButton } from '@/components/spaces/action-form'
import { Card } from '@/components/ui/card'
import { OriginBadge } from '@/components/ui/origin-badge'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import type { ExamInstance, ExamKind, Promotion } from '@/lib/core/coursework'
import { cn } from '@/lib/utils'

const KINDS: { value: ExamKind; label: string }[] = [
  { value: 'parcial', label: 'Parcial' },
  { value: 'recuperatorio', label: 'Recuperatorio' },
  { value: 'integrador', label: 'Integrador' }
]

const KIND_LABEL: Record<ExamInstance['kind'], string> = {
  parcial: 'Parcial',
  recuperatorio: 'Recuperatorio',
  integrador: 'Integrador',
  tp: 'Trabajo práctico'
}

type Ids = { subjectId: string; sectionId: string }

/** Nombre, tipo y fecha: los mismos campos para sumar una instancia o corregir una. La fecha y la hora van en su
    propia fila, para que se vean enteras también con el navegador al 125 %. */
function ExamFields({ exam, idPrefix }: { exam?: ExamInstance; idPrefix: string }) {
  const kind = exam && exam.kind !== 'tp' ? exam.kind : 'parcial'
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className={cn(LABEL, 'sm:col-span-2')}>
        <label className={LABEL}>
          <span>
            Nombre<span className={HELP}> (obligatorio)</span>
          </span>
          <span className={cn(BOX, 'has-[[aria-invalid=true]]:border-destructive')}>
            <input
              name='name'
              required
              maxLength={120}
              defaultValue={exam?.name}
              placeholder='Ej.: Parcial integrador'
              className={INPUT}
            />
          </span>
        </label>
        <FieldError field='name' />
      </div>
      <label className={LABEL}>
        Tipo
        <Select
          name='kind'
          defaultValue={kind}
          options={KINDS}
          className='h-11 rounded-[10px] pl-3 text-[0.9375rem] font-normal'
        />
      </label>
      <div className='sm:col-span-2'>
        <DateTimeFields
          legend='Fecha y hora'
          lead='Es el'
          dateName='date'
          timeName='time'
          idPrefix={`${idPrefix}-fecha`}
          value={exam?.date}
          suggestedTime='18:00'
        />
      </div>
    </div>
  )
}

/* Borrar una instancia, a la vista en su panel. Solo se borran las propias sin notas: las del SIU vienen de su
   cronograma y una con notas perdería lo cargado. Cuando no se puede, dice por qué. Borrar pide confirmar. */
function DeleteExam({ exam, ids }: { exam: ExamInstance; ids: Ids }) {
  if (!exam.canDelete) {
    return (
      <p className={cn('flex items-start gap-2 text-[0.8125rem]', HELP)}>
        <Lock aria-hidden='true' className='mt-0.5 size-3.5 flex-none' strokeWidth={2} />
        {exam.source === 'siu'
          ? 'Viene del cronograma del SIU: se puede corregir, pero no borrar'
          : `Para borrarla, primero sacá ${exam.graded === 1 ? 'su nota' : `sus ${exam.graded} notas`} en Calificaciones`}
      </p>
    )
  }
  return (
    <details className='group/borrar'>
      <summary
        className={cn(
          GHOST,
          'inline-flex w-fit cursor-pointer list-none items-center gap-2 text-destructive hover:text-destructive focus-ring [&::-webkit-details-marker]:hidden'
        )}
      >
        <Trash2 aria-hidden='true' className='size-4' strokeWidth={2} />
        Borrar instancia
      </summary>
      <ActionForm
        action={deleteExam}
        className='mt-2 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-card p-3'
      >
        <input type='hidden' name='subjectId' value={ids.subjectId} />
        <input type='hidden' name='sectionId' value={ids.sectionId} />
        <input type='hidden' name='columnId' value={exam.columnId} />
        <p className='text-[0.875rem] text-ink'>¿Borrás «{exam.name}»? Se va también su columna de Calificaciones.</p>
        <div>
          <SubmitButton className={cn(PRIMARY, 'bg-destructive hover:bg-destructive/90')}>Sí, borrarla</SubmitButton>
        </div>
      </ActionForm>
    </details>
  )
}

function ExamRow({ exam, ids }: { exam: ExamInstance; ids: Ids }) {
  const prefix = `examen-${exam.columnId.replace(/[^a-z0-9]/gi, '-')}`
  return (
    <li>
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.03] focus-ring-inset [&::-webkit-details-marker]:hidden'>
          <span className='flex min-w-0 flex-1 flex-col gap-1'>
            <span className='flex min-w-0 items-center gap-2'>
              <span className='truncate text-[0.9375rem] font-semibold text-ink'>{exam.name}</span>
              <OriginBadge origin={exam.source} className='flex-none' />
            </span>
            <span className='text-xs text-muted-foreground'>
              {KIND_LABEL[exam.kind]} · <time dateTime={exam.date}>{dueTime(exam.date)}</time>
              {exam.graded > 0 && (
                <span className='tabular-nums'> · {exam.graded === 1 ? '1 nota' : `${exam.graded} notas`}</span>
              )}
              {exam.edited && <span> · corregida en HackAI</span>}
            </span>
          </span>
          <ChevronDown
            aria-hidden='true'
            className='size-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none'
            strokeWidth={2}
          />
        </summary>
        <div className='flex flex-col gap-4 border-t border-border bg-ice/40 px-4 py-4'>
          <ActionForm action={saveExam} noValidate className='flex flex-col gap-3'>
            <input type='hidden' name='subjectId' value={ids.subjectId} />
            <input type='hidden' name='sectionId' value={ids.sectionId} />
            <input type='hidden' name='columnId' value={exam.columnId} />
            <ExamFields exam={exam} idPrefix={prefix} />
            {exam.source === 'siu' && (
              <p className={cn('text-[0.8125rem]', HELP)}>
                El cambio queda en HackAI: el SIU sigue con su cronograma, y las notas se le pasan igual
              </p>
            )}
            <div>
              <SubmitButton className={PRIMARY}>Guardar cambios</SubmitButton>
            </div>
          </ActionForm>
          <div className='border-t border-border pt-3'>
            <DeleteExam exam={exam} ids={ids} />
          </div>
        </div>
      </details>
    </li>
  )
}

/* Agregar una instancia propia: la primera fila de la lista, siempre a la vista. Queda en HackAI, con su columna
   en Calificaciones. */
function AddExam({ ids }: { ids: Ids }) {
  return (
    <details className='group/nueva border-b border-border'>
      <summary className='flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 text-[0.9375rem] font-bold text-blue transition-colors hover:bg-accent/50 focus-ring-inset [&::-webkit-details-marker]:hidden'>
        <span className='grid size-7 place-items-center rounded-lg bg-accent'>
          <Plus
            aria-hidden='true'
            className='size-4 transition-transform duration-200 group-open/nueva:rotate-45 motion-reduce:transition-none'
            strokeWidth={2.2}
          />
        </span>
        Agregar instancia
        <span className='ml-auto text-[0.8125rem] font-medium text-muted-foreground'>
          Parcial, recuperatorio o integrador
        </span>
      </summary>
      <ActionForm
        action={saveExam}
        resetOnSuccess
        noValidate
        className='flex flex-col gap-3 border-t border-border bg-ice/40 px-4 py-4'
      >
        <input type='hidden' name='subjectId' value={ids.subjectId} />
        <input type='hidden' name='sectionId' value={ids.sectionId} />
        <ExamFields idPrefix='examen-nuevo' />
        <p className={cn('text-[0.8125rem]', HELP)}>
          Una instancia que agregás acá no existe en el SIU: sus notas quedan en HackAI
        </p>
        <div>
          <SubmitButton className={PRIMARY}>Agregar instancia</SubmitButton>
        </div>
      </ActionForm>
    </details>
  )
}

/** Las instancias de examen de la comisión, por fecha, con «Agregar instancia» arriba de todo. */
export function ExamList({ exams, ids }: { exams: ExamInstance[]; ids: Ids }) {
  return (
    <Card className='overflow-hidden p-0'>
      <AddExam ids={ids} />
      {exams.length === 0 ? (
        <EmptyState icon={CalendarClock} title='Todavía no hay instancias de examen' inCard>
          Agregá los parciales, recuperatorios o integradores de la comisión para cargarles la nota.
        </EmptyState>
      ) : (
        <ul aria-label='Instancias de examen' className='divide-y divide-border'>
          {exams.map((exam) => (
            <ExamRow key={exam.columnId} exam={exam} ids={ids} />
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Si la materia se promociona en la comisión y desde qué nota de cursada. */
export function PromotionForm({ promotion, ids }: { promotion: Promotion; ids: Ids }) {
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <ActionForm action={savePromotion} className='flex flex-col gap-3'>
        <input type='hidden' name='subjectId' value={ids.subjectId} />
        <input type='hidden' name='sectionId' value={ids.sectionId} />
        <label className='flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] bg-ice/60 px-3 text-[0.9375rem] font-semibold'>
          <input
            type='checkbox'
            name='promotable'
            value='si'
            defaultChecked={promotion.promotable}
            className='size-5 accent-blue'
          />
          La materia se promociona en esta comisión
        </label>
        <label className={cn(LABEL, 'max-w-[16rem]')}>
          Nota mínima para promocionar
          <span className={BOX}>
            <input
              name='minimum'
              inputMode='decimal'
              defaultValue={gradeInputValue(promotion.minimum)}
              aria-describedby='promocion-ayuda'
              className={cn(INPUT, 'tabular-nums')}
            />
          </span>
          <span id='promocion-ayuda' className={HELP}>
            De 4 a 10; se regulariza desde 4
          </span>
        </label>
        <div className='flex flex-wrap gap-2'>
          <SubmitButton className={PRIMARY}>Guardar promoción</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  )
}
