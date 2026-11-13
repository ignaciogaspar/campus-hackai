/* Cómo se evalúa la comisión, para el docente: las instancias de examen (las
   del SIU, a las que les puede corregir el nombre, el tipo y la fecha, y las que
   suma en HackAI), y si la materia se promociona. Cada instancia se edita en el
   lugar, desplegándola: sin ventanas encima. */
import { CalendarClock, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { deleteExam, saveExam, savePromotion } from '@/app/actions/coursework'
import { BOX, GHOST, HELP, INPUT, LABEL, PRIMARY } from '@/components/coursework/fields'
import { dueTime, gradeInputValue, inputValueOf } from '@/components/coursework/format'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { Card } from '@/components/ui/card'
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

/** De dónde viene la instancia, en texto: del SIU (y si se le corrigió algo) o propia. */
const sourceNote = (exam: ExamInstance) =>
  exam.source === 'hackai' ? 'propia, queda en HackAI' : exam.edited ? 'del SIU, corregida en HackAI' : 'del SIU'

/** Nombre, tipo y fecha: los mismos campos para sumar una instancia o corregir una. */
function ExamFields({ exam, idPrefix }: { exam?: ExamInstance; idPrefix: string }) {
  const kind = exam && exam.kind !== 'tp' ? exam.kind : 'parcial'
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <label className={cn(LABEL, 'sm:col-span-2')}>
        Nombre
        <span className={BOX}>
          <input
            name='name'
            required
            maxLength={120}
            defaultValue={exam?.name}
            placeholder='Segundo parcial'
            className={INPUT}
          />
        </span>
      </label>
      <label className={LABEL}>
        Tipo
        <span className={BOX}>
          <select name='kind' defaultValue={kind} className={cn(INPUT, 'cursor-pointer')}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className={LABEL}>
        Fecha y hora
        <span className={BOX}>
          <input
            type='datetime-local'
            name='date'
            required
            defaultValue={exam ? inputValueOf(exam.date) : undefined}
            aria-describedby={`${idPrefix}-fecha`}
            className={INPUT}
          />
        </span>
        <span id={`${idPrefix}-fecha`} className={HELP}>
          En hora de Buenos Aires
        </span>
      </label>
    </div>
  )
}

function ExamRow({ exam, ids }: { exam: ExamInstance; ids: Ids }) {
  const prefix = `examen-${exam.columnId.replace(/[^a-z0-9]/gi, '-')}`
  return (
    <li>
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03] focus-ring-inset [&::-webkit-details-marker]:hidden'>
          <span className='flex min-w-0 flex-1 flex-col gap-1'>
            <span className='truncate text-[0.9375rem] font-semibold text-ink'>{exam.name}</span>
            <span className='text-xs text-muted-foreground'>
              {KIND_LABEL[exam.kind]} · <time dateTime={exam.date}>{dueTime(exam.date)}</time>
              {exam.graded > 0 && (
                <span className='tabular-nums'> · {exam.graded === 1 ? '1 nota' : `${exam.graded} notas`}</span>
              )}
              <span> · {sourceNote(exam)}</span>
            </span>
          </span>
          <ChevronDown
            aria-hidden='true'
            className='size-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none'
            strokeWidth={2}
          />
        </summary>
        <div className='flex flex-col gap-3 border-t border-border bg-ice/40 px-4 py-4'>
          <ActionForm action={saveExam} className='flex flex-col gap-3'>
            <input type='hidden' name='subjectId' value={ids.subjectId} />
            <input type='hidden' name='sectionId' value={ids.sectionId} />
            <input type='hidden' name='columnId' value={exam.columnId} />
            <ExamFields exam={exam} idPrefix={prefix} />
            {exam.source === 'siu' && (
              <p className={cn('text-[0.8125rem]', HELP)}>
                El cambio queda en HackAI: el SIU sigue con su cronograma, y las notas se le pasan igual
              </p>
            )}
            <div className='flex flex-wrap gap-2'>
              <SubmitButton className={PRIMARY}>Guardar cambios</SubmitButton>
            </div>
          </ActionForm>
          {exam.canDelete && (
            <ActionForm action={deleteExam} className='flex flex-col gap-2'>
              <input type='hidden' name='subjectId' value={ids.subjectId} />
              <input type='hidden' name='sectionId' value={ids.sectionId} />
              <input type='hidden' name='columnId' value={exam.columnId} />
              <div>
                <SubmitButton className={cn(GHOST, 'text-destructive hover:text-destructive')}>
                  <Trash2 aria-hidden='true' className='size-4' strokeWidth={2} />
                  Borrar instancia
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </div>
      </details>
    </li>
  )
}

/** Las instancias de examen de la comisión, por fecha. */
export function ExamList({ exams, ids }: { exams: ExamInstance[]; ids: Ids }) {
  if (exams.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title='Todavía no hay instancias de examen'>
        Sumá los parciales, recuperatorios o integradores de la comisión para cargarles la nota.
      </EmptyState>
    )
  }
  return (
    <Card>
      <ul aria-label='Instancias de examen' className='divide-y divide-border'>
        {exams.map((exam) => (
          <ExamRow key={exam.columnId} exam={exam} ids={ids} />
        ))}
      </ul>
    </Card>
  )
}

/** Sumar una instancia propia: queda en HackAI, con su columna en Calificaciones. */
export function NewExamForm({ ids }: { ids: Ids }) {
  return (
    <Card className='p-0'>
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-center gap-2 rounded-[22px] px-4 py-3 text-[0.9375rem] font-bold text-blue transition-colors hover:bg-ink/[0.03] focus-ring-inset [&::-webkit-details-marker]:hidden'>
          <Plus aria-hidden='true' className='size-5' strokeWidth={2} />
          Sumar una instancia de examen
        </summary>
        <ActionForm action={saveExam} resetOnSuccess className='flex flex-col gap-3 border-t border-border px-4 py-4'>
          <input type='hidden' name='subjectId' value={ids.subjectId} />
          <input type='hidden' name='sectionId' value={ids.sectionId} />
          <ExamFields idPrefix='examen-nuevo' />
          <p className={cn('text-[0.8125rem]', HELP)}>
            Una instancia que sumás acá no existe en el SIU: sus notas quedan en HackAI
          </p>
          <div className='flex flex-wrap gap-2'>
            <SubmitButton className={PRIMARY}>Sumar instancia</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </Card>
  )
}

/** Si la materia se promociona en la comisión y desde qué nota de cursada. */
export function PromotionForm({ promotion, ids }: { promotion: Promotion; ids: Ids }) {
  return (
    <Card className='flex flex-col gap-3 p-4'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-base font-extrabold'>Promoción</h2>
        <p className={cn('text-[0.8125rem]', HELP)}>
          Si la materia se promociona, quien llega a la nota mínima de cursada la aprueba sin final y pasa al SIU como
          promocionado.
        </p>
      </div>
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
