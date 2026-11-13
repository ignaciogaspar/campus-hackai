'use client'

/* Seguimiento desde la ficha: una nota corta («Pidió beca», «Le faltan 3 del
   primer cuatrimestre») y «Seguir a este alumno». Si ya está, se cambia la nota o
   se lo saca. Lo guarda Reportes; la lista está en Reportes › En seguimiento. */
import { BookmarkCheck, BookmarkPlus, BookmarkX } from 'lucide-react'
import { followStudent, unfollowStudent } from '@/app/actions/reports'
import { ActionForm, FieldError, SubmitButton } from '@/components/spaces/action-form'
import { FOLLOW_UP_NOTE_MAX } from '@/lib/core/reports'

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[0.875rem] font-semibold focus-ring disabled:opacity-60'

export function FollowUpForm({
  studentId,
  note,
  since
}: {
  studentId: string
  note: string | null
  since: string | null
}) {
  const followed = note !== null
  return (
    <div className='flex flex-col gap-3'>
      {followed && (
        <p className='inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-blue'>
          <BookmarkCheck aria-hidden='true' className='size-4' />
          En seguimiento{since ? ` desde el ${since}` : ''}
        </p>
      )}
      <ActionForm action={followStudent} clearOnEdit className='flex flex-col gap-2'>
        <input type='hidden' name='studentId' value={studentId} />
        <label className='flex flex-col gap-1 text-[0.8125rem] font-semibold'>
          Nota para el equipo
          <textarea
            name='note'
            rows={3}
            maxLength={FOLLOW_UP_NOTE_MAX}
            defaultValue={note ?? ''}
            placeholder='Por ejemplo: pidió beca; le faltan dos del primer cuatrimestre'
            className='w-full rounded-xl border border-border bg-card px-3 py-2 text-[0.9375rem] font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
          />
          <span className='font-normal text-muted-foreground'>
            Hasta {FOLLOW_UP_NOTE_MAX} caracteres. La ve todo secretaría.
          </span>
          <FieldError field='note' />
        </label>
        <SubmitButton className={`${BUTTON} bg-blue text-white hover:bg-blue-deep`}>
          <BookmarkPlus aria-hidden='true' className='size-4' />
          {followed ? 'Guardar la nota' : 'Seguir a este alumno'}
        </SubmitButton>
      </ActionForm>
      {followed && (
        <ActionForm action={unfollowStudent}>
          <input type='hidden' name='studentId' value={studentId} />
          <SubmitButton className={`${BUTTON} w-full border border-border bg-card text-ink hover:bg-ice`}>
            <BookmarkX aria-hidden='true' className='size-4' />
            Dejar de seguir
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  )
}
