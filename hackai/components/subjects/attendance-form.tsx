'use client'
/* La lista de una clase para tomar lista: una fila grande por alumno, un toque
   lo marca ausente (todos arrancan presentes) y «Guardar» queda siempre a la
   vista, abajo en el celular. Con la clase de otro día la lista se ve, pero no
   se puede cambiar. Solo muestra lo que dice la página y la server action. */
import { Check, CircleAlert, UserX } from 'lucide-react'
import { useActionState, useState } from 'react'
import { absentCount, PASS_TEXT, PASS_TONE, SAVED_TEXT } from '@/components/subjects/attendance-format'
import type { AttendanceAction, AttendanceState } from '@/components/subjects/attendance-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorNotice } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { AttendancePass } from '@/lib/core/studies'
import { cn } from '@/lib/utils'

export type AttendanceStudent = { legajo: string; name: string }

const INITIAL: AttendanceState = { kind: 'inicial' }

export function AttendanceForm({
  action,
  sectionId,
  classAt,
  students,
  initialAbsent,
  pass,
  editable
}: {
  action: AttendanceAction
  sectionId: string
  classAt: string
  students: AttendanceStudent[]
  /** Los legajos de los ausentes ya guardados. */
  initialAbsent: string[]
  /** Cómo está el pase de la lista ya guardada; `null` si todavía no se tomó. */
  pass: AttendancePass | null
  /** Solo la clase de hoy se toma o se corrige. */
  editable: boolean
}) {
  const [absent, setAbsent] = useState(() => new Set(initialAbsent))
  const [state, formAction, pending] = useActionState(action, INITIAL)

  const toggle = (legajo: string) =>
    setAbsent((current) => {
      const next = new Set(current)
      if (!next.delete(legajo)) next.add(legajo)
      return next
    })

  const shownPass = state.kind === 'guardada' ? state.pass : pass

  return (
    <form action={formAction} className='flex max-w-3xl flex-col gap-3'>
      <input type='hidden' name='comision' value={sectionId} />
      <input type='hidden' name='clase' value={classAt} />
      {[...absent].map((legajo) => (
        <input key={legajo} type='hidden' name='ausente' value={legajo} />
      ))}

      <div className='flex flex-wrap items-center gap-2 px-1'>
        <h2 className='text-sm font-bold text-muted-foreground' aria-live='polite'>
          {absentCount(absent.size, students.length)}
        </h2>
        {shownPass && <StatusPill tone={PASS_TONE[shownPass]}>{PASS_TEXT[shownPass]}</StatusPill>}
      </div>
      {editable && (
        <p className='px-1 text-[0.8125rem] text-muted-foreground'>
          Tocá a quienes faltaron. Los demás quedan presentes.
        </p>
      )}

      <Card>
        <ul className='divide-y divide-border'>
          {students.map((s) => {
            const away = absent.has(s.legajo)
            return (
              <li key={s.legajo}>
                <button
                  type='button'
                  aria-pressed={away}
                  disabled={!editable}
                  onClick={() => toggle(s.legajo)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 focus-ring-inset disabled:cursor-default',
                    away ? 'bg-error-background' : 'enabled:hover:bg-blue/[0.04]'
                  )}
                >
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='font-semibold'>{s.name}</span>
                    <span className='text-[0.8125rem] text-muted-foreground'>Legajo {s.legajo}</span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex min-w-[6.5rem] flex-none items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold',
                      away ? 'bg-destructive text-white' : 'bg-success-background text-success'
                    )}
                  >
                    {away ? (
                      <UserX aria-hidden='true' className='size-4' />
                    ) : (
                      <Check aria-hidden='true' className='size-4' />
                    )}
                    {away ? 'Ausente' : 'Presente'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <div aria-live='polite' className='flex flex-col gap-2'>
        {state.kind === 'guardada' && (
          <p className='flex items-start gap-2 rounded-lg bg-success-background p-3 text-sm text-success'>
            <Check aria-hidden='true' className='mt-0.5 size-4 flex-none' />
            <span>{SAVED_TEXT[state.pass]}</span>
          </p>
        )}
        {state.kind === 'error' && (
          <ErrorNotice>
            <p className='flex items-start gap-2'>
              <CircleAlert aria-hidden='true' className='mt-0.5 size-4 flex-none' />
              {state.message}
            </p>
          </ErrorNotice>
        )}
      </div>

      {editable ? (
        <div className='fixed inset-x-0 bottom-[calc(67px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-background px-4 py-2 lg:sticky lg:bottom-0 lg:z-auto lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-3'>
          <Button type='submit' size='lg' disabled={pending} className='h-11 w-full text-base'>
            {pending ? 'Guardando…' : pass ? 'Guardar corrección' : 'Guardar lista'}
          </Button>
        </div>
      ) : (
        <p className='px-1 text-[0.8125rem] text-muted-foreground'>
          Solo se toma o se corrige la lista de la clase de hoy.
        </p>
      )}
    </form>
  )
}
